import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  approvable,
  changedFields,
  coverageDensity,
  coverageSummary,
  derivedHint,
  questionBlocked,
  questionChecks,
  withDerivedHint,
} from '../src/lib/admin-workshop';
import {
  hintTarget,
  validateQuestion,
  type CompetitionQuestion,
} from '../src/lib/competition-domain';

const book = {
  id: 'b',
  title: 't',
  url: '/books/x.pdf',
  sha256: 'a'.repeat(64),
  pageCount: 66,
  approved: true,
};
const question = (patch: Partial<CompetitionQuestion> = {}): CompetitionQuestion =>
  ({
    id: 'q1',
    stage: 'middle',
    title: 'ما معنى الانتماء؟',
    type: 'single_choice',
    options: ['أ', 'ب', 'ج', 'د'],
    correct: 0,
    correctAnswers: [0],
    source: '',
    version: 1,
    approved: false,
    active: true,
    pdfPage: 10,
    printedPage: 6,
    hintPdfPageStart: 1,
    hintPdfPageEnd: 1,
    answerExplanation: '',
    topic: 'x',
    difficulty: 'easy',
    bookVersionId: 'b',
    sourceExcerpt: 'شاهد',
    ...patch,
  }) as CompetitionQuestion;

test('hint fields are derived from the source page and match the participant rule', () => {
  assert.deepEqual(derivedHint(10), { hintPdfPageStart: 9, hintPdfPageEnd: 10 });
  assert.deepEqual(derivedHint(1), { hintPdfPageStart: 1, hintPdfPageEnd: 1 });
  for (const page of [1, 2, 33, 65]) {
    const derived = derivedHint(page);
    assert.deepEqual(
      [derived.hintPdfPageStart, derived.hintPdfPageEnd],
      hintTarget({ pdfPage: page }),
    );
  }
});

test('a saved question keeps the stored hint fields valid whatever the editor had', () => {
  // The editor no longer has hint inputs. Whatever stale values the draft carried, saving rewrites
  // them to max(1, pdfPage - 1) and pdfPage, which the server-side validation accepts.
  const saved = withDerivedHint(question({ pdfPage: 30, hintPdfPageStart: 1, hintPdfPageEnd: 66 }));
  assert.equal(saved.hintPdfPageStart, 29);
  assert.equal(saved.hintPdfPageEnd, 30);
  assert.doesNotThrow(() => validateQuestion(saved, book));
  assert.doesNotThrow(() => validateQuestion(withDerivedHint(question({ pdfPage: 1 })), book));
});

test('the last page cannot be a source page (it could never unlock its hint)', () => {
  const last = question({ pdfPage: 66 });
  assert.throws(() => validateQuestion(withDerivedHint(last), book), /الصفحة الأخيرة/);
  const checks = questionChecks(last, book);
  assert.equal(checks.find((c) => c.id === 'last-page')!.ok, false);
  assert.equal(questionBlocked(checks), true);
});

test('validation chips', () => {
  assert.equal(questionBlocked(questionChecks(question(), book)), false);
  const dup = questionChecks(question({ options: ['أ', 'أ', 'ج', 'د'] }), book);
  assert.equal(dup.find((c) => c.id === 'options')!.ok, false);
  const empty = questionChecks(question({ options: ['أ', ' ', 'ج', 'د'] }), book);
  assert.equal(empty.find((c) => c.id === 'options')!.ok, false);
  const noAnswer = questionChecks(question({ correctAnswers: [] }), book);
  assert.equal(noAnswer.find((c) => c.id === 'correct')!.ok, false);
  const two = questionChecks(question({ correctAnswers: [0, 1] }), book);
  assert.equal(two.find((c) => c.id === 'correct')!.ok, false, 'one correct for single choice');
  const multi = questionChecks(question({ type: 'multi_select', correctAnswers: [0, 1] }), book);
  assert.equal(multi.find((c) => c.id === 'correct')!.ok, true);
  const outside = questionChecks(question({ pdfPage: 99 }), book);
  assert.equal(outside.find((c) => c.id === 'page')!.ok, false);
  assert.equal(
    questionChecks(question({ title: 'قصير' }), book).find((c) => c.id === 'title')!.ok,
    false,
  );
});

test('version history names what changed instead of dumping JSON', () => {
  const first = question();
  assert.deepEqual(changedFields(null, first), ['إصدار أول']);
  const next = { ...first, title: 'سؤال جديد؟', pdfPage: 12, approved: true };
  assert.deepEqual(changedFields(first, next), ['نص السؤال', 'صفحة المصدر', 'الاعتماد']);
  assert.deepEqual(changedFields(first, { ...first }), []);
});

test('coverage density: one cell per page, crowded from three questions', () => {
  const qs = [
    question({ id: 'a', pdfPage: 5 }),
    question({ id: 'b', pdfPage: 5 }),
    question({ id: 'c', pdfPage: 5 }),
    question({ id: 'd', pdfPage: 9, stage: 'highschool' }),
    question({ id: 'e', pdfPage: 9, active: false }),
  ];
  const cells = coverageDensity(qs, 66);
  assert.equal(cells.length, 66);
  assert.equal(cells[4].count, 3);
  assert.equal(cells[4].level, 3);
  assert.equal(cells[8].count, 1, 'inactive questions do not count');
  assert.equal(cells[0].level, 0);
  assert.deepEqual(coverageSummary(cells), { empty: 64, crowded: 1 });
  assert.equal(coverageDensity(qs, 66, 'highschool')[4].count, 0);
  assert.equal(coverageDensity(qs, 66, 'highschool')[8].count, 1);
});

test('bulk approve takes only selected active drafts, in list order', () => {
  const qs = [
    question({ id: 'a' }),
    question({ id: 'b', approved: true }),
    question({ id: 'c' }),
    question({ id: 'd', active: false }),
    question({ id: 'e' }),
  ];
  assert.deepEqual(
    approvable(qs, new Set(['a', 'b', 'd', 'e'])).map((q) => q.id),
    ['a', 'e'],
  );
  assert.deepEqual(approvable(qs, new Set()), []);
});
