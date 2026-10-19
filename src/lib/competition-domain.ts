import { AppError, type Question } from './domain';
import type { Eligibility } from './eligibility';
import type { ReadingProgress } from './reading-progress';

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
  // Books uploaded from the admin screen live in the database and are fetched in `parts`
  // chunks (each small enough for a serverless response). Absent for the bundled book.
  parts?: number;
  sizeBytes?: number;
};
export type CompetitionQuestion = Question & {
  stage: Stage;
  type: 'single_choice' | 'multi_select';
  correctAnswers: number[];
  pdfPage: number | null;
  pdfPageEnd?: number;
  printedPage: number | null;
  printedPageEnd?: number;
  hintPdfPageStart: number | null;
  hintPdfPageEnd: number | null;
  sourceKind?: 'book' | 'official';
  sourceUrl?: string;
  sourceRow?: string;
  sourceVerified?: boolean;
  preserveOptionOrder?: boolean;
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
  // Absent on campaigns created before this setting existed: default is الشرقية and its cities.
  eligibility?: Eligibility;
  // Registration controls (committee settings). Defaults: not paused, 3 participants per phone.
  registrationPaused?: boolean;
  maxPerPhone?: number;
  questionCounts?: Record<Stage, number>;
  answerMode?: 'per_question' | 'final_submission';
  readingRequired?: boolean;
};
export const meetingQuestionCounts: Record<Stage, number> = {
  middle: 20,
  highschool: 25,
  university: 30,
};
export const MAX_QUESTION_IMPORT = 75;
export function questionCount(c: Pick<Competition, 'questionCounts'> | undefined, stage: Stage) {
  return c?.questionCounts?.[stage] ?? 20;
}
export function finalSubmission(c: Pick<Competition, 'answerMode'>) {
  return c.answerMode === 'final_submission';
}
export function completedAnswers(questions: SafeQuestion[], answers: AnswerMap, final: boolean) {
  return questions.filter((q) =>
    final ? Boolean(answers[q.id]?.selected.length) : answers[q.id]?.locked,
  ).length;
}
export const DEFAULT_MAX_PER_PHONE = 3;
export type RegistrationState = {
  open: boolean;
  reason: 'paused' | 'closed' | null;
  maxPerPhone: number;
};
// Registration closes by itself once the competition closes; the committee can also pause it.
export function registrationState(c: Competition, now = Date.now()): RegistrationState {
  const state = effectiveState(c, now);
  const maxPerPhone = c.maxPerPhone ?? DEFAULT_MAX_PER_PHONE;
  if (state === 'CLOSED' || state === 'RESULTS_PUBLISHED')
    return { open: false, reason: 'closed', maxPerPhone };
  if (c.registrationPaused) return { open: false, reason: 'paused', maxPerPhone };
  return { open: true, reason: null, maxPerPhone };
}
export type SafeQuestion = Pick<
  CompetitionQuestion,
  | 'id'
  | 'title'
  | 'options'
  | 'version'
  | 'stage'
  | 'type'
  | 'pdfPage'
  | 'pdfPageEnd'
  | 'printedPage'
  | 'hintPdfPageStart'
  | 'hintPdfPageEnd'
  | 'sourceKind'
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
  practice?: import('./simulation-domain').PracticeStatus;
  testRun?: boolean;
  testQuestionSource?: 'bank' | 'synthetic';
  attempt: null | {
    id: string;
    questions: SafeQuestion[];
    reading?: ReadingProgress;
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
      pdfPageEnd,
      printedPage,
      hintPdfPageStart,
      hintPdfPageEnd,
      sourceKind,
    }) => ({
      id,
      title,
      options,
      version,
      stage,
      type,
      pdfPage,
      pdfPageEnd,
      printedPage,
      hintPdfPageStart,
      hintPdfPageEnd,
      sourceKind,
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
export function hintEligible(
  maxPageRead: number,
  question: Pick<SafeQuestion, 'pdfPage' | 'pdfPageEnd'>,
  pageCount?: number,
) {
  const end = question.pdfPageEnd ?? question.pdfPage;
  return end !== null && (maxPageRead > end || (end === pageCount && maxPageRead >= end));
}
export function hintTarget(
  question: Pick<SafeQuestion, 'pdfPage' | 'pdfPageEnd'>,
): [number, number] | null {
  return question.pdfPage === null
    ? null
    : question.pdfPageEnd !== undefined
      ? [question.pdfPage, question.pdfPageEnd]
      : [Math.max(1, question.pdfPage - 1), question.pdfPage];
}
export function validateQuestion(q: CompetitionQuestion, book: BookVersion, approving = false) {
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
  if (q.sourceKind && !['book', 'official'].includes(q.sourceKind)) fail('نوع المصدر غير صالح.');
  if (q.sourceVerified !== undefined && typeof q.sourceVerified !== 'boolean')
    fail('حالة مراجعة المصدر غير صالحة.');
  if (q.preserveOptionOrder !== undefined && typeof q.preserveOptionOrder !== 'boolean')
    fail('ترتيب الخيارات غير صالح.');
  if (q.sourceRow !== undefined && (typeof q.sourceRow !== 'string' || q.sourceRow.length > 300))
    fail('مرجع الملف غير صالح.');
  if (approving && q.sourceRow && q.sourceVerified !== true)
    fail('راجع مصدر السؤال وصفحاته قبل الاعتماد.');
  const pending = q.sourceVerified === false && !approving;
  if (q.sourceKind === 'official') {
    if (
      [q.pdfPage, q.printedPage, q.hintPdfPageStart, q.hintPdfPageEnd].some((p) => p !== null) ||
      q.pdfPageEnd !== undefined ||
      q.printedPageEnd !== undefined
    )
      fail('المصدر الرسمي لا يستخدم صفحات الكتاب.');
    if (!pending && (!q.sourceUrl || !/^https:\/\//.test(q.sourceUrl)))
      fail('أضف رابط المصدر الرسمي.');
  } else if (!pending) {
    if (
      ![q.pdfPage, q.hintPdfPageStart, q.hintPdfPageEnd].every(
        (p) => p !== null && Number.isInteger(p) && p >= 1 && p <= book.pageCount,
      )
    )
      fail('صفحة خارج نطاق الكتاب.');
    if (q.pdfPage === book.pageCount)
      fail('اختر صفحة مصدر قبل الصفحة الأخيرة من الكتاب حتى يمكن فتح التلميح بعد تصفّحها.');
    if (
      q.pdfPageEnd !== undefined &&
      (q.pdfPage === null ||
        !Number.isInteger(q.pdfPageEnd) ||
        q.pdfPageEnd < q.pdfPage ||
        q.pdfPageEnd >= book.pageCount ||
        q.pdfPageEnd - q.pdfPage > 1)
    )
      fail('نطاق صفحات PDF غير صالح.');
    if (
      q.printedPage === null
        ? q.pdfPage !== 1
        : !Number.isInteger(q.printedPage) || q.printedPage < 1 || q.printedPage > book.pageCount
    )
      fail('الصفحة المطبوعة مفقودة.');
    if (
      q.printedPageEnd !== undefined &&
      (!Number.isInteger(q.printedPageEnd) ||
        q.printedPage === null ||
        q.printedPageEnd < q.printedPage ||
        q.printedPageEnd > book.pageCount)
    )
      fail('نطاق الصفحات المطبوعة غير صالح.');
    if (
      q.hintPdfPageEnd === null ||
      q.hintPdfPageStart === null ||
      q.hintPdfPageEnd < q.hintPdfPageStart ||
      q.hintPdfPageEnd - q.hintPdfPageStart > 1
    )
      fail('التلميح يجب أن يشمل صفحة أو صفحتين.');
  }
  if (q.bookVersionId !== book.id) fail('نسخة الكتاب مختلفة.');
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) fail('الصعوبة غير صالحة.');
  for (const key of ['answerExplanation', 'topic', 'sourceExcerpt', 'source'] as const)
    if (typeof q[key] !== 'string' || q[key].length > 2000) fail('بيانات المصدر غير صالحة.');
  if (!pending && !q.sourceExcerpt.trim() && !q.fixture) fail('أضف شاهدًا من المصدر للمراجعة.');
  if (typeof q.active !== 'boolean') fail('حالة التفعيل غير صالحة.');
}
export function validateBank(
  questions: CompetitionQuestion[],
  book: BookVersion,
  allowFixtures = false,
  campaign?: Pick<Competition, 'questionCounts'>,
) {
  if (!book.approved || !/^[a-f0-9]{64}$/.test(book.sha256))
    throw new AppError('اعتمد نسخة الكتاب أولًا.', 409);
  for (const stage of stageKeys) {
    const bank = questions.filter((q) => q.stage === stage && q.active);
    const count = questionCount(campaign, stage);
    if (bank.length !== count || bank.some((q) => !q.approved))
      throw new AppError(`${stageNames[stage]}: يلزم ${count} سؤالًا معتمدًا بالضبط.`, 409);
    const titles = new Set<string>();
    for (const q of bank) {
      validateQuestion(q, book, true);
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
  campaign?: Pick<Competition, 'answerMode'>,
) {
  if (!['SELECT', 'CHECK', 'SUBMIT'].includes(event.kind)) throw new AppError('حدث غير صالح.');
  const final = campaign?.answerMode === 'final_submission';
  if (final && revision !== event.revision)
    throw new AppError('توجد نسخة أحدث على الخادم.', 409, 'REVISION_CONFLICT');
  if (final && event.kind === 'CHECK')
    throw new AppError('تُعتمد الإجابات عند الإرسال النهائي.', 409, 'FINAL_SUBMISSION_REQUIRED');
  if (event.kind === 'SUBMIT') {
    if (questions.some((q) => (final ? !answers[q.id]?.selected.length : !answers[q.id]?.locked)))
      throw new AppError('تحقق من كل الإجابات قبل الإرسال.', 409, 'INCOMPLETE');
    if (final) {
      answers = Object.fromEntries(
        questions.map((q) => [
          q.id,
          { selected: validateSelection(q, answers[q.id].selected), locked: true, checkedAt: now },
        ]),
      );
    }
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
  submitted = false,
): Record<string, Feedback> {
  if (finalSubmission(c) && !submitted) return {};
  // Legacy formal campaigns follow the same post-lock feedback policy.
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
// A participant's own position after submission; other entries are never part of it.
export type Standing = {
  stage: Stage;
  overall: { rank: number; total: number };
  city: { name: string; rank: number; total: number };
};
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
