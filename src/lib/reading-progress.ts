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
