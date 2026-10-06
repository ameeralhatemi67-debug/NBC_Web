import type { Competition, CompetitionState } from './competition-domain';
import { questionStatus, type ExamAttempt } from './exam-presentation';

export const leaderboardModeLines: Record<Competition['leaderboardMode'], string> = {
  hidden: 'نتيجتك تظهر لك فقط. لا يُعلن ترتيب المشاركين.',
  own_result_only: 'نتيجتك تظهر لك فقط. تعتمد اللجنة الفائزين وتعلنهم بنفسها.',
  publish_after_close:
    'يُعلن الترتيب بعد إغلاق المسابقة واعتماد اللجنة. التعادل لا يُحسم بسرعة المشاركة.',
  public_live: 'الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة.',
};
export function missedQuestions(attempt: ExamAttempt) {
  if (attempt.score === null) return [];
  return attempt.questions.filter(
    (question) => questionStatus(attempt, question.id) === 'incorrect',
  );
}
export function revisitPages(attempt: ExamAttempt) {
  return [...new Set(missedQuestions(attempt).map((question) => question.pdfPage))].sort(
    (a, b) => a - b,
  );
}
export function selectedAnswerText(
  question: NonNullable<CompetitionState['attempt']>['questions'][number],
  selected: number[],
) {
  return (
    selected
      .filter((index) => Number.isInteger(index) && index >= 0 && index < question.options.length)
      .map((index) => question.options[index])
      .join('، ') || 'لم تُحدَّد إجابة'
  );
}
export async function copyWithFallback(
  text: string,
  write: (text: string) => Promise<void>,
  fallback: (text: string) => boolean,
) {
  try {
    await write(text);
    return true;
  } catch {
    try {
      return fallback(text);
    } catch {
      return false;
    }
  }
}
