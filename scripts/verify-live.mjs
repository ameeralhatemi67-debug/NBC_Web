import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const origin = 'https://nbc-web-two.vercel.app';
let checks = 0;
async function check(path, status, options) {
  const response = await fetch(origin + path, {
    signal: AbortSignal.timeout(30000),
    ...options,
  });
  assert.equal(response.status, status, path);
  console.log(`PASS ${path} HTTP ${status}`);
  checks++;
  return response;
}
const home = await (await check('/', 200)).text();
assert.match(home, /٥٢٬٠٠٠/);
assert.ok(
  !home.includes('تعذّر تحميل هذه المساحة.'),
  'Homepage must render, not its error boundary',
);
const auth = await (await check('/api/session', 200)).json();
const status = await (await check('/api/status', 200)).json();
assert.ok(status.state, 'Live competition status must be available');
assert.ok(
  home.includes(`data-state="${status.state}"`),
  'Homepage must render live competition status',
);
for (const path of [
  '/register',
  '/register?mode=login',
  '/book',
  '/terms',
  '/privacy',
  '/winners',
  '/participate',
  '/admin',
]) {
  const html = await (await check(path, 200)).text();
  if (path === '/register' && auth.otpEnabled === false) {
    assert.match(html, /سجّل وابدأ المشاركة/);
    assert.doesNotMatch(html, /متابعة إلى التحقق|خدمة التحقق قيد الإعداد/);
  }
  assert.ok(
    !html.includes('تعذّر تحميل هذه المساحة.'),
    `${path} must render, not its error boundary`,
  );
}
const registration = await (await check('/api/registration-options', 200)).json();
assert.equal(registration.cities['الشرقية'].length, 12);
assert.ok(registration.cities['الشرقية'].includes('الدمام'));
await check('/api/site-content', 200);
await check('/api/winners', 200);
if (auth.otpEnabled === false) {
  for (const path of ['/api/auth/challenge', '/api/auth/resend', '/api/auth/verify']) {
    const blocked = await check(path, 503, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal((await blocked.json()).code, 'OTP_DISABLED');
  }
  const invalidRegistration = await check('/api/auth/direct', 400, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{"mode":"register"}',
  });
  assert.doesNotMatch((await invalidRegistration.json()).error, /خدمة التحقق قيد الإعداد/);
}
const pdf = await (await check('/documents/national-belonging.pdf', 200)).arrayBuffer();
assert.equal(
  createHash('sha256').update(Buffer.from(pdf)).digest('hex'),
  'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd',
);
await check('/books/ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd.pdf', 200);
await check('/pdfjs/pdf.worker.min.mjs', 200);
await check('/api/admin', 401);
await check('/api/admin/backend', 401);
await check('/api/admin/prizes', 404);
await check('/api/admin/security', 401);
await check('/api/participant', 401);
await check('/api/leaderboard?stage=middle', 403);
await check('/api/auth/demo-staff', 404, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: '{}',
});
await check('/api/admin/prizes', 403, {
  method: 'POST',
  headers: { Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' },
  body: '{}',
});
console.log(
  `${checks} read-only/live authorization checks passed; prize total and exact PDF hash verified.`,
);
