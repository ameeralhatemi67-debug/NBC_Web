import { AppError, type Question } from './domain';

export const stageKeys = ['middle', 'highschool', 'university'] as const;
export type Stage = (typeof stageKeys)[number];
export const stageNames: Record<Stage, string> = {
  middle: 'المرحلة المتوسطة',
  highschool: 'المرحلة الثانوية',
  university: 'المرحلة الجامعية',
};
export function registeredStage(value: string): Stage {
  const stage = stageKeys.find((s) => value === s || value === stageNames[s]);
  if (!stage) throw new AppError('المرحلة المسجلة غير صالحة.', 409);
  return stage;
}
export type BookVersion = {
  id: string;
  title: string;
  url: string;
  sha256: string;
  pageCount: number;
  approved: boolean;
};
export type CompetitionQuestion = Question & {
  stage: Stage;
  type: 'single_choice' | 'multi_select';
  correctAnswers: number[];
  pdfPage: number;
  printedPage: number;
  hintPdfPageStart: number;
  hintPdfPageEnd: number;
  answerExplanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bookVersionId: string;
  sourceExcerpt: string;
  active: boolean;
  fixture?: boolean;
};
export type Competition = {
  id: string;
  title: string;
  state: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'RESULTS_PUBLISHED';
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  feedbackMode: 'formal' | 'educational';
  leaderboardMode: 'hidden' | 'own_result_only' | 'publish_after_close' | 'public_live';
  closingPolicy: 'immediate' | 'grace';
  graceMinutes: number;
  bookVersionId: string;
  frozenAt: string | null;
  version: number;
  fixture?: boolean;
};
export type SafeQuestion = Pick<
  CompetitionQuestion,
  | 'id'
  | 'title'
  | 'options'
  | 'version'
  | 'stage'
  | 'type'
  | 'pdfPage'
  | 'printedPage'
  | 'hintPdfPageStart'
  | 'hintPdfPageEnd'
>;
export type AnswerRecord = { selected: number[]; locked: boolean; checkedAt: string | null };
export type AnswerMap = Record<string, AnswerRecord>;
export type WriteEvent = {
  clientEventId: string;
  attemptId: string;
  kind: 'SELECT' | 'CHECK' | 'SUBMIT';
  questionId?: string;
  selected?: number[];
  revision: number;
};
export type Feedback = { isCorrect: boolean; correctAnswers: number[]; explanation: string };
export type CompetitionState = {
  participant: { name: string; stage: string };
  competition: Competition;
  book: BookVersion;
  published: boolean;
  testRun?: boolean;
  attempt: null | {
    id: string;
    questions: SafeQuestion[];
    answers: AnswerMap;
    feedback: Record<string, Feedback>;
    revision: number;
    submittedAt: string | null;
    participantNumber: string;
    receipt: string | null;
    score: number | null;
    maxScore: number;
    percentage: number | null;
    recoveryUntil: string | null;
  };
};
export function safeQuestions(questions: CompetitionQuestion[]): SafeQuestion[] {
  return questions.map(
    ({
      id,
      title,
      options,
      version,
      stage,
      type,
      pdfPage,
      printedPage,
      hintPdfPageStart,
      hintPdfPageEnd,
    }) => ({
      id,
      title,
      options,
      version,
      stage,
      type,
      pdfPage,
      printedPage,
      hintPdfPageStart,
      hintPdfPageEnd,
    }),
  );
}
export function effectiveState(c: Competition, now = Date.now()): Competition['state'] {
  if (c.state === 'DRAFT' || c.state === 'CLOSED' || c.state === 'RESULTS_PUBLISHED')
    return c.state;
  if (c.closesAt && now >= Date.parse(c.closesAt)) return 'CLOSED';
  if (c.state === 'SCHEDULED')
    return c.opensAt && now >= Date.parse(c.opensAt) ? 'OPEN' : 'SCHEDULED';
  return 'OPEN';
}
export function assertWindow(
  c: Competition,
  existing = false,
  now = Date.now(),
  recoveryUntil?: string | null,
) {
  if (existing && recoveryUntil && now <= Date.parse(recoveryUntil)) return;
  const state = effectiveState(c, now);
  if (state === 'OPEN') return;
  const close = c.closedAt ?? c.closesAt;
  if (
    existing &&
    state === 'CLOSED' &&
    c.closingPolicy === 'grace' &&
    close &&
    now <= Date.parse(close) + c.graceMinutes * 60000
  )
    return;
  throw new AppError(
    'المسابقة غير متاحة للإجابة الآن. تُحفظ الإجابات المعلقة للمراجعة التقنية.',
    409,
    'COMPETITION_CLOSED',
  );
}
export function hintEligible(maxPageRead: number, question: Pick<SafeQuestion, 'pdfPage'>) {
  return maxPageRead > question.pdfPage;
}
export function hintTarget(question: Pick<SafeQuestion, 'hintPdfPageStart' | 'hintPdfPageEnd'>) {
  return [question.hintPdfPageStart, question.hintPdfPageEnd];
}
export function validateQuestion(q: CompetitionQuestion, book: BookVersion) {
  const fail = (message: string): never => {
    throw new AppError(`${q.id || 'سؤال'}: ${message}`);
  };
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(q.id)) fail('معرّف السؤال غير صالح.');
  if (!stageKeys.includes(q.stage)) fail('مرحلة غير صالحة.');
  if (!['single_choice', 'multi_select'].includes(q.type)) fail('نوع السؤال غير صالح.');
  if (typeof q.title !== 'string' || q.title.trim().length < 5 || q.title.length > 1000)
    fail('نص السؤال غير صالح.');
  if (
    !Array.isArray(q.options) ||
    q.options.length < 2 ||
    q.options.length > 6 ||
    q.options.some((o) => typeof o !== 'string' || !o.trim() || o.length > 300)
  )
    fail('خيارات غير صالحة.');
  if (new Set(q.options.map((o) => o.trim())).size !== q.options.length) fail('خيارات مكررة.');
  if (
    !Array.isArray(q.correctAnswers) ||
    !q.correctAnswers.length ||
    new Set(q.correctAnswers).size !== q.correctAnswers.length ||
    q.correctAnswers.some((a) => !Number.isInteger(a) || a < 0 || a >= q.options.length) ||
    (q.type === 'single_choice' && q.correctAnswers.length !== 1)
  )
    fail('الإجابات الصحيحة غير صالحة.');
  if (
    ![q.pdfPage, q.hintPdfPageStart, q.hintPdfPageEnd].every(
      (p) => Number.isInteger(p) && p >= 1 && p <= book.pageCount,
    )
  )
    fail('صفحة خارج نطاق الكتاب.');
  if (!Number.isInteger(q.printedPage) || q.printedPage < 1 || q.printedPage > book.pageCount)
    fail('الصفحة المطبوعة مفقودة.');
  if (q.hintPdfPageEnd < q.hintPdfPageStart || q.hintPdfPageEnd - q.hintPdfPageStart > 1)
    fail('التلميح يجب أن يشمل صفحة أو صفحتين.');
  if (q.bookVersionId !== book.id) fail('نسخة الكتاب مختلفة.');
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) fail('الصعوبة غير صالحة.');
  for (const key of ['answerExplanation', 'topic', 'sourceExcerpt', 'source'] as const)
    if (typeof q[key] !== 'string' || q[key].length > 2000) fail('بيانات المصدر غير صالحة.');
  if (!q.sourceExcerpt.trim() && !q.fixture) fail('أضف شاهدًا من المصدر للمراجعة.');
  if (typeof q.active !== 'boolean') fail('حالة التفعيل غير صالحة.');
}
export function validateBank(
  questions: CompetitionQuestion[],
  book: BookVersion,
  allowFixtures = false,
) {
  if (!book.approved || !/^[a-f0-9]{64}$/.test(book.sha256))
    throw new AppError('اعتمد نسخة الكتاب أولًا.', 409);
  for (const stage of stageKeys) {
    const bank = questions.filter((q) => q.stage === stage && q.active);
    if (bank.length !== 20 || bank.some((q) => !q.approved))
      throw new AppError(`${stageNames[stage]}: يلزم 20 سؤالًا معتمدًا بالضبط.`, 409);
    const titles = new Set<string>();
    for (const q of bank) {
      validateQuestion(q, book);
      if (q.fixture && !allowFixtures)
        throw new AppError('الأسئلة التجريبية محظورة في النسخة الرسمية.', 409);
      const title = q.title.replace(/[\s\u064B-\u065Fـ.,،؟?!]/g, '');
      if (titles.has(title)) throw new AppError('توجد أسئلة متطابقة. راجع التغطية.', 409);
      titles.add(title);
    }
  }
}
export function validateSelection(
  q: CompetitionQuestion,
  selected: unknown,
  allowEmpty = false,
): number[] {
  if (
    !Array.isArray(selected) ||
    (!selected.length && !allowEmpty) ||
    new Set(selected).size !== selected.length ||
    selected.some((v) => !Number.isInteger(v) || v < 0 || v >= q.options.length) ||
    (q.type === 'single_choice' && selected.length !== 1 && !(allowEmpty && selected.length === 0))
  )
    throw new AppError('اختيار غير صالح.');
  return [...selected].sort((a, b) => a - b);
}
export function answerCorrect(q: CompetitionQuestion, selected: number[]) {
  return JSON.stringify([...q.correctAnswers].sort()) === JSON.stringify([...selected].sort());
}
export function applyEvent(
  questions: CompetitionQuestion[],
  answers: AnswerMap,
  revision: number,
  event: WriteEvent,
  now: string,
  creditedQuestions: string[] = [],
) {
  if (!['SELECT', 'CHECK', 'SUBMIT'].includes(event.kind)) throw new AppError('حدث غير صالح.');
  if (event.kind === 'SUBMIT') {
    if (questions.some((q) => !answers[q.id]?.locked))
      throw new AppError('تحقق من كل الإجابات قبل الإرسال.', 409, 'INCOMPLETE');
    const score = questions.reduce(
      (n, q) =>
        n + Number(creditedQuestions.includes(q.id) || answerCorrect(q, answers[q.id].selected)),
      0,
    );
    return { answers, score, percentage: (score / questions.length) * 100 };
  }
  const q = questions.find((q) => q.id === event.questionId);
  if (!q) throw new AppError('السؤال غير موجود.');
  const selected = validateSelection(q, event.selected, event.kind === 'SELECT');
  const old = answers[q.id];
  if (old?.locked) {
    if (event.kind === 'CHECK' && JSON.stringify(old.selected) === JSON.stringify(selected))
      return { answers };
    throw new AppError('الإجابة الأولى المثبتة هي المعتمدة.', 409, 'ANSWER_LOCKED');
  }
  if (event.kind === 'SELECT' && revision !== event.revision)
    throw new AppError('توجد نسخة أحدث على الخادم.', 409, 'REVISION_CONFLICT');
  return {
    answers: {
      ...answers,
      [q.id]: {
        selected,
        locked: event.kind === 'CHECK',
        checkedAt: event.kind === 'CHECK' ? now : null,
      },
    },
  };
}
export function feedbackFor(
  c: Competition,
  questions: CompetitionQuestion[],
  answers: AnswerMap,
): Record<string, Feedback> {
  if (c.feedbackMode !== 'educational') return {};
  return Object.fromEntries(
    questions
      .filter((q) => answers[q.id]?.locked)
      .map((q) => [
        q.id,
        {
          isCorrect: answerCorrect(q, answers[q.id].selected),
          correctAnswers: q.correctAnswers,
          explanation: q.answerExplanation,
        },
      ]),
  );
}
export type LeaderboardEntry = {
  participantNumber: string;
  score: number;
  maxScore: number;
  percentage: number;
  rank: number;
};
export function rankResults(rows: Omit<LeaderboardEntry, 'rank'>[]): LeaderboardEntry[] {
  const sorted = [...rows].sort(
    (a, b) => b.percentage - a.percentage || a.participantNumber.localeCompare(b.participantNumber),
  );
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.percentage !== sorted[i - 1].percentage) rank = i + 1;
    return { ...row, rank };
  });
}
