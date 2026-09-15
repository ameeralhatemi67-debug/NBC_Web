export type Question = {
  id: string;
  title: string;
  options: string[];
  correct: number;
  source: string;
  version: number;
  approved: boolean;
};
export type PublicQuestion = Omit<Question, 'correct' | 'approved'>;
export type Answers = Record<string, number>;
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
}
export function publicQuestions(questions: Question[]): PublicQuestion[] {
  return questions.map(({ id, title, options, source, version }) => ({
    id,
    title,
    options,
    source,
    version,
  }));
}
export function validateAnswers(questions: Question[], value: unknown): Answers {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError('صيغة الإجابات غير صالحة.');
  const answers = value as Answers;
  for (const [id, answer] of Object.entries(answers)) {
    const q = questions.find((q) => q.id === id);
    if (!q || !Number.isInteger(answer) || answer < 0 || answer >= q.options.length)
      throw new AppError('إجابة غير صالحة.');
  }
  return answers;
}
export function scoreAttempt(questions: Question[], answers: Answers) {
  validateAnswers(questions, answers);
  return questions.reduce((sum, q) => sum + Number(answers[q.id] === q.correct), 0);
}
export function csvCell(value: unknown) {
  const s = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function tieGroups(rows: { id: string; score: number | null; submitted_at: unknown }[]) {
  const groups = new Map<number, string[]>();
  for (const row of rows)
    if (row.submitted_at && row.score !== null)
      groups.set(row.score, [...(groups.get(row.score) ?? []), row.id]);
  return [...groups].filter(([, ids]) => ids.length > 1).map(([score, ids]) => ({ score, ids }));
}
