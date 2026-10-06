import assert from 'node:assert/strict';
import { after, before, beforeEach, test, mock } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { connectDatabase, type Database } from '../src/lib/database';
import { migrate, migrationsCurrent } from '../src/lib/migrations';
import { OtpService } from '../src/lib/otp';
import {
  identityLookup,
  keyedHash,
  normalizePhone,
  otpDigest,
  matchesOtp,
  type Purpose,
} from '../src/lib/otp-crypto';
import { UnifonicProvider, otpProvider, type OtpProvider } from '../src/lib/otp-provider';
import {
  acknowledgementKeys,
  configFingerprint,
  readiness,
  readSetup,
  saveSetup,
  updateSecurity,
} from '../src/lib/otp-readiness';
import { cleanupSecurity, rateLimit } from '../src/lib/security-store';
import { AppError } from '../src/lib/domain';
import { isProduction } from '../src/lib/runtime';
import { newSession } from '../src/lib/service';

let db: Database, service: OtpService;
const sent = new Map<string, string>();
let failed = false;
const provider: OtpProvider = {
  name: 'fake',
  async send(input) {
    if (failed) throw new Error('vendor failure');
    sent.set(input.id, input.code);
    return input.id;
  },
  async healthCheck() {
    return true;
  },
};
const body = (n = 1) => ({
  mode: 'register',
  identity: `1${String(n).padStart(9, '0')}`,
  phone: `05${String(n).padStart(8, '0')}`,
  name: 'اسم مشارك اختبار افتراضي',
  stage: 'المرحلة المتوسطة',
  gender: 'أنثى',
  institution: 'مدرسة افتراضية',
  locality: 'الدمام',
  terms: true,
});
const context = (n = 1) => ({ ip: `192.0.2.${n}` });
const verifyBody = (
  c: { challengeId: string; purpose: Purpose },
  code = sent.get(c.challengeId)!,
) => ({ challengeId: c.challengeId, purpose: c.purpose, code });
const rejectsCode = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (e: unknown) => e instanceof AppError && e.code === code);
before(async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  delete process.env.VERCEL;
  delete process.env.NBC_DEMO_OTP;
  process.env.OTP_PROVIDER = 'fake';
  if (process.env.NBC_TEST_DATABASE_URL)
    process.env.DATABASE_URL = process.env.NBC_TEST_DATABASE_URL;
  else {
    delete process.env.DATABASE_URL;
    process.env.NBC_DATA_DIR = await mkdtemp(path.join(tmpdir(), 'nbc-exam-security-test-'));
  }
  db = await connectDatabase();
  await migrate(db);
});
beforeEach(async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  process.env.OTP_PROVIDER = 'fake';
  delete process.env.NBC_DEMO_OTP;
  delete process.env.VERCEL;
  delete process.env.NBC_DEMO_MODE;
  delete process.env.NBC_ALLOW_REMOTE_DEMO;
  await db.exec(
    'TRUNCATE otp_challenges,sessions,attempts,participants,otp_rate_events,security_locks,security_events RESTART IDENTITY CASCADE',
  );
  await saveSetup(db, {});
  sent.clear();
  failed = false;
  service = new OtpService(db, provider);
});
after(async () => {
  await db?.close();
});
test('Saudi phones and Arabic/Persian digits normalize to E.164; invalid numbers rejected', () => {
  for (const phone of [
    '0551234567',
    '551234567',
    '966551234567',
    '+966551234567',
    '٠٥٥١٢٣٤٥٦٧',
    '۰۵۵۱۲۳۴۵۶۷',
    '+966 (55) 123-4567',
  ])
    assert.equal(normalizePhone(phone), '+966551234567');
  for (const phone of ['+1551234567', '0544', '+966451234567', 'a0551234567'])
    assert.throws(() => normalizePhone(phone));
});
test('keyed OTP digest binds challenge and purpose; identity is a keyed lookup', () => {
  const code = randomBytes(3).readUIntBE(0, 3).toString().slice(0, 6).padStart(6, '0');
  const digest = otpDigest('a', 'REGISTER', code);
  assert.ok(matchesOtp(digest, 'a', 'REGISTER', code));
  assert.ok(!matchesOtp(digest, 'b', 'REGISTER', code));
  assert.ok(!matchesOtp(digest, 'a', 'LOGIN', code));
  assert.match(identityLookup(body().identity), /^h1:[a-f0-9]{64}$/);
});
test('migrations are idempotent, current, and do not seed participants', async () => {
  await migrate(db);
  assert.ok(await migrationsCurrent(db));
  assert.equal((await db.query('SELECT * FROM participants')).rows.length, 0);
});
test('registration creates no participant/session until verification, stores no code or readable identity', async () => {
  const c = await service.challenge(body(), context());
  assert.equal((await db.query('SELECT * FROM participants')).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM sessions')).rows.length, 0);
  const storage = JSON.stringify((await db.query('SELECT * FROM otp_challenges')).rows);
  assert.ok(!storage.includes(sent.get(c.challengeId)!));
  assert.ok(!storage.includes(body().identity));
  assert.ok(!JSON.stringify(c).includes(sent.get(c.challengeId)!));
  const code = sent.get(c.challengeId)!.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const token = await service.verify(verifyBody(c, code), context());
  assert.ok(token);
  const p = (
    await db.query<{ identity: string; phone: string }>('SELECT identity,phone FROM participants')
  ).rows[0];
  assert.equal(p.phone, normalizePhone(body().phone));
  assert.equal(p.identity, identityLookup(body().identity));
  const sessions = (await db.query<{ token: string }>('SELECT token FROM sessions')).rows;
  assert.equal(sessions.length, 1);
  assert.notEqual(sessions[0].token, token);
  await rejectsCode(service.verify(verifyBody(c), context()), 'EXPIRED');
});
test('simultaneous verification creates exactly one participant and one session', async () => {
  const c = await service.challenge(body(), context());
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => service.verify(verifyBody(c), context())),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await db.query('SELECT id FROM participants')).rows.length, 1);
  assert.equal((await db.query('SELECT token FROM sessions')).rows.length, 1);
});
test('login mismatches are generic; a fresh OTP resumes the same participant', async () => {
  const c = await service.challenge(body(), context());
  await service.verify(verifyBody(c), context());
  const original = (await db.query<{ id: string }>('SELECT id FROM participants')).rows[0].id;
  const login = { mode: 'login', identity: body().identity, phone: body().phone };
  for (const invalid of [
    { ...login, phone: body(2).phone },
    { ...login, identity: body(2).identity },
  ])
    await rejectsCode(service.challenge(invalid, context()), 'LOGIN_MISMATCH');
  const next = await service.challenge(login, context());
  await service.verify(verifyBody(next), context());
  assert.equal((await db.query('SELECT id FROM participants')).rows.length, 1);
  assert.ok(
    (await db.query<{ participant_id: string }>('SELECT participant_id FROM sessions')).rows.every(
      (r) => r.participant_id === original,
    ),
  );
});
test('expired, wrong purpose, malformed and exhausted codes cannot authenticate', async () => {
  const c = await service.challenge(body(), context());
  await rejectsCode(service.verify({ ...verifyBody(c), purpose: 'LOGIN' }, context()), 'EXPIRED');
  await rejectsCode(service.verify(verifyBody(c, '12345'), context()), 'INVALID_CODE');
  const wrong = sent.get(c.challengeId) === '000000' ? '999999' : '000000';
  for (let i = 0; i < 5; i++)
    await rejectsCode(
      service.verify(verifyBody(c, wrong), context()),
      i === 4 ? 'EXHAUSTED' : 'INVALID_CODE',
    );
  await rejectsCode(service.verify(verifyBody(c), context()), 'EXHAUSTED');
  assert.equal(
    (await db.query<{ attempt_count: number }>('SELECT attempt_count FROM otp_challenges')).rows[0]
      .attempt_count,
    5,
  );
  const expired = await service.challenge(body(2), context(2));
  await db.query("UPDATE otp_challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [
    expired.challengeId,
  ]);
  await rejectsCode(service.verify(verifyBody(expired), context(2)), 'EXPIRED');
});
test('resend cooldown, old challenge invalidation and concurrent resend safety', async () => {
  const c = await service.challenge(body(), context());
  await rejectsCode(
    service.resend({ challengeId: c.challengeId, purpose: c.purpose }, context()),
    'COOLDOWN',
  );
  await db.query("UPDATE otp_challenges SET last_sent_at=now()-interval '61 seconds'");
  const r = await Promise.allSettled([
    service.resend({ challengeId: c.challengeId, purpose: c.purpose }, context()),
    service.resend({ challengeId: c.challengeId, purpose: c.purpose }, context()),
  ]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(sent.size, 2);
  await rejectsCode(service.verify(verifyBody(c), context()), 'EXPIRED');
  const next = r.find((x) => x.status === 'fulfilled')! as PromiseFulfilledResult<typeof c>;
  await service.verify(verifyBody(next.value), context());
});
test('new challenges invalidate earlier codes even without the resend endpoint', async () => {
  const old = await service.challenge(body(), context());
  await db.query("UPDATE otp_challenges SET last_sent_at=now()-interval '61 seconds'");
  const next = await service.challenge(body(), context());
  await rejectsCode(service.verify(verifyBody(old), context()), 'EXPIRED');
  await service.verify(verifyBody(next), context());
});
test('phone hourly and daily limits persist; IP request limits prevent pumping', async () => {
  for (let i = 0; i < 5; i++) {
    await service.challenge(body(), context(i + 1));
    await db.query("UPDATE otp_challenges SET last_sent_at=now()-interval '61 seconds'");
  }
  await rejectsCode(service.challenge(body(), context(8)), 'RATE_LIMITED');
  await db.query(
    "UPDATE otp_rate_events SET created_at=now()-interval '2 hours' WHERE key LIKE 'send:%'",
  );
  for (let i = 0; i < 5; i++) {
    await service.challenge(body(), context(i + 20));
    await db.query("UPDATE otp_challenges SET last_sent_at=now()-interval '61 seconds'");
  }
  await db.query(
    "UPDATE otp_rate_events SET created_at=now()-interval '2 hours' WHERE key LIKE 'send:%'",
  );
  await rejectsCode(service.challenge(body(), context(40)), 'RATE_LIMITED');
  for (let i = 0; i < 10; i++) await service.challenge(body(i + 100), context(99));
  await rejectsCode(service.challenge(body(200), context(99)), 'RATE_LIMITED');
});
test('rate reservation across competing callers permits exactly the configured quota', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 16 }, () => rateLimit(db, 'shared-key', [{ seconds: 600, max: 5 }])),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
});
test('send failure and ambiguous provider timeout never create users or sessions', async () => {
  failed = true;
  await rejectsCode(service.challenge(body(), context()), 'PROVIDER_FAILED');
  assert.equal((await db.query('SELECT * FROM sessions')).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM participants')).rows.length, 0);
  assert.equal(
    (await db.query<{ otp_digest: null }>('SELECT otp_digest FROM otp_challenges')).rows[0]
      .otp_digest,
    null,
  );
});
test('Unifonic contract uses documented HTTPS JSON; rejects errors, malformed success and timeouts without leaking vendor data', async () => {
  process.env.OTP_PROVIDER = 'unifonic';
  process.env.UNIFONIC_APP_SID = randomBytes(24).toString('hex');
  process.env.OTP_SENDER_ID = 'NBC';
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://el.cloud.unifonic.com/rest/SMS/messages');
    assert.equal(init?.redirect, 'error');
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.Recipient, '966500000001');
    assert.equal(payload.AppSid, process.env.UNIFONIC_APP_SID);
    assert.equal(payload.SenderID, 'NBC');
    assert.ok(payload.Body.includes('لتسجيل مشاركتك'));
    return Response.json({ success: true, data: { MessageID: 42, Status: 'Sent' } });
  };
  const input = {
    phone: normalizePhone(body().phone),
    id: 'test-id',
    code: '482719',
    purpose: 'REGISTER' as const,
  };
  assert.equal(await new UnifonicProvider(transport).send(input), '42');
  assert.equal(calls, 1);
  for (const response of [
    Response.json({ success: false, message: input.code }),
    Response.json({ success: true, data: { Status: 'Failed', MessageID: 42 } }),
    new Response('invalid', { status: 502 }),
  ]) {
    await assert.rejects(
      new UnifonicProvider(async () => response).send(input),
      (e) => e instanceof AppError && !e.message.includes(input.code),
    );
  }
  await rejectsCode(
    new UnifonicProvider(async () => {
      throw new Error(input.code);
    }).send(input),
    'PROVIDER_FAILED',
  );
});
test('production rejects fake provider, demo staff and missing database instead of falling back', async () => {
  process.env.NBC_RUNTIME_MODE = 'production';
  assert.ok(isProduction());
  assert.throws(() => otpProvider());
  assert.throws(() => new OtpService(db, provider));
  await assert.rejects(newSession('admin'));
  const url = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await assert.rejects(connectDatabase());
  } finally {
    if (url) process.env.DATABASE_URL = url;
  }
  process.env.NBC_RUNTIME_MODE = 'test';
  process.env.VERCEL = '1';
  assert.ok(isProduction());
  assert.throws(() => otpProvider());
  delete process.env.VERCEL;
});
test('admin test challenges bind the admin and never create participants or sessions', async () => {
  const c = await service.challenge(
    { phone: body().phone },
    { ...context(), actor: 'staff:a' },
    true,
  );
  await rejectsCode(
    service.verify(verifyBody(c), { ...context(), actor: 'staff:b' }, true),
    'EXPIRED',
  );
  await rejectsCode(service.verify(verifyBody(c), context()), 'EXPIRED');
  await service.verify(verifyBody(c), { ...context(), actor: 'staff:a' }, true);
  assert.ok((await readSetup(db)).testedAt);
  assert.equal((await db.query('SELECT * FROM participants')).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM sessions')).rows.length, 0);
  const r = await readiness(db);
  assert.equal(r.status, 'NOT_CONFIGURED');
  assert.equal(r.canActivate, false);
  await assert.rejects(updateSecurity(db, { action: 'activate' }, 'staff:a'));
});
test('readiness secrets never leave server; activation requires all checks and fresh matching test', async () => {
  process.env.NBC_RUNTIME_MODE = 'production';
  process.env.OTP_PROVIDER = 'unifonic';
  process.env.UNIFONIC_APP_SID = randomBytes(24).toString('hex');
  process.env.OTP_SENDER_ID = 'NBC';
  process.env.OTP_HMAC_SECRET = randomBytes(32).toString('hex');
  process.env.IDENTITY_LOOKUP_SECRET = randomBytes(32).toString('hex');
  process.env.NBC_PUBLIC_ORIGIN = 'https://nbc.example';
  process.env.CF_ACCESS_ISSUER = 'https://nbc-test.cloudflareaccess.com';
  process.env.CF_ACCESS_AUD = 'test-audience';
  process.env.NBC_ADMIN_SUBJECTS = 'staff-a';
  process.env.NBC_STAFF_MFA_CONFIRMED = 'true';
  process.env.NBC_TRUSTED_IP_HEADER = 'cf-connecting-ip';
  await db.query('UPDATE settings SET value=$1 WHERE id=$2', [
    JSON.stringify(keyedHash('key-check', 'nbc-identity-key', 'IDENTITY_LOOKUP_SECRET')),
    'identity_key_check',
  ]);
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 405 }),
  );
  try {
    await assert.rejects(updateSecurity(db, { action: 'activate' }, 'staff:a'));
    await updateSecurity(
      db,
      {
        action: 'acknowledge',
        acknowledgements: Object.fromEntries(acknowledgementKeys.map((k) => [k, true])),
      },
      'staff:a',
    );
    await saveSetup(db, {
      ...(await readSetup(db)),
      testedAt: new Date().toISOString(),
      testedFingerprint: configFingerprint(),
    });
    const status = await readiness(db);
    for (const secret of [
      process.env.OTP_HMAC_SECRET,
      process.env.IDENTITY_LOOKUP_SECRET,
      process.env.UNIFONIC_APP_SID,
    ])
      assert.ok(!JSON.stringify(status).includes(secret));
    if (db.kind === 'postgres') {
      assert.equal(status.canActivate, true);
      assert.equal((await updateSecurity(db, { action: 'activate' }, 'staff:a')).status, 'ACTIVE');
      process.env.OTP_SENDER_ID = 'NBC2';
      assert.notEqual((await readiness(db)).status, 'ACTIVE');
    } else {
      assert.equal(status.canActivate, false);
      await assert.rejects(updateSecurity(db, { action: 'activate' }, 'staff:a'));
    }
  } finally {
    fetchMock.mock.restore();
  }
});
test('retention removes expired sensitive payloads and counters; security events have no codes or identifiers', async () => {
  const c = await service.challenge(body(), context());
  const events = JSON.stringify((await db.query('SELECT * FROM security_events')).rows);
  assert.ok(!events.includes(sent.get(c.challengeId)!));
  assert.ok(!events.includes(body().identity));
  assert.ok(!events.includes(normalizePhone(body().phone)));
  await db.query("UPDATE otp_challenges SET expires_at=now()-interval '26 hours'");
  await db.query("UPDATE otp_rate_events SET created_at=now()-interval '26 hours'");
  await cleanupSecurity(db);
  assert.equal((await db.query('SELECT * FROM otp_challenges')).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM otp_rate_events')).rows.length, 0);
});
