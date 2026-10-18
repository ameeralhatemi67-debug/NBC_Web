// Production upgrade path for the prize draw release: a private schema at 014 (as production is),
// the generated forward export applied once, then a whole draw run as the restricted runtime role.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { connectDatabase } from '../src/lib/database.ts';
import { migrations, migrationChecksum, migrationsCurrent } from '../src/lib/migrations.ts';
import { initializeCompetition } from '../src/lib/competition-service.ts';
import { PrizeDrawService } from '../src/lib/prize-draw-service.ts';
import { verifyDraw } from '../src/lib/prize-draw.ts';
const target = new URL(process.env.NBC_TEST_DATABASE_URL || 'invalid:');
if (target.hostname !== '127.0.0.1' || target.pathname !== '/nbc_release_test')
  throw new Error('Only the disposable PostgreSQL release test database is allowed.');
const operatorPool = new Pool({ connectionString: target.toString(), max: 1 });
const operator = await operatorPool.connect();
const password = randomBytes(32).toString('hex');
const lit = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const exportTo = (script, file, ...args) => {
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', script, file, 'eerfhnaduachqluowsdo', ...args],
    { windowsHide: true, encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  return readFile(file, 'utf8');
};
let count = 0;
const pass = (message) => {
  count++;
  console.log('PASS', message);
};
try {
  // Roles are cluster-wide and may exist from the storage phase.
  await operator.query(`DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='nbc_runtime') THEN CREATE ROLE nbc_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  END $$; ALTER ROLE nbc_runtime PASSWORD ${lit(password)};`);
  // The fresh export without the migrations after 014 is the schema the first forward release
  // started from; the upgrade below applies all of them (015 onwards) in one go.
  const draw = migrations.find((m) => m.id === '015_prize_draw');
  const later = migrations.slice(migrations.findIndex((m) => m.id === '014_simulation') + 1);
  const fresh = await exportTo('scripts/export-fresh-supabase.mjs', '.data/release-test-fresh.sql');
  let at014 = fresh.replace(
    'REVOKE DELETE ON prize_draws,prize_draw_entries FROM nbc_runtime;\n',
    '',
  );
  for (const m of later) {
    const block = `${m.sql}\nINSERT INTO schema_migrations(id,checksum) VALUES(${lit(m.id)},${lit(migrationChecksum(m.sql))});\n`;
    assert.ok(at014.includes(block), m.id);
    at014 = at014.replace(block, '');
  }
  assert.notEqual(at014, fresh);
  await operator.query('BEGIN');
  await operator.query(at014);
  await operator.query('COMMIT');
  const before = (
    await operator.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='nbc'")
  ).rows[0].n;
  assert.equal(before, 30);
  pass('private schema at 014 matches production: 30 tables');

  const upgrade = await exportTo(
    'scripts/export-supabase-upgrade.mjs',
    '.data/release-test-upgrade.sql',
    '014_simulation',
  );
  await operator.query('BEGIN');
  await operator.query(upgrade);
  await operator.query('COMMIT');
  const tables = (
    await operator.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='nbc'")
  ).rows;
  assert.equal(tables.length, 32);
  assert.ok(tables.every((t) => t.rowsecurity));
  const policies = (
    await operator.query(
      "SELECT tablename,roles::text[] AS roles FROM pg_policies WHERE schemaname='nbc' AND tablename LIKE 'prize_draw%'",
    )
  ).rows;
  assert.equal(policies.length, 2);
  assert.ok(policies.every((p) => p.roles.length === 1 && p.roles[0] === 'nbc_runtime'));
  const applied = (
    await operator.query("SELECT checksum FROM nbc.schema_migrations WHERE id='015_prize_draw'")
  ).rows[0];
  assert.equal(applied.checksum, migrationChecksum(draw.sql));
  const recorded = (await operator.query('SELECT id FROM nbc.schema_migrations')).rows.map(
    (r) => r.id,
  );
  assert.ok(later.every((m) => recorded.includes(m.id)));
  pass(
    'forward export adds every later migration once: 32 tables, RLS and runtime-only policies, recorded checksums',
  );

  await operator.query('BEGIN');
  await assert.rejects(operator.query(upgrade), /already applied/);
  await operator.query('ROLLBACK');
  pass('re-applying the release is refused');

  for (const role of ['anon', 'authenticated', 'service_role']) {
    await operator.query(`SET ROLE ${role}`);
    await assert.rejects(operator.query('SELECT * FROM nbc.prize_draws'), /permission denied/);
    await assert.rejects(
      operator.query('SELECT * FROM nbc.prize_draw_entries'),
      /permission denied/,
    );
    await operator.query('RESET ROLE');
  }
  const execute = (
    await operator.query(
      "SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nbc' AND p.proname LIKE 'guard_prize_draw%'",
    )
  ).rows;
  assert.equal(execute.length, 2);
  assert.ok(execute.every((f) => f.anon === false));
  pass('public roles cannot read draw tables or execute their guard functions');

  // The application, connected as the restricted runtime role, runs a complete draw.
  const runtimeUrl = new URL(target);
  runtimeUrl.username = 'nbc_runtime';
  runtimeUrl.password = password;
  process.env.NBC_RUNTIME_MODE = 'production';
  process.env.DATABASE_URL = runtimeUrl.toString();
  process.env.NBC_DATABASE_SCHEMA = 'nbc';
  const db = await connectDatabase();
  try {
    assert.equal(await migrationsCurrent(db), true);
    await initializeCompetition(db);
    await db.query(
      `UPDATE competitions SET body = body || '{"state":"CLOSED","closedAt":"2026-10-01T00:00:00.000Z","closingPolicy":"immediate","graceMinutes":0}'::jsonb WHERE id='nbc-1448-2026'`,
    );
    for (let i = 0; i < 6; i++) {
      await db.query(
        "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES($1,$2,$3,$4,'المرحلة المتوسطة','الشرقية','الدمام')",
        [`p${i}`, `h1:release-${i}`, `مشارك ${i}`, `+9665000000${i}0`],
      );
      await db.query(
        `INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score,score,percentage,submitted_at,receipt) VALUES($1,$2,'nbc-1448-2026','middle',$3,'[]',20,10,50,now(),$4)`,
        [`a${i}`, `p${i}`, String(500000 + i), `R-${i}`],
      );
    }
    const admin = { role: 'admin', participant_id: null, actor: 'release-test' };
    const service = new PrizeDrawService(db);
    const frozen = await service.freeze(admin, {
      stage: 'middle',
      prizes: ['جائزة'],
      alternates: 2,
      excludeRanked: false,
      excludeFlags: false,
    });
    const id = frozen.draw.id;
    await service.commit(admin, { id });
    const drawn = await service.draw(admin, { id });
    assert.equal(drawn.draw.entries.length, 3);
    await service.setStatus(admin, { id, position: 1, status: 'unreachable', note: '' });
    const after = await service.state(admin, { id });
    assert.deepEqual(after.draw.holders, [2]);
    assert.deepEqual(await verifyDraw(await service.verificationFile(admin, id)), {
      poolMatches: true,
      seedMatches: true,
      resultsMatch: true,
    });
    await assert.rejects(db.query('DELETE FROM prize_draw_entries'), /permission denied/);
    await assert.rejects(db.query('DELETE FROM prize_draws'), /permission denied/);
    await assert.rejects(db.query("UPDATE prize_draws SET pool='[]'"), /immutable/);
    pass(
      'runtime role freezes, commits, draws, records outcomes and verifies; it cannot delete or rewrite',
    );
  } finally {
    await db.close();
  }
  console.log(`${count} release upgrade checks passed.`);
} finally {
  operator.release();
  await operatorPool.end();
}
