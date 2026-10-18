import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import type { Database } from '../src/lib/database';
import { migrate } from '../src/lib/migrations';
import { initializeCompetition } from '../src/lib/competition-service';
import { authenticateParticipant } from '../src/lib/participant-auth';
import { sessionFor, revokeSession } from '../src/lib/service';
import { identityLookup } from '../src/lib/otp-crypto';
import { arDigits } from '../src/lib/format';
import { AppError } from '../src/lib/domain';

const form = (n = 1, phone = '0551111000') => ({
  mode: 'register',
  identity: `1${String(n).padStart(9, '0')}`,
  phone,
  name: 'مشارك اختبار دخول مباشر',
  stage: 'المرحلة المتوسطة',
  gender: 'ذكر',
  institution: 'مدرسة اختبار',
  locality: 'الدمام',
  terms: true,
});
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
async function fixture(run: (db: Database) => Promise<void>) {
  const keys = [
    'NBC_RUNTIME_MODE',
    'NBC_OTP_ENABLED',
    'IDENTITY_LOOKUP_SECRET',
    'OTP_HMAC_SECRET',
    'OTP_PROVIDER',
    'VERCEL',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const globalDb = globalThis as unknown as { nbcDb?: Promise<Database> };
  const previousDb = globalDb.nbcDb;
  process.env.NBC_RUNTIME_MODE = 'test';
  delete process.env.VERCEL;
  process.env.NBC_OTP_ENABLED = 'false';
  process.env.IDENTITY_LOOKUP_SECRET = randomBytes(32).toString('hex');
  process.env.OTP_HMAC_SECRET = '';
  process.env.OTP_PROVIDER = '';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await initializeCompetition(db);
    globalDb.nbcDb = Promise.resolve(db);
    process.env.NBC_RUNTIME_MODE = 'production';
    await run(db);
  } finally {
    globalDb.nbcDb = previousDb;
    await db.close();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('direct entry creates secure participant sessions without OTP configuration, and restores the OTP gate', async () => {
  await fixture(async (db) => {
    const input = form();
    const token = await authenticateParticipant(db, input, 'register');
    assert.match(token, /^[a-f0-9]{64}$/);
    const participant = (
      await db.query<{ id: string; identity: string }>('SELECT id,identity FROM participants')
    ).rows[0];
    assert.equal(participant.identity, identityLookup(input.identity));
    const session = (
      await db.query<{ token: string; auth_source: string }>(
        'SELECT token,auth_source FROM sessions',
      )
    ).rows[0];
    assert.equal(session.token, createHash('sha256').update(token).digest('hex'));
    assert.equal(session.auth_source, 'direct');
    assert.equal((await db.query('SELECT id FROM otp_challenges')).rows.length, 0);
    assert.equal((await sessionFor(token))?.role, 'participant');
    const returning = await authenticateParticipant(
      db,
      { ...input, mode: 'login', identity: arDigits(input.identity), phone: arDigits(input.phone) },
      'login',
    );
    assert.equal((await sessionFor(returning))?.participant_id, participant.id);
    await assert.rejects(
      authenticateParticipant(db, { ...input, mode: 'login', phone: '0551111999' }, 'wrong-phone'),
      code('LOGIN_MISMATCH'),
    );
    process.env.NBC_OTP_ENABLED = 'true';
    assert.equal(await sessionFor(token), null);
    await assert.rejects(
      authenticateParticipant(db, input, 'disabled'),
      (error) => error instanceof AppError && error.status === 404,
    );
    process.env.NBC_OTP_ENABLED = 'false';
    await db.query("UPDATE sessions SET role='admin' WHERE token=$1", [session.token]);
    assert.equal(await sessionFor(token), null);
    await revokeSession(returning);
    assert.equal(await sessionFor(returning), null);
  });
});

test('direct registration retains validation, eligibility, duplicate identity and concurrent phone limits', async () => {
  await fixture(async (db) => {
    for (const [i, invalid] of [
      { role: 'admin' },
      { terms: false },
      { name: 'اسم' },
      { institution: '' },
      { locality: 'خارج القائمة' },
      { identity: 'invalid' },
    ].entries()) {
      await assert.rejects(
        authenticateParticipant(db, { ...form(), ...invalid }, `invalid-${i}`),
        AppError,
      );
    }
    assert.equal((await db.query('SELECT id FROM participants')).rows.length, 0);
    await db.query(
      "UPDATE competitions SET body=jsonb_set(body,'{maxPerPhone}','2') WHERE id='nbc-1448-2026'",
    );
    await authenticateParticipant(db, form(), 'first');
    await assert.rejects(
      authenticateParticipant(db, form(), 'duplicate'),
      code('REGISTRATION_UNAVAILABLE'),
    );
    const attempts = await Promise.allSettled([
      authenticateParticipant(db, form(2), 'second'),
      authenticateParticipant(db, form(3), 'third'),
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await db.query('SELECT id FROM participants')).rows.length, 2);
    const rejected = attempts.find((result) => result.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && code('PHONE_LIMIT')(rejected.reason));
    await db.query(
      "UPDATE competitions SET body=jsonb_set(body,'{registrationPaused}','true') WHERE id='nbc-1448-2026'",
    );
    await assert.rejects(
      authenticateParticipant(db, form(4, '0551111001'), 'paused'),
      code('REGISTRATION_CLOSED'),
    );
    assert.ok(
      await authenticateParticipant(db, { ...form(), mode: 'login' }, 'return-while-paused'),
    );
  });
});

test('direct login throttles failed attempts and never creates accounts or OTP challenges', async () => {
  await fixture(async (db) => {
    for (let i = 0; i < 10; i++)
      await assert.rejects(
        authenticateParticipant(db, { ...form(), mode: 'login' }, 'limited-ip'),
        code('LOGIN_MISMATCH'),
      );
    await assert.rejects(
      authenticateParticipant(db, { ...form(), mode: 'login' }, 'limited-ip'),
      code('RATE_LIMITED'),
    );
    assert.equal((await db.query('SELECT id FROM participants')).rows.length, 0);
    assert.equal((await db.query('SELECT token FROM sessions')).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM otp_challenges')).rows.length, 0);
  });
});
test('registration keeps a clean post link code for analytics and drops anything else', async () => {
  await fixture(async (db) => {
    await authenticateParticipant(
      db,
      { ...form(21, '0551111021'), source: ' X-Launch ' },
      '10.0.0.21',
    );
    await authenticateParticipant(
      db,
      { ...form(22, '0551111022'), source: '<script>' },
      '10.0.0.22',
    );
    await authenticateParticipant(db, form(23, '0551111023'), '10.0.0.23');
    const sources = (
      await db.query<{ source: string | null }>('SELECT source FROM participants')
    ).rows.map((r) => r.source);
    assert.deepEqual(sources.filter(Boolean), ['x-launch']);
    assert.equal(sources.length, 3);
    await assert.rejects(
      db.query("UPDATE participants SET source='Bad Code' WHERE source='x-launch'"),
      /check constraint/,
    );
  });
});
