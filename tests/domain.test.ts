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
import { seedQuestions } from '../src/lib/seed';
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
