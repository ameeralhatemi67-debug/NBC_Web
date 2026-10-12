import type { CompetitionState } from './competition-domain';
export type ExamAttempt = NonNullable<CompetitionState['attempt']>;
export function questionStatus(attempt: Pick<ExamAttempt, 'answers' | 'feedback'>, id: string) {
  if (!attempt.answers[id]?.locked) return attempt.answers[id]?.selected.length ? 'answered' : 'unvisited';
  const feedback = attempt.feedback[id];
  return feedback ? (feedback.isCorrect ? 'correct' : 'incorrect') : 'pending';
}
export const questionStatusLabels = {
  unvisited: 'لم تُجب',
  answered: 'مجاب عنها، قابلة للتعديل',
  correct: 'صحيح',
  incorrect: 'غير صحيح',
  pending: 'بانتظار التأكيد',
};
