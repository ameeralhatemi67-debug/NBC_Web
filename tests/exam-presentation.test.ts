import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hintEligible,
  hintTarget,
  validateQuestion,
  type BookVersion,
} from '../src/lib/competition-domain';
import { competitionFixtures } from '../src/lib/competition-fixtures';
import { questionStatus, type ExamAttempt } from '../src/lib/exam-presentation';

test('hint remains locked through a normal source page, but a legacy last-page source unlocks on arrival', () => {
  assert.equal(hintEligible(10, { pdfPage: 10 }, 66), false);
  assert.equal(hintEligible(11, { pdfPage: 10 }, 66), true);
  assert.equal(hintEligible(65, { pdfPage: 66 }, 66), false);
  assert.equal(hintEligible(66, { pdfPage: 66 }, 66), true);
  assert.deepEqual(hintTarget({ pdfPage: 66 }), [65, 66]);
});
test('admin validation rejects a source on the last page with an Arabic correction', () => {
  const original = competitionFixtures[0];
  const book: BookVersion = {
    id: original.bookVersionId,
    title: 'test',
    url: '/fixture.pdf',
    sha256: 'a'.repeat(64),
    pageCount: 66,
    approved: true,
  };
  assert.doesNotThrow(() => validateQuestion(original, book));
  assert.throws(
    () =>
      validateQuestion(
        { ...original, pdfPage: 66, hintPdfPageStart: 65, hintPdfPageEnd: 66 },
        book,
      ),
    /اختر صفحة مصدر قبل الصفحة الأخيرة/,
  );
});
test('strip correctness requires a locked answer and server feedback', () => {
  const attempt = {
    answers: { q: { selected: [0], locked: false, checkedAt: null } },
    feedback: {},
  } as Pick<ExamAttempt, 'answers' | 'feedback'>;
  assert.equal(questionStatus(attempt, 'q'), 'unvisited');
  attempt.feedback.q = { isCorrect: true, correctAnswers: [1], explanation: 'server' };
  assert.equal(questionStatus(attempt, 'q'), 'unvisited');
  attempt.answers.q.locked = true;
  assert.equal(questionStatus(attempt, 'q'), 'correct');
  attempt.feedback.q.isCorrect = false;
  assert.equal(questionStatus(attempt, 'q'), 'incorrect');
  delete attempt.feedback.q;
  assert.equal(questionStatus(attempt, 'q'), 'pending');
});
