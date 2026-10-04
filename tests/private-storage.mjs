import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { connectDatabase } from '../src/lib/database.ts';
import { verifyIdentityKey } from '../src/lib/identity-key.ts';
import { migrationsCurrent, migrations } from '../src/lib/migrations.ts';
const target = new URL(process.env.NBC_TEST_DATABASE_URL || 'invalid:');
if (target.hostname !== '127.0.0.1' || target.pathname !== '/nbc_storage_test')
  throw new Error('Only the disposable PostgreSQL storage test database is allowed.');
const operatorPool = new Pool({ connectionString: target.toString(), max: 1 });
// Keep SET ROLE on one checked-out connection, including failed permission
// queries. Pool.query replaces clients after errors and would reset the role.
const operator = await operatorPool.connect();
const password = randomBytes(32).toString('hex');
let count = 0;
const pass = (message) => {
  count++;
  console.log('PASS', message);
};
try {
  await operator.query(
    `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE nbc_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`,
  );
  const file = '.data/storage-test-export.sql';
  const exported = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/export-fresh-supabase.mjs', file, 'eerfhnaduachqluowsdo'],
    { windowsHide: true, encoding: 'utf8' },
  );
  assert.equal(exported.status, 0, exported.stderr);
  const sql = await readFile(file, 'utf8');
  await operator.query('BEGIN');
  await operator.query(sql);
  await operator.query('COMMIT');
  const tables = (
    await operator.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='nbc'")
  ).rows;
  assert.equal(tables.length, 22);
  assert.ok(tables.every((t) => t.rowsecurity));
  pass('source-derived fresh export creates 22 private tables with RLS');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await operator.query(`SET ROLE ${role}`);
    await assert.rejects(operator.query('SELECT * FROM nbc.settings'), /permission denied/);
    await operator.query('RESET ROLE');
  }
  pass('anon, authenticated and bypass-RLS service role have no private schema access');
  const role = (
    await operator.query(
      "SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='nbc_runtime'",
    )
  ).rows[0];
  assert.ok(Object.values(role).every((v) => v === false));
  const policies = (
    await operator.query("SELECT roles::text[] AS roles FROM pg_policies WHERE schemaname='nbc'")
  ).rows;
  assert.ok(policies.every((p) => p.roles.length === 1 && p.roles[0] === 'nbc_runtime'));
  pass('runtime role has no privileged flags; policies apply only to server runtime');
  assert.equal(
    (await operator.query('SELECT count(*)::int AS n FROM nbc.schema_migrations')).rows[0].n,
    migrations.length,
  );
  pass('operator/table owner sees migration history despite RLS, without public policies');
  await operator.query('SET ROLE nbc_runtime');
  await assert.rejects(operator.query('CREATE TABLE nbc.forbidden(id int)'), /permission denied/);
  await assert.rejects(
    operator.query("UPDATE nbc.schema_migrations SET checksum='false'"),
    /permission denied/,
  );
  await assert.rejects(operator.query('DELETE FROM nbc.audit'), /permission denied/);
  await assert.rejects(
    operator.query('UPDATE nbc.attempt_questions SET ordinal=0'),
    /permission denied/,
  );
  await operator.query('RESET ROLE');
  pass('runtime cannot create schema objects, forge migrations or alter append-only evidence');
  const runtimeUrl = new URL(target);
  runtimeUrl.username = 'nbc_runtime';
  runtimeUrl.password = password;
  process.env.NBC_RUNTIME_MODE = 'production';
  process.env.DATABASE_URL = runtimeUrl.toString();
  process.env.NBC_DATABASE_SCHEMA = 'nbc';
  process.env.IDENTITY_LOOKUP_SECRET = randomBytes(32).toString('hex');
  const db = await connectDatabase();
  try {
    assert.equal(await migrationsCurrent(db), true);
    await Promise.all([verifyIdentityKey(db), verifyIdentityKey(db)]);
    for (let i = 0; i < 8; i++)
      assert.equal((await db.query('SELECT current_schema() AS s')).rows[0].s, 'nbc');
    pass(
      'runtime adapter sets transaction-local schema on reused connections and enrolls identity key once',
    );
    await db.query("INSERT INTO settings(id,value) VALUES('storage-test','{\"version\":1}')");
    const writes = await Promise.allSettled(
      [1, 2].map(() =>
        db.transaction(async (tx) => {
          const row = (
            await tx.query("SELECT value FROM settings WHERE id='storage-test' FOR UPDATE")
          ).rows[0];
          if (row.value.version !== 1) throw new Error('stale');
          await tx.query("UPDATE settings SET value='{\"version\":2}' WHERE id='storage-test'");
        }),
      ),
    );
    assert.equal(writes.filter((r) => r.status === 'fulfilled').length, 1);
    pass('row lock permits one committed version update and rejects concurrent stale writer');
    const original = process.env.IDENTITY_LOOKUP_SECRET;
    process.env.IDENTITY_LOOKUP_SECRET = randomBytes(32).toString('hex');
    await assert.rejects(verifyIdentityKey(db), /لا يطابق/);
    process.env.IDENTITY_LOOKUP_SECRET = original;
    pass('key mismatch fails closed without overwriting identity enrollment');
  } finally {
    await db.close();
  }
  const updated = await operator.query('SELECT checksum FROM nbc.schema_migrations ORDER BY id');
  assert.ok(updated.rows.every((r) => r.checksum?.length === 64));
  pass('source migration checksums survive all runtime checks');
  await writeFile(
    '.data/private-storage-result.json',
    JSON.stringify({ checks: count, tables: tables.length, migrations: migrations.length }),
  );
  console.log(`${count} private storage checks passed.`);
} finally {
  operator.release();
  await operatorPool.end();
}
