import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../src/lib/database';
import { migrate, migrations } from '../src/lib/migrations';
import { identityLookup } from '../src/lib/otp-crypto';
import { randomBytes } from 'node:crypto';
async function legacy() {
  const engine = new PGlite();
  const db: Database = {
    kind: 'pglite',
    query: (sql, args) => engine.query(sql, args),
    exec: (sql) => engine.exec(sql),
    transaction: (run) => engine.transaction((tx) => run(tx)),
    close: () => engine.close(),
    dumpDataDir: (format) => engine.dumpDataDir(format),
  };
  await db.exec(migrations[0].sql);
  return db;
}
test('legacy migration HMACs identities, normalizes phones and preserves records/sessions without accepting legacy auth', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await legacy();
  try {
    await db.query(
      "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES('legacy','1999999999','synthetic','0599999999','stage','region','city')",
    );
    await db.query(
      "INSERT INTO sessions VALUES('hash','legacy','participant',now()+interval '8 hours')",
    );
    await migrate(db);
    const p = (
      await db.query<{ identity: string; phone: string }>('SELECT identity,phone FROM participants')
    ).rows[0];
    assert.equal(p.identity, identityLookup('1999999999'));
    assert.equal(p.phone, '+966599999999');
    assert.equal(
      (await db.query<{ auth_source: string }>('SELECT auth_source FROM sessions')).rows[0]
        .auth_source,
      'legacy',
    );
  } finally {
    await db.close();
  }
});
test('production migration refuses synthetic demo identities and rolls back schema upgrade', async () => {
  const db = await legacy();
  process.env.NBC_RUNTIME_MODE = 'production';
  process.env.IDENTITY_LOOKUP_SECRET = randomBytes(32).toString('hex');
  try {
    await db.query(
      "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES('sample-1','DEMO-1','synthetic','masked','stage','region','city')",
    );
    await assert.rejects(migrate(db), /synthetic/);
    assert.equal((await db.query('SELECT id FROM participants')).rows.length, 1);
    assert.equal(
      (
        await db.query<{ name: string | null }>(
          "SELECT to_regclass('otp_challenges')::text AS name",
        )
      ).rows[0].name,
      null,
    );
  } finally {
    await db.close();
  }
});
