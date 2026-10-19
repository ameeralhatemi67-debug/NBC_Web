import assert from 'node:assert/strict';
import { test } from 'node:test';
import jsQR from 'jsqr';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { cleanSource } from '../src/lib/analytics-insights';
import { stageNames } from '../src/lib/competition-domain';
import type { AnalyticsParticipant } from '../src/lib/analytics';
import type { Competition } from '../src/lib/competition-domain';
import { defaultPrizes, prizeTotal } from '../src/lib/prizes';
import { posterFormats, posterFormat, shapeOf } from '../src/lib/media/formats';
import {
  CITIES,
  countOf,
  freshness,
  mediaFacts,
  PEOPLE,
  pluralNoun,
  publicCount,
  SCHOOL_FLOOR,
} from '../src/lib/media/facts';
import {
  displayLink,
  newPostCode,
  postLink,
  siteBase,
  PRODUCTION_SITE,
} from '../src/lib/media/codes';
import { qrMatrix, qrPaths, qrStyles, sealStart, SEAL_SIZE } from '../src/lib/media/qr';
import { MediaLog, MEDIA_LOG_LIMIT, readMediaPosts, validateMediaPost } from '../src/lib/media-log';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee@example.test' };

test('poster formats keep their platform sizes and shapes', () => {
  assert.deepEqual(
    posterFormats.map((f) => [f.id, f.w, f.h, f.shape]),
    [
      ['square', 1080, 1080, 'square'],
      ['portrait', 1080, 1350, 'portrait'],
      ['story', 1080, 1920, 'tall'],
      ['landscape', 1600, 900, 'wide'],
      ['link', 1200, 630, 'wide'],
    ],
  );
  for (const f of posterFormats) assert.equal(shapeOf(f.w, f.h), f.shape);
  assert.equal(posterFormat('unknown').id, 'square');
});

function person(i: number, over: Partial<AnalyticsParticipant> = {}): AnalyticsParticipant {
  return {
    id: `p${i}`,
    name: `مشارك ${i}`,
    stage: stageNames.highschool,
    institution: null,
    gender: null,
    region: 'الشرقية',
    locality: 'الدمام',
    score: null,
    max_score: null,
    submitted_at: null,
    attempt_id: null,
    created_at: '2026-10-10T09:00:00Z',
    ...over,
  };
}

test('facts count today in Riyadh time and the days left to the close', () => {
  // 22:30 UTC on the 18th is already the 19th in Riyadh (UTC+3).
  const now = Date.parse('2026-10-18T22:30:00Z');
  const people = [
    person(1, { created_at: '2026-10-18T21:30:00Z' }), // 19th, 00:30 Riyadh
    person(2, { created_at: '2026-10-18T20:00:00Z' }), // 18th, 23:00 Riyadh
    person(3, { created_at: '2026-10-12T09:00:00Z' }), // a week before: outside the 7 days
  ];
  const competition = {
    state: 'OPEN',
    opensAt: '2026-10-01T06:00:00Z',
    closesAt: '2026-10-22T20:59:00Z', // 22nd 23:59 Riyadh
  } as Competition;
  const facts = mediaFacts({ people, competition, prizes: defaultPrizes, now });
  assert.equal(facts.today, 1);
  assert.equal(facts.week.length, 7);
  assert.equal(facts.week[6].day, '2026-10-19');
  assert.equal(facts.weekTotal, 2);
  assert.equal(facts.daysLeft, 3);
  assert.equal(facts.hoursLeft, 94);
  assert.equal(facts.prizeTotal, prizeTotal(defaultPrizes));
  assert.equal(facts.firstPrizes.length, defaultPrizes.stages.length);
  const closed = mediaFacts({
    people,
    competition: { ...competition, closesAt: '2026-10-01T00:00:00Z' },
    now,
  });
  assert.equal(closed.daysLeft, null);
  assert.equal(closed.hoursLeft, null);
});

test('small groups are never printed as a number and schools need ten participants', () => {
  assert.equal(publicCount(3), 'أقل من ٥');
  assert.equal(publicCount(0), '٠');
  assert.equal(publicCount(1250), (1250).toLocaleString('ar-SA'));
  const people = [
    ...Array.from({ length: SCHOOL_FLOOR }, (_, i) =>
      person(i, {
        institution: 'ثانوية الملك عبدالعزيز',
        submitted_at: i < 4 ? '2026-10-11' : null,
      }),
    ),
    ...Array.from({ length: SCHOOL_FLOOR - 1 }, (_, i) =>
      person(100 + i, { institution: 'ثانوية الخبر', locality: 'الخبر' }),
    ),
  ];
  const facts = mediaFacts({ people, now: Date.parse('2026-10-19T10:00:00Z') });
  assert.deepEqual(
    facts.schools.map((s) => s.name),
    ['ثانوية الملك عبدالعزيز'],
  );
  assert.equal(facts.institutions, 2);
  assert.deepEqual(
    facts.cities.map((c) => c.name),
    ['الدمام', 'الخبر'],
  );
  assert.equal(mediaFacts({ people: people.slice(0, 3), now: 0 }).completionRate, null);
});

test('counts agree with their nouns and never show a small group', () => {
  assert.equal(countOf(1, CITIES, false), 'مدينة واحدة');
  assert.equal(countOf(2, CITIES, false), 'مدينتين');
  assert.equal(countOf(3, CITIES, false), '٣ مدن ومحافظات');
  assert.equal(countOf(12, CITIES, false), '١٢ مدينة ومحافظة');
  assert.equal(countOf(17, PEOPLE), '١٧ مشاركًا ومشاركة');
  assert.equal(countOf(100, PEOPLE), '١٠٠ مشارك ومشاركة');
  assert.equal(countOf(103, PEOPLE), '١٠٣ مشاركين ومشاركات');
  assert.equal(countOf(3, PEOPLE), 'أقل من ٥ مشاركين ومشاركات');
  assert.equal(countOf(1250, PEOPLE), `${(1250).toLocaleString('ar-SA')} مشاركًا ومشاركة`);
  assert.equal(pluralNoun(17, PEOPLE), 'مشاركًا ومشاركة');
  assert.equal(pluralNoun(4, PEOPLE), 'مشاركين ومشاركات');
  // "·" beside Arabic-Indic digits reads as a zero, so the stamp uses a comma.
  assert.doesNotMatch(freshness(Date.parse('2026-10-19T15:00:00Z')), /·/);
});

test('post codes are valid link codes and links carry them', () => {
  let seed = 0.1;
  const random = () => (seed = (seed * 9301 + 0.49297) % 1);
  for (const template of ['milestone', 'chart', 'Gate Of Knowledge!', '']) {
    const code = newPostCode(template, random);
    assert.equal(cleanSource(code), code, code);
    assert.match(code, /^m-/);
  }
  assert.equal(siteBase('http://127.0.0.1:3000'), PRODUCTION_SITE);
  assert.equal(siteBase('https://nbc.example.sa/'), 'https://nbc.example.sa');
  assert.equal(
    postLink('https://nbc.example.sa', 'register', 'm-milestone-k7q2'),
    'https://nbc.example.sa/register?ref=m-milestone-k7q2',
  );
  assert.equal(postLink('https://nbc.example.sa', 'home', 'BAD CODE'), 'https://nbc.example.sa/');
  assert.equal(displayLink('https://nbc.example.sa/?ref=m-a-b'), 'nbc.example.sa?ref=m-a-b');
});

// Draw the matrix as pixels (4-module quiet zone) and read it back with a real decoder.
function decode(matrix: boolean[][], cleared?: { start: number; size: number }) {
  const scale = 6,
    quiet = 4,
    n = matrix.length,
    size = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const hole =
        cleared &&
        r >= cleared.start &&
        r < cleared.start + cleared.size &&
        c >= cleared.start &&
        c < cleared.start + cleared.size;
      if (!matrix[r][c] || hole) continue;
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return jsQR(data, size, size)?.data;
}

test('QR codes decode back to the tracked link, including the cleared seal centre', () => {
  const link = 'https://nbc-web-two.vercel.app/register?ref=m-milestone-k7q2';
  assert.equal(decode(qrMatrix(link, 'Q')), link);
  const sealed = qrMatrix(link, 'H');
  const n = sealed.length;
  assert.equal(decode(sealed, { start: sealStart(n), size: SEAL_SIZE }), link);
  for (const style of qrStyles) {
    const paths = qrPaths(sealed, style.id);
    assert.equal(paths.size, n);
    assert.ok(paths.modules.length > 100 && paths.eyes.startsWith('M'), style.id);
    assert.equal(Boolean(paths.seal), style.id === 'seal');
  }
});

test('the media log validates, records re-exports and caps its length', async () => {
  assert.throws(() => validateMediaPost({ action: 'record', code: 'BAD CODE' }), /رمز/);
  assert.throws(
    () =>
      validateMediaPost({
        action: 'record',
        code: 'm-x-1234',
        template: 'milestone',
        title: 'محطة',
        format: 'square',
        target: 'register',
        link: 'javascript:alert(1)',
      }),
    /رابط/,
  );
  assert.throws(() => validateMediaPost({ action: 'record', extra: 1 }), /غير مسموحة/);
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    let now = Date.parse('2026-10-19T10:00:00Z');
    const log = new MediaLog(db, () => now);
    await assert.rejects(log.list(null), /سجّل الدخول/);
    await assert.rejects(log.record({ role: 'editor', participant_id: null }, {}), /صلاحية/);
    const body = {
      action: 'record',
      code: 'm-milestone-k7q2',
      template: 'milestone',
      title: 'محطة جديدة',
      format: 'square',
      target: 'register',
      link: 'https://nbc-web-two.vercel.app/register?ref=m-milestone-k7q2',
      facts: { total: '١٬٢٥٠', nested: { no: 1 } },
      texts: { title: 'مشاركًا ومشاركة يقرؤون معنا' },
      style: 'original/dark/mihrab',
    };
    const first = await log.record(admin, body);
    assert.equal(first.exports, 1);
    assert.deepEqual(first.facts, { total: '١٬٢٥٠' });
    assert.equal(first.texts.title, 'مشاركًا ومشاركة يقرؤون معنا');
    await assert.rejects(log.record(admin, { ...body, style: '<script>' }), /نمط/);
    now += 60_000;
    const again = await log.record(admin, { ...body, format: 'story' });
    assert.equal(again.exports, 2);
    assert.deepEqual(again.formats, ['square', 'story']);
    assert.equal(again.createdAt, first.createdAt);
    assert.equal((await log.list(admin)).posts.length, 1);
    for (let i = 0; i < MEDIA_LOG_LIMIT + 5; i++)
      await log.record(admin, { ...body, code: `m-bulk-${i}` });
    const posts = await readMediaPosts(db);
    assert.equal(posts.length, MEDIA_LOG_LIMIT);
    assert.equal(posts[0].code, `m-bulk-${MEDIA_LOG_LIMIT + 4}`);
    const audit = await db.query<{ n: string }>(
      "SELECT count(*) AS n FROM audit WHERE action='تصدير منشور'",
    );
    assert.equal(Number(audit.rows[0].n), MEDIA_LOG_LIMIT + 7);
  } finally {
    await db.close();
  }
});
