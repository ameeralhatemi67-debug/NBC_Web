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
assert.match(home, /52,000/);
const pdf = await (await check('/documents/national-belonging.pdf', 200)).arrayBuffer();
assert.equal(
  createHash('sha256').update(Buffer.from(pdf)).digest('hex'),
  'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd',
);
await check('/books/ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd.pdf', 200);
await check('/pdfjs/pdf.worker.min.mjs', 200);
await check('/book', 200);
await check('/terms', 200);
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
