import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const base = 'http://127.0.0.1:43186';
const server = spawn(
  process.execPath,
  [
    '--import',
    './tests/mock-vercel-network.mjs',
    'node_modules/next/dist/bin/next',
    'start',
    '-H',
    '127.0.0.1',
    '-p',
    '43186',
  ],
  {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NBC_RUNTIME_MODE: 'production',
      VERCEL: '1',
      DATABASE_URL: '',
      NBC_STAFF_AUTH: 'vercel',
      VERCEL_APP_CLIENT_ID: 'test-client',
      NBC_STAFF_SESSION_SECRET: randomBytes(32).toString('hex'),
      NBC_VERCEL_ADMIN_SUBJECTS: 'owner',
      NBC_VERCEL_EDITOR_SUBJECTS: 'editor',
      NBC_STAFF_MFA_CONFIRMED: 'true',
      NBC_PUBLIC_ORIGIN: 'https://nbc.example',
    },
  },
);
let logs = '';
server.stdout.on('data', (d) => {
  logs += d;
});
server.stderr.on('data', (d) => {
  logs += d;
});
let count = 0;
const pass = (s) => {
  console.log('PASS', s);
  count++;
};
const request = (path, cookie = '', extra = {}) =>
  fetch(base + path, {
    redirect: 'manual',
    ...extra,
    headers: { Cookie: cookie, ...extra.headers },
  });
async function login(subject) {
  const start = await request('/api/staff/login');
  assert.equal(start.status, 307);
  const target = new URL(start.headers.get('location'));
  assert.equal(target.origin, 'https://vercel.com');
  assert.equal(target.searchParams.get('scope'), 'openid');
  const flow = start.headers.getSetCookie()[0].split(';')[0];
  const callback =
    '/api/staff/callback?' +
    new URLSearchParams({
      state: target.searchParams.get('state'),
      code: subject + '|' + target.searchParams.get('nonce'),
    });
  return request(callback, flow);
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request('/api/admin/session')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(ready, 'Server starts');
  const home = await request('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes('id="about"'));
  assert.ok(html.includes('تفاصيل الجوائز غير متاحة مؤقتًا'));
  pass('homepage and about remain available without production database');
  const admin = await request('/admin');
  assert.equal(admin.status, 200);
  const adminHtml = await admin.text();
  assert.ok(adminHtml.includes('تسجيل الدخول عبر Vercel'));
  assert.ok(!adminHtml.includes('دخول عرض اللجنة'));
  pass('production admin provides the real Vercel sign-in link');
  assert.equal((await request('/api/admin/security')).status, 401);
  assert.equal((await request('/api/admin/security', '__Host-nbc-staff=forged')).status, 401);
  const stranger = await login('stranger');
  assert.ok(stranger.headers.get('location').endsWith('?login=failed'));
  pass('anonymous, forged and unauthorized identities cannot enter admin');
  const invalid = await request('/api/staff/callback?code=forged&state=forged');
  assert.ok(invalid.headers.get('location').endsWith('?login=failed'));
  assert.ok(invalid.headers.get('set-cookie').includes('Max-Age=0'));
  pass('unsolicited callbacks fail and clear the pending OAuth flow');
  const signedIn = await login('owner');
  assert.equal(signedIn.headers.get('location'), 'https://nbc.example/admin');
  const set = signedIn.headers.getSetCookie().find((s) => s.startsWith('__Host-nbc-staff='));
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=strict', 'Path=/'])
    assert.ok(set.includes(flag));
  const cookie = set.split(';')[0];
  const status = await (await request('/api/admin/session', cookie)).json();
  assert.equal(status.session.role, 'admin');
  const setup = await request('/api/admin/security', cookie);
  assert.equal(setup.status, 200);
  const data = await setup.json();
  assert.equal(data.checks.databaseConnected, false);
  assert.equal(data.checks.staffAuthentication, true);
  pass('real OAuth callback opens admin readiness without a competition database');
  const editor = await login('editor');
  const editorCookie = editor.headers
    .getSetCookie()
    .find((s) => s.startsWith('__Host-nbc-staff='))
    .split(';')[0];
  assert.equal((await request('/api/admin/security', editorCookie)).status, 403);
  pass('Vercel editors remain barred from security settings');
  const post = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://nbc.example' },
    body: '{}',
  };
  assert.equal(
    (
      await request('/api/staff/logout', cookie, {
        ...post,
        headers: { ...post.headers, Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
  const logout = await request('/api/staff/logout', cookie, post);
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await request('/api/admin/security', cookie)).status, 401);
  pass('logout enforces Origin and revokes copied sessions at Vercel');
  assert.ok(!logs.includes('memory-only-'));
  assert.ok(!JSON.stringify(data).includes('access_token'));
  pass('tokens and secrets are absent from application logs and readiness');
  console.log(`${count} admin access checks passed.`);
} finally {
  server.kill();
}
