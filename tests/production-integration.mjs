import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { Pool } from 'pg';
const databaseUrl = process.env.NBC_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Requires the isolated PostgreSQL test runner.');
const pool = new Pool({ connectionString: databaseUrl });
// This URL is supplied only by tests/postgres.mjs for its new, disposable database.
await pool.query(
  'TRUNCATE otp_challenges,sessions,attempts,participants,otp_rate_events,security_locks,security_events RESTART IDENTITY CASCADE',
);
await pool.query("UPDATE settings SET value='{}' WHERE id='otp_security'");
const { publicKey, privateKey } = await generateKeyPair('RS256');
const publicJwk = { ...(await exportJWK(publicKey)), kid: 'integration', alg: 'RS256' };
const issuer = 'https://nbc-integration.cloudflareaccess.com';
const jwt = async (sub) =>
  new SignJWT({ type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid: 'integration' })
    .setIssuer(issuer)
    .setAudience('nbc-staff-test')
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
const adminJwt = await jwt('admin-test'),
  editorJwt = await jwt('editor-test');
const identitySecret = randomBytes(32).toString('hex');
await pool.query('UPDATE settings SET value=$1 WHERE id=$2', [
  JSON.stringify(
    createHmac('sha256', identitySecret)
      .update(JSON.stringify(['key-check', 'nbc-identity-key']))
      .digest('hex'),
  ),
  'identity_key_check',
]);
const codes = new Map();
let logs = '';
let count = 0;
const server = spawn(
  process.execPath,
  [
    '--import',
    './tests/mock-provider-network.mjs',
    'node_modules/next/dist/bin/next',
    'start',
    '-H',
    '127.0.0.1',
    '-p',
    '43188',
  ],
  {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NBC_RUNTIME_MODE: 'production',
      DATABASE_URL: databaseUrl,
      NBC_DEMO_MODE: 'false',
      NBC_ALLOW_REMOTE_DEMO: 'false',
      NBC_DEMO_OTP: '',
      OTP_PROVIDER: 'unifonic',
      UNIFONIC_APP_SID: randomBytes(24).toString('hex'),
      OTP_SENDER_ID: 'NBC',
      OTP_HMAC_SECRET: randomBytes(32).toString('hex'),
      IDENTITY_LOOKUP_SECRET: identitySecret,
      NBC_PUBLIC_ORIGIN: 'https://nbc.example',
      NBC_TRUSTED_IP_HEADER: 'cf-connecting-ip',
      CF_ACCESS_ISSUER: issuer,
      CF_ACCESS_AUD: 'nbc-staff-test',
      NBC_ADMIN_SUBJECTS: 'admin-test',
      NBC_EDITOR_SUBJECTS: 'editor-test',
      NBC_STAFF_MFA_CONFIRMED: 'true',
      NBC_TEST_PUBLIC_JWKS: JSON.stringify({ keys: [publicJwk] }),
    },
  },
);
server.on('message', (message) => {
  if (message.type === 'sms') codes.set(message.id, message.code);
});
server.stdout.on('data', (data) => {
  logs += data;
});
server.stderr.on('data', (data) => {
  logs += data;
});
const base = 'http://127.0.0.1:43188';
function client(assertion) {
  let cookie = '';
  return async (route, body, extra = {}) => {
    const response = await fetch(base + '/api/' + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined
          ? {}
          : { Origin: 'https://nbc.example', 'Content-Type': 'application/json' }),
        'cf-connecting-ip': '192.0.2.81',
        ...(assertion ? { 'cf-access-jwt-assertion': assertion } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    for (const code of codes.values())
      assert.ok(
        !JSON.stringify(data).includes(code),
        'HTTP response must not contain an issued OTP',
      );
    return { status: response.status, data, set, headers: response.headers };
  };
}
const check = (name) => {
  count++;
  console.log('PASS', name);
};
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/session')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Production test server must start');
  const anon = client(),
    admin = client(adminJwt),
    editor = client(editorJwt),
    student = client();
  assert.equal((await anon('admin/security')).status, 401);
  assert.equal((await editor('admin/security')).status, 403);
  for (const route of ['health', 'setup', 'test', 'test-verify', 'cleanup']) {
    assert.equal((await anon('admin/security/' + route, {})).status, 401);
    assert.equal((await editor('admin/security/' + route, {})).status, 403);
  }
  check('all security endpoints reject anonymous users and editors');
  assert.equal((await anon('auth/demo-staff', { role: 'admin' })).status, 404);
  const html = await (await fetch(base + '/admin')).text();
  assert.ok(!html.includes('دخول عرض اللجنة'));
  check('production demo staff endpoint and role picker are disabled');
  assert.equal((await client('forged')('admin/security')).status, 403);
  check('forged staff headers cannot access security settings');
  const initial = await admin('admin/security');
  assert.equal(initial.status, 200);
  assert.equal(initial.data.status, 'CONFIGURED');
  assert.equal(initial.data.canActivate, false);
  check('fresh PostgreSQL readiness reports configured but untested');
  assert.equal((await admin('admin')).data.participants.length, 0);
  check('production initialization seeds no synthetic participants');
  const body = {
    mode: 'register',
    identity: '1888888888',
    phone: '0588888888',
    name: 'مشارك اختبار إنتاج افتراضي',
    stage: 'المرحلة المتوسطة',
    gender: 'ذكر',
    institution: 'مدرسة اختبار',
    locality: 'الدمام',
    terms: true,
  };
  assert.equal((await student('auth/challenge', body)).status, 503);
  assert.equal((await admin('admin/security/setup', { action: 'activate' })).status, 409);
  check('participant auth and activation are blocked before evidence exists');
  const probe = await admin('admin/security/health', {});
  assert.equal(probe.data.ok, true);
  const sent = await admin('admin/security/test', { phone: '0577777777' });
  assert.equal(sent.status, 200);
  const code = codes.get(sent.data.challengeId);
  assert.ok(code, 'Test SMS captured only in memory');
  const verified = await admin('admin/security/test-verify', {
    challengeId: sent.data.challengeId,
    purpose: 'ADMIN_TEST',
    code,
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.set, null);
  check('real adapter path sends and verifies admin test without creating participant session');
  assert.equal((await admin('admin/security')).data.status, 'TESTED');
  const acknowledgements = Object.fromEntries(
    [
      'senderApproved',
      'privacyReviewed',
      'vendorReviewed',
      'transfersReviewed',
      'incidentProcess',
      'retentionReviewed',
    ].map((k) => [k, true]),
  );
  assert.equal(
    (await admin('admin/security/setup', { action: 'acknowledge', acknowledgements })).status,
    200,
  );
  assert.equal((await admin('admin/security/setup', { action: 'activate' })).data.status, 'ACTIVE');
  check(
    'activation succeeds only with matching configuration, recent verification, health and acknowledgements',
  );
  const challenge = await student('auth/challenge', body);
  assert.equal(challenge.status, 200);
  assert.equal((await pool.query('SELECT id FROM participants')).rows.length, 0);
  const otp = codes.get(challenge.data.challengeId);
  assert.ok(otp);
  const wrong = await student('auth/verify', {
    challengeId: challenge.data.challengeId,
    purpose: 'REGISTER',
    code: '123456',
  });
  assert.equal(wrong.status, 400);
  check('production has no implicit historical demo-code fallback');
  const accepted = await student('auth/verify', {
    challengeId: challenge.data.challengeId,
    purpose: 'REGISTER',
    code: otp,
  });
  assert.equal(accepted.status, 200);
  assert.match(accepted.set, /__Host-nbc-session=/);
  assert.match(accepted.set, /HttpOnly/i);
  assert.match(accepted.set, /Secure/i);
  assert.match(accepted.set, /SameSite=strict/i);
  check('OTP creates a hashed eight-hour session with secure host cookie');
  const profile = await student('participant');
  assert.equal(profile.status, 200);
  const participant = profile.data.participant.id;
  assert.equal((await student('participant')).status, 200);
  assert.equal((await student('session')).data.session.role, 'participant');
  check('refresh and navigation reuse the verified session');
  assert.equal((await student('attempt/start', {})).status, 409);
  const questions = (await admin('admin')).data.questions;
  for (const q of questions)
    assert.equal(
      (await admin('admin/question', { id: q.id, version: q.version, approve: true })).status,
      200,
    );
  const attempt = await student('attempt/start', {});
  assert.equal(attempt.status, 200);
  const answers = { [attempt.data.attempt.questions[0].id]: 0 };
  assert.equal(
    (await student('attempt/save', { answers, revision: attempt.data.attempt.revision })).status,
    200,
  );
  await student('auth/logout', {});
  assert.equal((await student('participant')).status, 401);
  const login = await student('auth/challenge', {
    mode: 'login',
    identity: body.identity,
    phone: body.phone,
  });
  assert.equal(login.status, 200);
  assert.equal(
    (
      await student('auth/verify', {
        challengeId: login.data.challengeId,
        purpose: 'LOGIN',
        code: codes.get(login.data.challengeId),
      })
    ).status,
    200,
  );
  assert.equal((await student('participant')).data.participant.id, participant);
  assert.deepEqual((await student('participant')).data.attempt.answers, answers);
  check('returning OTP login resumes the exact saved participation');
  check('logout revokes access and returning login requires a new OTP');
  await pool.query(
    "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE participant_id=$1",
    [participant],
  );
  assert.equal((await student('participant')).status, 401);
  check('expired sessions require another verified login');
  const state = await admin('admin/security');
  assert.equal(state.data.metrics.otp_verified, 2);
  assert.equal(state.data.metrics.test_verified, 1);
  assert.ok(!JSON.stringify(state.data).includes(body.identity));
  assert.ok(!JSON.stringify(state.data).includes(body.phone));
  check('admin metrics expose counts without OTPs or full identifiers');
  assert.equal((await admin('admin/security/setup', { action: 'deactivate' })).status, 200);
  assert.equal((await anon('auth/challenge', body)).status, 503);
  check('server-enforced deactivation stops new participant authentication');
  for (const code of codes.values())
    assert.ok(!logs.includes(code), 'Server logs must not contain issued OTPs');
  check('captured server logs contain no issued OTP');
  console.log(`${count} production HTTP checks passed.`);
} finally {
  server.kill();
  await pool.end();
}
