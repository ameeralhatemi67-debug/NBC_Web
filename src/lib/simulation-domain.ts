import type { Competition, CompetitionQuestion, Stage } from './competition-domain';

export const SIMULATION_SECONDS = 300;
export const PRACTICE_ENTRY_MS = 5 * 60_000;
export const PRACTICE_FINISH_MS = 15 * 60_000;
export type SimulationSource = 'actual' | 'generated' | 'practice';
export type SimulationRun = {
  id: string;
  competition_id: string;
  config: Competition;
  banks: Record<Stage, CompetitionQuestion[]>;
  opened_at: string | Date;
  entry_closes_at: string | Date;
  finish_until: string | Date;
  closed_at: string | Date | null;
  version: number;
};
export type PracticeStatus = {
  id: string;
  entryClosesAt: string;
  finishUntil: string;
  entryOpen: boolean;
  canFinish: boolean;
  version: number;
  serverNow: string;
};
export function practiceStatus(run: SimulationRun, draft: boolean, now: number): PracticeStatus {
  return {
    id: run.id,
    entryClosesAt: new Date(run.entry_closes_at).toISOString(),
    finishUntil: new Date(run.finish_until).toISOString(),
    entryOpen: draft && now < new Date(run.entry_closes_at).getTime(),
    canFinish: draft && now < new Date(run.finish_until).getTime(),
    version: run.version,
    serverNow: new Date(now).toISOString(),
  };
}
export function practiceCompetition(run: SimulationRun, existing: boolean): Competition {
  return {
    ...run.config,
    state: 'OPEN',
    opensAt: new Date(run.opened_at).toISOString(),
    closesAt: new Date(existing ? run.finish_until : run.entry_closes_at).toISOString(),
    closedAt: null,
    closingPolicy: 'immediate',
    leaderboardMode: 'own_result_only',
  };
}
export type Playback = {
  id: string;
  seed: number;
  referenceDate: string;
  position: number;
  anchor: number;
  playing: boolean;
};
export function playbackPosition(playback: Playback, now: number) {
  return Math.min(
    SIMULATION_SECONDS,
    Math.max(
      0,
      playback.position + (playback.playing ? Math.max(0, now - playback.anchor) / 1000 : 0),
    ),
  );
}
export function restorePlayback(value: unknown): Playback | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Playback;
  return typeof p.id === 'string' &&
    p.id.length <= 100 &&
    Number.isSafeInteger(p.seed) &&
    typeof p.referenceDate === 'string' &&
    Number.isFinite(Date.parse(p.referenceDate)) &&
    Number.isFinite(p.position) &&
    p.position >= 0 &&
    p.position <= SIMULATION_SECONDS &&
    Number.isFinite(p.anchor) &&
    typeof p.playing === 'boolean'
    ? p
    : null;
}
export const simulationPhases = [
  { at: 0, label: 'التسجيل' },
  { at: 30, label: 'بدء الاختبارات' },
  { at: 120, label: 'أول النتائج' },
  { at: 210, label: 'موجة المشاركة' },
  { at: 270, label: 'الإغلاق' },
];
export function trackTime(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
