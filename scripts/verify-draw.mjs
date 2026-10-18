// Witness check for an NBC prize draw. Needs only Node 18+ and the published verification file:
//   node scripts/verify-draw.mjs nbc-prize-draw-xxxx.json
// It recomputes the pool fingerprint, the seed commitment and the whole draw order, independently
// of the website's code, and exits with status 1 on any mismatch.
import { readFile } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';

const file = JSON.parse(await readFile(process.argv[2] ?? '', 'utf8'));
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const pool = [...file.pool].sort((a, b) => cmp(a.number, b.number));
const fingerprint = sha(pool.map((e) => `${e.number} ${e.group}`).join('\n'));
const word = (step) =>
  createHmac('sha256', Buffer.from(file.seed, 'utf8'))
    .update(`${file.poolFingerprint}:${step}`, 'utf8')
    .digest()
    .readUInt32BE(0);
const want = file.prizes.length * (1 + file.alternates);
const order = [];
const used = new Set();
for (let i = 0, step = 0; order.length < want && i < pool.length; i++) {
  const remaining = pool.length - i;
  const limit = Math.floor(4294967296 / remaining) * remaining;
  let r;
  do r = word(step++);
  while (r >= limit);
  const j = i + (r % remaining);
  [pool[i], pool[j]] = [pool[j], pool[i]];
  if (!used.has(pool[i].group)) (used.add(pool[i].group), order.push(pool[i].number));
}
const checks = [
  ['Pool fingerprint matches the frozen list', fingerprint === file.poolFingerprint],
  ['Revealed seed matches the commitment', sha(file.seed) === file.seedCommitment],
  [
    'Winners and alternates match, in order',
    order.join() === file.results.map((r) => r.number).join(),
  ],
];
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
console.log(`\n${file.pool.length} numbers in the pool. Drawn order:`);
order.forEach((n, i) =>
  console.log(
    `  ${i + 1}. ${n}${i < file.prizes.length ? `  winner: ${file.prizes[i]}` : '  alternate'}`,
  ),
);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
