import type { SafeQuestion } from './competition-domain';

export const READING_MIN_SOURCE_SECONDS = 5;
export type ReadingProgress = { pageSeconds: Record<number, number> };
export type ReadingVisit = {
  page: number;
  active: boolean;
  acceptedAt: number;
  creditedSeconds: number;
  flags: string[];
};

export function readingVisit(
  previous: ReadingVisit | undefined,
  page: number,
  active: boolean,
  now: number,
): ReadingVisit {
  const elapsed = previous ? (now - previous.acceptedAt) / 1000 : 0;
  const changed = previous && previous.page !== page;
  const flags =
    previous && previous.active && active && changed
      ? [
          ...(Math.abs(previous.page - page) > 1 ? ['page_jump'] : []),
          ...(elapsed < 2 ? ['rapid_page_turn'] : []),
        ]
      : [];
  return {
    page,
    active,
    acceptedAt: now,
    // Server receipt time bounds credit. Delayed/offline batches cannot invent dwell time.
    creditedSeconds:
      previous?.active && active && !changed && elapsed > 0 && elapsed <= 8
        ? Math.min(elapsed, 3)
        : 0,
    flags,
  };
}

export function sourceReadingReady(
  progress: ReadingProgress | undefined,
  question: Pick<SafeQuestion, 'pdfPage' | 'pdfPageEnd'>,
) {
  if (question.pdfPage === null) return true;
  for (let page = question.pdfPage; page <= (question.pdfPageEnd ?? question.pdfPage); page++)
    if ((progress?.pageSeconds[page] ?? 0) < READING_MIN_SOURCE_SECONDS) return false;
  return true;
}

// Share of the required source-page reading already credited by the server, from 0 to 1.
export function sourceReadingShare(
  progress: ReadingProgress | undefined,
  question: Pick<SafeQuestion, 'pdfPage' | 'pdfPageEnd'>,
) {
  if (question.pdfPage === null) return 1;
  const end = question.pdfPageEnd ?? question.pdfPage;
  let total = 0;
  for (let page = question.pdfPage; page <= end; page++)
    total += Math.min(1, (progress?.pageSeconds[page] ?? 0) / READING_MIN_SOURCE_SECONDS);
  return total / (end - question.pdfPage + 1);
}

// First source page still short of reading time, so guidance can move on to it by itself.
export function nextUnreadSourcePage(
  progress: ReadingProgress | undefined,
  question: Pick<SafeQuestion, 'pdfPage' | 'pdfPageEnd'>,
) {
  if (question.pdfPage === null) return null;
  for (let page = question.pdfPage; page <= (question.pdfPageEnd ?? question.pdfPage); page++)
    if ((progress?.pageSeconds[page] ?? 0) < READING_MIN_SOURCE_SECONDS) return page;
  return null;
}

// Highest page the server has seen the student on, so hint access survives a device change.
export function furthestPageRead(progress: ReadingProgress | undefined) {
  return Math.max(0, ...Object.keys(progress?.pageSeconds ?? {}).map(Number));
}

// Which reading rule stopped the answer, so the student is told why instead of guessing:
// never reached the source page, passed it too quickly, or jumped beyond it (e.g. to the end).
export type ReadingGap = 'unreached' | 'too-fast' | 'skipped';
export function readingGap(
  progress: ReadingProgress | undefined,
  question: Pick<SafeQuestion, 'pdfPage' | 'pdfPageEnd'>,
  maxPage = 0,
): ReadingGap | null {
  if (sourceReadingReady(progress, question) || question.pdfPage === null) return null;
  const end = question.pdfPageEnd ?? question.pdfPage;
  const seen = progress?.pageSeconds ?? {};
  for (let page = question.pdfPage; page <= end; page++) if (page in seen) return 'too-fast';
  return Math.max(maxPage, furthestPageRead(progress)) > end ? 'skipped' : 'unreached';
}
