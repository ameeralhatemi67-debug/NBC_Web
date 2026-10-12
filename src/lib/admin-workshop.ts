// Pure rules for the committee question workshop. No React, no network: unit-tested.
import {
  hintTarget,
  type BookVersion,
  type CompetitionQuestion,
  type Stage,
} from './competition-domain';

// The hint is always the source page and the one before it. The stored start/end fields stay
// valid for validation and exports, so they are written on save instead of being edited by hand.
export function derivedHint(pdfPage: number | null) {
  const target = hintTarget({ pdfPage });
  if (!target) return { hintPdfPageStart: null, hintPdfPageEnd: null };
  const [start, end] = target;
  return { hintPdfPageStart: start, hintPdfPageEnd: end };
}
export function withDerivedHint<T extends Pick<CompetitionQuestion, 'pdfPage' | 'pdfPageEnd'>>(
  question: T,
) {
  const range = hintTarget(question);
  return { ...question, hintPdfPageStart: range?.[0] ?? null, hintPdfPageEnd: range?.[1] ?? null };
}

export type QuestionCheck = { id: string; ok: boolean; label: string };
export function questionChecks(
  q: Pick<
    CompetitionQuestion,
    'title' | 'options' | 'correctAnswers' | 'type' | 'pdfPage' | 'sourceKind' | 'sourceVerified'
  >,
  book: Pick<BookVersion, 'pageCount'>,
): QuestionCheck[] {
  const options = q.options.map((option) => option.trim());
  const distinct = options.every(Boolean) && new Set(options).size === options.length;
  const answers = q.correctAnswers.filter((n) => n >= 0 && n < q.options.length);
  const single = q.type === 'single_choice';
  const inside =
    q.pdfPage !== null &&
    Number.isInteger(q.pdfPage) &&
    q.pdfPage >= 1 &&
    q.pdfPage <= book.pageCount;
  const pending = q.sourceVerified === false || q.sourceKind === 'official';
  const last = inside && q.pdfPage === book.pageCount;
  return [
    {
      id: 'title',
      ok: q.title.trim().length >= 5,
      label: q.title.trim().length >= 5 ? 'نص السؤال مكتوب' : 'نص السؤال قصير جدًا',
    },
    {
      id: 'options',
      ok: distinct,
      label: distinct ? 'خيارات سليمة ومختلفة' : 'خيارات ناقصة أو مكررة',
    },
    {
      id: 'correct',
      ok: single ? answers.length === 1 : answers.length >= 1,
      label: single
        ? answers.length === 1
          ? 'إجابة صحيحة واحدة'
          : 'حدّد إجابة صحيحة واحدة'
        : answers.length >= 1
          ? 'إجابات صحيحة محددة'
          : 'حدّد إجابة صحيحة واحدة على الأقل',
    },
    {
      id: 'page',
      ok: inside || pending,
      label: pending
        ? 'مرجع المصدر مستقل أو بانتظار المراجعة'
        : inside
          ? 'الصفحة داخل الكتاب'
          : 'الصفحة خارج الكتاب',
    },
    {
      id: 'last-page',
      ok: !last,
      label: last ? 'آخر صفحة: اختر صفحة قبلها ليُفتح التلميح بعد تصفّحها' : 'التلميح يمكن فتحه',
    },
  ];
}
export const questionBlocked = (checks: QuestionCheck[]) => checks.some((check) => !check.ok);

export const fieldLabels: Partial<Record<keyof CompetitionQuestion, string>> = {
  stage: 'المرحلة',
  type: 'نوع السؤال',
  title: 'نص السؤال',
  options: 'الخيارات',
  correctAnswers: 'الإجابة الصحيحة',
  pdfPage: 'صفحة المصدر',
  printedPage: 'الصفحة المطبوعة',
  answerExplanation: 'التوضيح',
  topic: 'المحور',
  difficulty: 'الصعوبة',
  sourceExcerpt: 'شاهد المصدر',
  active: 'التفعيل',
  approved: 'الاعتماد',
  sourceKind: 'نوع المصدر',
  sourceUrl: 'رابط المصدر',
  sourceVerified: 'مراجعة المصدر',
  printedPageEnd: 'نهاية النطاق المطبوع',
  pdfPageEnd: 'نهاية نطاق PDF',
  preserveOptionOrder: 'ترتيب الخيارات',
};
export function changedFields(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
) {
  if (!previous) return ['إصدار أول'];
  return (Object.keys(fieldLabels) as (keyof CompetitionQuestion)[])
    .filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .map((key) => fieldLabels[key]!);
}

export type CoverageCell = { page: number; count: number; level: 0 | 1 | 2 | 3 };
// One cell per page. Three or more questions on one page is crowded.
export function coverageDensity(
  questions: Pick<CompetitionQuestion, 'stage' | 'active' | 'pdfPage'>[],
  pageCount: number,
  stage?: Stage | '',
): CoverageCell[] {
  const counts = new Map<number, number>();
  for (const q of questions)
    if (q.pdfPage !== null && q.active && (!stage || q.stage === stage))
      counts.set(q.pdfPage, (counts.get(q.pdfPage) ?? 0) + 1);
  return Array.from({ length: pageCount }, (_, i) => {
    const count = counts.get(i + 1) ?? 0;
    return { page: i + 1, count, level: Math.min(3, count) as 0 | 1 | 2 | 3 };
  });
}
export function coverageSummary(cells: CoverageCell[]) {
  return {
    empty: cells.filter((c) => c.count === 0).length,
    crowded: cells.filter((c) => c.count > 2).length,
  };
}

// Bulk approve: only unapproved active drafts, in list order. The caller stops on the first error.
export function approvable(questions: CompetitionQuestion[], selected: Set<string>) {
  return questions.filter((q) => selected.has(q.id) && !q.approved && q.active);
}
