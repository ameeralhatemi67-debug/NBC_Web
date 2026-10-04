import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectDatabase } from '../src/lib/database.ts';
import { validatePrizes, prizeTotal } from '../src/lib/prizes.ts';
const [file, ...flags] = process.argv.slice(2);
if (!file) throw new Error('Usage: tsx scripts/import-nbc-snapshot.mjs snapshot.json [--apply]');
const raw = await readFile(file, 'utf8');
const input = JSON.parse(raw);
const prizes = validatePrizes(input.prizes);
if (
  input.participants !== 0 ||
  input.attempts !== 0 ||
  input.audit?.length !== 4 ||
  prizes.version !== 5 ||
  prizes.layout !== 'podium' ||
  prizeTotal(prizes) !== 52000
)
  throw new Error('Unexpected NBC snapshot, requires operator review.');
for (const [i, a] of input.audit.entries()) {
  const detail = JSON.parse(a.detail);
  if (
    a.id !== i + 1 ||
    !/^staff:[a-f0-9]{64}$/.test(a.actor) ||
    a.action !== 'تعديل الجوائز' ||
    !Number.isFinite(Date.parse(a.created_at)) ||
    detail.after.version !== i + 2
  )
    throw new Error('Invalid historical audit evidence.');
  validatePrizes(detail.before);
  validatePrizes(detail.after);
  if (i === 3 && JSON.stringify(validatePrizes(detail.after)) !== JSON.stringify(prizes))
    throw new Error('Audit final state does not match snapshot.');
}
const digest = createHash('sha256').update(raw).digest('hex');
if (flags.includes('--apply')) {
  if (
    process.env.NBC_SUPABASE_PROJECT_REF !== 'eerfhnaduachqluowsdo' ||
    process.env.NBC_DATABASE_SCHEMA !== 'nbc'
  )
    throw new Error('Only dedicated NBC private storage is authorized.');
  const db = await connectDatabase();
  try {
    await db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(72831007)');
      const old = (await tx.query("SELECT value FROM settings WHERE id='retired_snapshot_import'"))
        .rows[0];
      if (old) {
        if (old.value.sha256 !== digest) throw new Error('Different snapshot already imported');
        return;
      }
      if (
        (await tx.query('SELECT id FROM participants LIMIT 1')).rows.length ||
        (await tx.query('SELECT id FROM attempts LIMIT 1')).rows.length
      )
        throw new Error('Snapshot import refuses participant data.');
      if ((await tx.query("SELECT id FROM audit WHERE actor LIKE 'staff:%' LIMIT 1")).rows.length)
        throw new Error('Staff actions already exist; review instead of overwriting settings.');
      await tx.query(
        "INSERT INTO settings(id,value) VALUES('prizes',$1) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        [JSON.stringify(prizes)],
      );
      for (const a of input.audit)
        await tx.query('INSERT INTO audit(actor,action,detail,created_at) VALUES($1,$2,$3,$4)', [
          a.actor,
          a.action,
          a.detail,
          a.created_at,
        ]);
      await tx.query("INSERT INTO settings(id,value) VALUES('retired_snapshot_import',$1)", [
        JSON.stringify({
          sha256: digest,
          importedAt: new Date().toISOString(),
          historicalEntries: 4,
        }),
      ]);
      await tx.query(
        "INSERT INTO audit(actor,action,detail) VALUES('system:import','استعادة إعدادات NBC',$1)",
        [JSON.stringify({ sha256: digest, historicalEntries: 4, preservedAttribution: true })],
      );
    });
  } finally {
    await db.close();
  }
}
console.log(
  `NBC snapshot ${flags.includes('--apply') ? 'imported' : 'validated'}: version 5, SAR 52,000, four historical audit entries.`,
);
