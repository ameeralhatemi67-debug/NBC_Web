import test from 'node:test';
import assert from 'node:assert/strict';
import {
  csvCell,
  normalizeDigits,
  publicQuestions,
  scoreAttempt,
  tieGroups,
  validateAnswers,
} from '../src/lib/domain';
import { prizeStages, mediaPrize, totalPrizes } from '../src/lib/content';
import { seedQuestions } from '../src/lib/seed';
import { defaultPrizes, prizeTotal, validatePrizes } from '../src/lib/prizes';
import {
  emptyFilters,
  filterParticipants,
  groupParticipants,
  registrationYear,
  scorePercentage,
  summarize,
  type AnalyticsParticipant,
} from '../src/lib/analytics';
test('prize validation preserves all six distinct ranks and computes the complete total', () => {
  const settings = structuredClone(defaultPrizes);
  settings.stages[0].awards = [5000, 3000, 2000, 900, 800, 700];
  settings.layout = 'ledger';
  assert.deepEqual(validatePrizes(settings), settings);
  assert.equal(prizeTotal(settings), 52400);
  for (const invalid of [-1, 2.5, NaN, Infinity, 10000001, '500']) {
    assert.throws(() => validatePrizes({ ...settings, mediaPrize: invalid }));
  }
  assert.throws(() => validatePrizes({ ...settings, stages: [{ name: 'غير صالح', awards: [1] }] }));
  assert.throws(() => validatePrizes({ ...settings, layout: 'invalid' }));
});
const analyticsPeople: AnalyticsParticipant[] = [
  {
    id: 'a',
    name: 'أ',
    gender: 'أنثى',
    institution: 'مدرسة أ',
    stage: 'ثانوي',
    region: 'الشرقية',
    locality: 'الخبر',
    score: 15,
    max_score: 20,
    submitted_at: '2026-10-01',
    created_at: '2026-01-01T00:00:00Z',
    attempt_id: 'a',
  },
  {
    id: 'b',
    name: 'ب',
    gender: 'ذكر',
    institution: 'مدرسة أ',
    stage: 'ثانوي',
    region: 'الشرقية',
    locality: 'الخبر',
    score: 0,
    max_score: 10,
    submitted_at: '2026-10-01',
    created_at: '2026-01-01T00:00:00Z',
    attempt_id: 'b',
  },
  {
    id: 'c',
    name: 'ج',
    gender: null,
    institution: null,
    stage: 'متوسط',
    region: 'الرياض',
    locality: 'الرياض',
    score: null,
    max_score: null,
    submitted_at: null,
    created_at: '2025-12-31T00:00:00Z',
    attempt_id: null,
  },
];
test('score analytics use attempt question counts, include zero, and exclude incomplete attempts', () => {
  assert.equal(scorePercentage(analyticsPeople[0]), 75);
  assert.equal(scorePercentage(analyticsPeople[1]), 0);
  assert.equal(scorePercentage(analyticsPeople[2]), null);
  assert.equal(summarize(analyticsPeople).average, 37.5);
  assert.equal(summarize([]).average, null);
});
test('combined filters and missing demographics retain the same cohort for UI and exports', () => {
  assert.equal(registrationYear('2025-12-31T22:00:00Z'), '2026');
  assert.equal(registrationYear('2025-12-31T20:00:00Z'), '2025');
  const filters = {
    ...emptyFilters,
    gender: 'أنثى',
    institution: 'مدرسة أ',
    locality: 'الخبر',
    year: '2026',
    status: 'completed',
    minScore: '70',
    maxScore: '80',
  };
  assert.deepEqual(
    filterParticipants(analyticsPeople, filters).map((p) => p.id),
    ['a'],
  );
  assert.deepEqual(
    filterParticipants(analyticsPeople, { ...emptyFilters, gender: 'غير مسجل' }).map((p) => p.id),
    ['c'],
  );
  assert.equal(
    filterParticipants(analyticsPeople, { ...emptyFilters, minScore: '0', maxScore: '0' }).length,
    1,
  );
  assert.equal(
    groupParticipants(analyticsPeople, 'gender').reduce((n, g) => n + g.total, 0),
    3,
  );
  assert.equal(
    filterParticipants(analyticsPeople, { ...emptyFilters, minScore: '80', maxScore: '70' }).length,
    0,
  );
});
test('Arabic and Persian digits retain identifier meaning', () => {
  assert.equal(normalizeDigits('١٢٣٠۹۸'), '123098');
});
test('participant projection excludes answer keys and approval fields', () => {
  for (const q of publicQuestions(seedQuestions)) {
    assert.equal('correct' in q, false);
    assert.equal('approved' in q, false);
  }
});
test('scoring uses the frozen form, including unanswered items', () => {
  assert.equal(scoreAttempt(seedQuestions, {}), 0);
  assert.equal(
    scoreAttempt(seedQuestions, Object.fromEntries(seedQuestions.map((q) => [q.id, q.correct]))),
    10,
  );
  assert.equal(scoreAttempt(seedQuestions, { q01: 0, q02: 0 }), 1);
});
test('reject forged questions, invalid indices, and non-object answers', () => {
  for (const a of [{ invented: 0 }, { q01: -1 }, { q01: 4 }, { q01: 0.5 }, { q01: '0' }, null, []])
    assert.throws(() => validateAnswers(seedQuestions, a));
});
test('ties depend only on scores, not submission times or order', () => {
  const rows = [
    { id: 'late', score: 10, submitted_at: '2026-09-10' },
    { id: 'early', score: 10, submitted_at: '2026-09-01' },
    { id: 'draft', score: 10, submitted_at: null },
  ];
  assert.deepEqual(tieGroups(rows), [{ score: 10, ids: ['late', 'early'] }]);
});
test('CSV escapes quotes and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('="unsafe"'), '"\'=\"\"unsafe\"\""');
  assert.equal(csvCell('مرحلة، محافظة'), '"مرحلة، محافظة"');
  assert.equal(csvCell(null), '""');
});

test('six awards per education stage reconcile to the supplied SAR 52,000 budget', () => {
  assert.deepEqual(
    prizeStages.map(({ awards }) => awards.length),
    [6, 6, 6],
  );
  assert.deepEqual(
    prizeStages.map(({ awards }) => awards.reduce((sum, award) => sum + award, 0)),
    [12000, 16500, 21000],
  );
  assert.equal(mediaPrize, 2500);
  assert.equal(totalPrizes, 52000);
});
