import type { Stage } from './competition-domain';

// Pure rules for the verifiable prize draw. No database and no React: the same code runs on the
// server for the draw, in the browser for the committee's re-check, and in scripts/verify-draw.mjs
// for any witness holding the published verification file. Web Crypto only, so it runs everywhere.
export const DRAW_FORMAT = 'nbc-prize-draw/v1';
export const DRAW_ALGORITHM =
  'Fisher–Yates over the sorted pool. Step k draws the first 4 bytes of HMAC-SHA256(key=seed, message="<fingerprint>:<k>") as a big-endian uint32, with rejection sampling for an unbiased index. A drawn number whose phone group already won is skipped.';
export const DEFAULT_ALTERNATES = 2;
export const MAX_DRAW_PRIZES = 20;
export const MAX_ALTERNATES = 5;
export const MAX_PRIZE_LABEL = 80;

// `group` is the lowest participant number that shares the entry's phone. It lets a witness
// apply "one prize per phone" without the file carrying any phone number.
export type DrawPoolEntry = { number: string; group: string };
export type DrawStage = Stage | 'all';
export type DrawEntryRole = 'winner' | 'alternate';
export type DrawEntryStatus = 'pending' | 'confirmed' | 'unreachable' | 'ineligible';
export type DrawResult = {
  position: number;
  role: DrawEntryRole;
  prizeIndex: number | null;
  number: string;
};
export type VerificationFile = {
  format: typeof DRAW_FORMAT;
  drawId: string;
  competitionId: string;
  competitionTitle: string;
  stage: DrawStage;
  prizes: string[];
  alternates: number;
  criteria: string[];
  frozenAt: string;
  drawnAt: string;
  pool: DrawPoolEntry[];
  poolFingerprint: string;
  seedCommitment: string;
  seed: string;
  algorithm: string;
  results: DrawResult[];
};

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text: string) {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text)));
}
// Canonical pool text: one "<number> <group>" line per entry, sorted by number.
export function poolText(pool: DrawPoolEntry[]) {
  return [...pool]
    .sort((a, b) => byCodeUnit(a.number, b.number))
    .map((e) => `${e.number} ${e.group}`)
    .join('\n');
}
export const poolFingerprint = (pool: DrawPoolEntry[]) => sha256Hex(poolText(pool));

// Groups numbers by a private key (the phone) without exposing it.
export function groupPool(rows: { number: string; key: string }[]): DrawPoolEntry[] {
  const sorted = [...rows].sort((a, b) => byCodeUnit(a.number, b.number));
  const first = new Map<string, string>();
  for (const r of sorted) if (!first.has(r.key)) first.set(r.key, r.number);
  return sorted.map((r) => ({ number: r.number, group: first.get(r.key)! }));
}

export async function drawOrder(
  pool: DrawPoolEntry[],
  seed: string,
  fingerprint: string,
  want: number,
): Promise<DrawPoolEntry[]> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(seed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const word = async (step: number) =>
    new DataView(
      await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`${fingerprint}:${step}`)),
    ).getUint32(0);
  const a = [...pool].sort((x, y) => byCodeUnit(x.number, y.number));
  const out: DrawPoolEntry[] = [];
  const used = new Set<string>();
  let step = 0;
  for (let i = 0; out.length < want && i < a.length; i++) {
    const remaining = a.length - i;
    const limit = Math.floor(4294967296 / remaining) * remaining;
    let r: number;
    do r = await word(step++);
    while (r >= limit);
    const j = i + (r % remaining);
    [a[i], a[j]] = [a[j], a[i]];
    if (!used.has(a[i].group)) {
      used.add(a[i].group);
      out.push(a[i]);
    }
  }
  return out;
}
// The first `prizes` drawn numbers win in prize order; the rest form one ordered alternates queue.
export function assignResults(order: DrawPoolEntry[], prizes: number): DrawResult[] {
  return order.map((e, i) => ({
    position: i + 1,
    role: i < prizes ? 'winner' : 'alternate',
    prizeIndex: i < prizes ? i : null,
    number: e.number,
  }));
}

export type HolderEntry = {
  position: number;
  role: DrawEntryRole;
  prizeIndex: number | null;
  status: DrawEntryStatus;
  decidedAt: string | null;
};
export const failedStatus = (s: DrawEntryStatus) => s === 'unreachable' || s === 'ineligible';
// Who holds each prize now. Failures are replayed in the order they were recorded, and each one
// passes its prize to the next unused alternate, so a promotion never moves once it is made.
export function prizeHolders(prizes: number, entries: HolderEntry[]): (number | null)[] {
  const holders: (number | null)[] = Array.from(
    { length: prizes },
    (_, i) => entries.find((e) => e.role === 'winner' && e.prizeIndex === i)?.position ?? null,
  );
  const queue = entries
    .filter((e) => e.role === 'alternate')
    .sort((a, b) => a.position - b.position)
    .map((e) => e.position);
  const failures = entries
    .filter((e) => failedStatus(e.status))
    .sort((a, b) => byCodeUnit(a.decidedAt ?? '', b.decidedAt ?? '') || a.position - b.position);
  for (const f of failures) {
    const prize = holders.indexOf(f.position);
    if (prize !== -1) holders[prize] = queue.shift() ?? null;
    else {
      const queued = queue.indexOf(f.position);
      if (queued !== -1) queue.splice(queued, 1);
    }
  }
  return holders;
}

// A witness check: recompute every fingerprint and the whole order from the file alone.
export async function verifyDraw(file: VerificationFile) {
  const fingerprint = await poolFingerprint(file.pool);
  const commitment = await sha256Hex(file.seed);
  const order = await drawOrder(
    file.pool,
    file.seed,
    file.poolFingerprint,
    file.prizes.length * (1 + file.alternates),
  );
  const again = assignResults(order, file.prizes.length);
  return {
    poolMatches: fingerprint === file.poolFingerprint,
    seedMatches: commitment === file.seedCommitment,
    resultsMatch:
      again.length === file.results.length &&
      again.every(
        (r, i) =>
          r.number === file.results[i].number &&
          r.role === file.results[i].role &&
          r.prizeIndex === file.results[i].prizeIndex,
      ),
  };
}
