import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import type { ExamAttempt } from '../src/lib/exam-presentation';
import {
  copyWithFallback,
  leaderboardModeLines,
  missedQuestions,
  revisitPages,
  selectedAnswerText,
} from '../src/lib/result-presentation';
import { verifyBookBytes } from '../src/lib/verified-book';
test('result review requires locked server feedback and visible score, deduplicates pages, and formats multi-select answers', () => {
  const question = (id: string, pdfPage: number) => ({
    id,
    pdfPage,
    title: id,
    options: ['ألف', 'باء', 'جيم'],
    version: 1,
    stage: 'middle' as const,
    type: 'multi_select' as const,
    printedPage: pdfPage - 2,
    hintPdfPageStart: pdfPage - 1,
    hintPdfPageEnd: pdfPage,
  });
  const attempt = {
    score: 1,
    questions: [
      question('wrong', 7),
      question('also-wrong', 7),
      question('earlier', 2),
      question('unlocked', 12),
      question('right', 14),
    ],
    answers: {},
    feedback: {},
  } as unknown as ExamAttempt;
  for (const q of attempt.questions) {
    attempt.answers[q.id] = { selected: [0, 2], locked: q.id !== 'unlocked', checkedAt: null };
    attempt.feedback[q.id] = {
      isCorrect: q.id === 'right',
      correctAnswers: [1],
      explanation: 'server',
    };
  }
  assert.deepEqual(
    missedQuestions(attempt).map((q) => q.id),
    ['wrong', 'also-wrong', 'earlier'],
  );
  assert.deepEqual(revisitPages(attempt), [2, 7]);
  assert.equal(selectedAnswerText(attempt.questions[0], [0, 2, 99, -1, 0.5]), 'ألف، جيم');
  assert.equal(selectedAnswerText(attempt.questions[0], []), 'لم تُحدَّد إجابة');
  attempt.score = null;
  assert.deepEqual(missedQuestions(attempt), []);
  assert.deepEqual(revisitPages(attempt), []);
});
test('all four committee leaderboard policies have the approved distinct copy', () => {
  assert.deepEqual(leaderboardModeLines, {
    hidden: 'لا تُعرض النتيجة ولا ترتيب المشاركين. تعتمد اللجنة الفائزين وتعلنهم بنفسها.',
    own_result_only: 'نتيجتك تظهر لك فقط. تعتمد اللجنة الفائزين وتعلنهم بنفسها.',
    publish_after_close:
      'يُعلن الترتيب بعد إغلاق المسابقة واعتماد اللجنة. التعادل لا يُحسم بسرعة المشاركة.',
    public_live: 'الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة.',
  });
});
test('copy falls back after clipboard refusal and never reports success if both paths fail', async () => {
  let legacy = 0;
  assert.equal(
    await copyWithFallback(
      'NBC-1',
      async (text) => assert.equal(text, 'NBC-1'),
      () => {
        legacy++;
        return true;
      },
    ),
    true,
  );
  assert.equal(legacy, 0);
  const refused = async () => {
    throw new Error('denied');
  };
  assert.equal(
    await copyWithFallback('NBC-1', refused, (text) => {
      assert.equal(text, 'NBC-1');
      legacy++;
      return true;
    }),
    true,
  );
  assert.equal(legacy, 1);
  assert.equal(await copyWithFallback('NBC-1', refused, () => false), false);
  assert.equal(
    await copyWithFallback('NBC-1', refused, () => {
      throw new Error('denied');
    }),
    false,
  );
});
test('shared book verifier rejects a modified byte even when the filename is unchanged', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const sha = createHash('sha256').update(bytes).digest('hex');
  assert.equal(await verifyBookBytes(bytes.buffer, sha), true);
  bytes[2] = 9;
  assert.equal(await verifyBookBytes(bytes.buffer, sha), false);
});
