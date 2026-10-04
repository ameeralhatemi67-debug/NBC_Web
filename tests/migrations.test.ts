import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, migrations, migrationsCurrent } from '../src/lib/migrations';
import { disposableDatabase } from './database-fixture';
import { verifyIdentityKey } from '../src/lib/identity-key';
import { identityLookup } from '../src/lib/otp-crypto';
import { randomBytes } from 'node:crypto';
async function legacy() {
  const db = await disposableDatabase();
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
test('fresh and concurrent migrations validate every source checksum and reject altered or incomplete history', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await Promise.all([migrate(db), migrate(db), migrate(db)]);
    assert.equal(await migrationsCurrent(db), true);
    await db.query("UPDATE schema_migrations SET checksum='altered' WHERE id='001_baseline'");
    assert.equal(await migrationsCurrent(db), false);
    await assert.rejects(migrate(db), /checksum mismatch/);
    await db.query("DELETE FROM schema_migrations WHERE id='001_baseline'");
    assert.equal(await migrationsCurrent(db), false);
  } finally {
    await db.close();
  }
});
test('identity enrollment uses the existing key once and refuses mismatches, missing authorization or existing identities', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await verifyIdentityKey(db);
    await db.query("UPDATE settings SET value='\"wrong-key\"' WHERE id='identity_key_check'");
    await assert.rejects(verifyIdentityKey(db), /لا يطابق/);
    await db.query("DELETE FROM settings WHERE id='identity_key_check'");
    await assert.rejects(verifyIdentityKey(db), /مراجعة/);
    await db.query("INSERT INTO settings VALUES('identity_key_bootstrap_pending','true')");
    await Promise.all([verifyIdentityKey(db), verifyIdentityKey(db)]);
    assert.equal(
      (await db.query("SELECT id FROM settings WHERE id='identity_key_check'")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("SELECT id FROM settings WHERE id='identity_key_bootstrap_pending'")).rows
        .length,
      0,
    );
    await db.query("DELETE FROM settings WHERE id='identity_key_check'");
    await db.query("INSERT INTO settings VALUES('identity_key_bootstrap_pending','true')");
    await db.query(
      "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES('old','h1:old','synthetic','masked','stage','region','city')",
    );
    await assert.rejects(verifyIdentityKey(db), /مراجعة/);
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
test('competition migrations preserve legacy submissions and replace lifetime uniqueness with campaign uniqueness', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await legacy();
  try {
    await db.query(
      "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES('historic','DEMO-historic','synthetic','masked','stage','region','city')",
    );
    const questions = [
      {
        id: 'old-q',
        title: 'historic',
        options: ['A', 'B'],
        correct: 1,
        version: 1,
        approved: true,
        source: 'old',
      },
    ];
    await db.query('INSERT INTO questions VALUES($1,$2)', ['old-q', JSON.stringify(questions[0])]);
    await db.query(
      "INSERT INTO attempts(id,participant_id,questions,answers,score,submitted_at,receipt) VALUES('old-attempt','historic',$1,$2,1,now(),'original-receipt')",
      [JSON.stringify(questions), JSON.stringify({ 'old-q': 1 })],
    );
    await migrate(db);
    await migrate(db);
    const old = (
      await db.query<{
        competition_id: string;
        questions: unknown;
        answers: unknown;
        score: number;
        percentage: number;
        receipt: string;
      }>('SELECT * FROM attempts WHERE id=$1', ['old-attempt'])
    ).rows[0];
    assert.equal(old.competition_id, 'legacy-demo');
    assert.deepEqual(old.questions, questions);
    assert.deepEqual(old.answers, { 'old-q': 1 });
    assert.equal(old.score, 1);
    assert.equal(old.percentage, 100);
    assert.equal(old.receipt, 'original-receipt');
    await db.query("INSERT INTO competitions VALUES('future','{}',now())");
    await db.query(
      "INSERT INTO attempts(id,participant_id,competition_id,questions) VALUES('new-attempt','historic','future','[]')",
    );
    await assert.rejects(
      db.query(
        "INSERT INTO attempts(id,participant_id,competition_id,questions) VALUES('duplicate','historic','future','[]')",
      ),
    );
    assert.equal((await db.query('SELECT id FROM attempts')).rows.length, 2);
    assert.equal(
      (await db.query('SELECT id FROM schema_migrations')).rows.length,
      migrations.length,
    );
    assert.equal((await db.query('SELECT version FROM question_versions')).rows.length, 1);
  } finally {
    await db.close();
  }
});
