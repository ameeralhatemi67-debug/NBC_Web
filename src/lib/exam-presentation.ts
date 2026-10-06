import type { CompetitionState } from './competition-domain';
export type ExamAttempt = NonNullable<CompetitionState['attempt']>;
export function questionStatus(attempt: Pick<ExamAttempt, 'answers' | 'feedback'>, id: string) {
  if (!attempt.answers[id]?.locked) return 'unvisited';
  const feedback = attempt.feedback[id];
  return feedback ? (feedback.isCorrect ? 'correct' : 'incorrect') : 'pending';
}
export const questionStatusLabels = {
  unvisited: 'لم تُثبّت',
  correct: 'صحيح',
  incorrect: 'غير صحيح',
  pending: 'بانتظار التأكيد',
};
