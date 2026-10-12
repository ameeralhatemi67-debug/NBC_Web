import { stageKeys, type Stage } from './competition-domain';
import type { PrizeSettings } from './prizes';

// Pure rules for the committee's winner selection. No database and no React: unit-tested.
export const PLACES = 6;
export type Candidate = {
  attemptId: string;
  participantNumber: string;
  name: string;
  institution: string | null;
  stage: Stage;
  score: number;
  maxScore: number;
  percentage: number;
};
export type ScoreRow = { attemptId: string; percentage: number };
export type StageEvaluation = {
  errors: string[];
  tieAmongWinners: boolean;
  tieAtBoundary: boolean;
  orderViolation: boolean;
  skippedHigher: boolean;
  needsReason: boolean;
};
const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// `places[0]` is first place. Rows are every submitted attempt of the stage. The committee may
// choose any order, but a tie decision or a departure from score order needs a written reason.
export function evaluateStage(rows: ScoreRow[], places: (string | null)[]): StageEvaluation {
  const errors: string[] = [];
  const result: StageEvaluation = {
    errors,
    tieAmongWinners: false,
    tieAtBoundary: false,
    orderViolation: false,
    skippedHigher: false,
    needsReason: false,
  };
  if (places.length !== PLACES) errors.push(`يلزم ${PLACES} مراكز.`);
  const byId = new Map(rows.map((r) => [r.attemptId, r.percentage]));
  const chosen = places.filter((p): p is string => typeof p === 'string' && p !== '');
  if (new Set(chosen).size !== chosen.length) errors.push('لا يمكن منح مشارك أكثر من مركز.');
  if (chosen.some((id) => !byId.has(id))) errors.push('مشارك غير مكتمل المشاركة أو غير موجود.');
  const firstEmpty = places.findIndex((p) => !p);
  if (firstEmpty !== -1 && places.slice(firstEmpty).some(Boolean))
    errors.push('لا تترك مركزًا فارغًا قبل مركز مشغول.');
  if (errors.length || !chosen.length) return result;
  const scores = chosen.map((id) => byId.get(id)!);
  const lowest = Math.min(...scores);
  for (let i = 0; i < scores.length; i++)
    for (let j = i + 1; j < scores.length; j++) {
      if (same(scores[i], scores[j])) result.tieAmongWinners = true;
      else if (scores[i] < scores[j]) result.orderViolation = true;
    }
  for (const row of rows) {
    if (chosen.includes(row.attemptId)) continue;
    if (same(row.percentage, lowest)) result.tieAtBoundary = true;
    else if (row.percentage > lowest) result.skippedHigher = true;
  }
  result.needsReason =
    result.tieAmongWinners || result.tieAtBoundary || result.orderViolation || result.skippedHigher;
  return result;
}
export function reasonProblem(evaluation: StageEvaluation, reason: string) {
  const text = reason.trim();
  if (!evaluation.needsReason) return '';
  if (text.length < 15) return 'اكتب سبب قرار اللجنة (15 حرفًا على الأقل).';
  if (text.length > 1000) return 'سبب القرار طويل جدًا.';
  return '';
}
export function awardAmount(prizes: PrizeSettings, stage: Stage, place: number) {
  return prizes.stages[stageKeys.indexOf(stage)]?.awards[place - 1] ?? 0;
}
export function awardKey(stage: Stage | null, place: number) {
  return stage ? `${stage}:${place}` : 'media';
}

// What visitors see. Names appear only when the committee chose to show them.
export type AnnouncedAward = {
  place: number;
  amount: number;
  participantNumber: string;
  score: number;
  maxScore: number;
  name?: string;
  institution?: string | null;
};
export type WinnersAnnouncement = {
  competitionId: string;
  title: string;
  publishedAt: string;
  showNames: boolean;
  stages: { stage: Stage; awards: AnnouncedAward[] }[];
  media: { label: string; amount: number } | null;
};
