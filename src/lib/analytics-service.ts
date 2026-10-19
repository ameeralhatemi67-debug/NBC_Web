import type { Database } from './database';
import { AppError } from './domain';
import type { Session } from './service';
import { otpEnabled } from './runtime';
import {
  pointBiserial,
  type GuidanceRow,
  type GuidanceSet,
  type InsightRow,
  type InsightsData,
  type StageItems,
} from './analytics-insights';

// Server data for the deeper analytics views: per participant of the current competition what the
// participant list does not carry (reading, how far an unsent attempt got, link code, review
// signals), question statistics per stage, and OTP delivery health. Never phone numbers or answers.
const current = "(SELECT value #>> '{}' FROM settings WHERE id='current_competition')";

export class AnalyticsService {
  constructor(
    private db: Database,
    private now: () => number = Date.now,
  ) {}

  async insights(s: Session): Promise<InsightsData> {
    if (!s || s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
    return this.db.transaction(async (tx) => {
      const rows = (
        await tx.query<{
          id: string;
          source: string | null;
          shared_phone: boolean;
          attempt_id: string | null;
          question_count: number | null;
          answered: string | null;
          furthest: number | null;
          read_seconds: number | null;
          read_events: string | null;
          recovered: boolean | null;
        }>(
          `SELECT p.id,p.source,
            (p.erased_at IS NULL AND EXISTS(SELECT 1 FROM participants q WHERE q.phone=p.phone AND q.id<>p.id AND q.erased_at IS NULL)) AS shared_phone,
            a.id AS attempt_id,jsonb_array_length(a.questions) AS question_count,
            (SELECT count(*) FROM attempt_answers an WHERE an.attempt_id=a.id AND jsonb_array_length(an.selected)>0) AS answered,
            (SELECT max(q.ordinal)+1 FROM attempt_answers an JOIN attempt_questions q ON q.attempt_id=an.attempt_id AND q.question_id=an.question_id
              WHERE an.attempt_id=a.id AND jsonb_array_length(an.selected)>0) AS furthest,
            r.read_seconds,r.read_events,
            EXISTS(SELECT 1 FROM attempt_recoveries ar WHERE ar.attempt_id=a.id) AS recovered
          FROM participants p
          LEFT JOIN attempts a ON a.participant_id=p.id AND a.competition_id=${current}
          LEFT JOIN LATERAL (
            SELECT SUM((e.payload->>'creditedSeconds')::double precision) AS read_seconds,count(*) AS read_events
            FROM attempt_events e WHERE e.attempt_id=a.id AND e.payload->>'kind'='READ'
          ) r ON a.id IS NOT NULL`,
        )
      ).rows.map((r): InsightRow => ({
        id: r.id,
        source: r.source,
        sharedPhone: r.shared_phone,
        attempt: r.attempt_id
          ? {
              readSeconds: Number(r.read_seconds ?? 0),
              readEvents: Number(r.read_events ?? 0),
              answered: Number(r.answered ?? 0),
              furthest: Number(r.furthest ?? 0),
              questionCount: Number(r.question_count ?? 0),
              recovered: !!r.recovered,
            }
          : null,
      }));

      // Each question's share of correct answers and its point-biserial correlation with the
      // attempt's percentage, over submitted attempts. Credited (invalid) questions are measured
      // as answered, so a broken question still shows up here.
      const stages = (
        await tx.query<{ stage: string; n: string; sd: number | null }>(
          `SELECT stage,count(*) AS n,stddev_pop(percentage) AS sd FROM attempts
           WHERE competition_id=${current} AND submitted_at IS NOT NULL GROUP BY stage`,
        )
      ).rows;
      const marks = (
        await tx.query<{
          stage: string;
          question_id: string;
          title: string;
          topic: string;
          n: string;
          correct: string;
          correct_mean: number | null;
          wrong_mean: number | null;
        }>(
          `WITH marks AS (
            SELECT a.stage,a.percentage,q.question_id,q.snapshot->>'title' AS title,q.snapshot->>'topic' AS topic,
              COALESCE((SELECT array_agg(x::int ORDER BY x::int) FROM jsonb_array_elements_text(q.snapshot->'correctAnswers') x)
                = (SELECT array_agg(y::int ORDER BY y::int) FROM jsonb_array_elements_text(an.selected) y),false) AS correct
            FROM attempts a JOIN attempt_questions q ON q.attempt_id=a.id
            LEFT JOIN attempt_answers an ON an.attempt_id=a.id AND an.question_id=q.question_id
            WHERE a.competition_id=${current} AND a.submitted_at IS NOT NULL)
          SELECT stage,question_id,max(title) AS title,max(topic) AS topic,count(*) AS n,
            count(*) FILTER (WHERE correct) AS correct,
            avg(percentage) FILTER (WHERE correct) AS correct_mean,
            avg(percentage) FILTER (WHERE NOT correct) AS wrong_mean
          FROM marks GROUP BY stage,question_id`,
        )
      ).rows;
      const items: Record<string, StageItems> = {};
      for (const st of stages) {
        const sd = Number(st.sd ?? 0);
        items[st.stage] = {
          submitted: Number(st.n),
          items: marks
            .filter((m) => m.stage === st.stage)
            .map((m) => {
              const n = Number(m.n),
                correct = Number(m.correct),
                p = n ? correct / n : 0;
              return {
                questionId: m.question_id,
                title: m.title ?? '',
                topic: m.topic ?? '',
                n,
                correct,
                difficulty: p * 100,
                discrimination: pointBiserial(
                  m.correct_mean === null ? null : Number(m.correct_mean),
                  m.wrong_mean === null ? null : Number(m.wrong_mean),
                  sd,
                  p,
                ),
              };
            })
            .sort((a, b) => (a.discrimination ?? 1) - (b.discrimination ?? 1)),
        };
      }

      // Participant code requests (not admin tests) per hour over the last 24 hours.
      const since = new Date(this.now() - 24 * 3600_000);
      const hours = (
        await tx.query<{ hour: string; sent: string; failed: string }>(
          `SELECT date_trunc('hour',created_at) AS hour,count(*) AS sent,count(*) FILTER (WHERE state='FAILED') AS failed
           FROM otp_challenges WHERE created_at >= $1 AND purpose IN ('REGISTER','LOGIN') GROUP BY 1 ORDER BY 1`,
          [since],
        )
      ).rows.map((h) => ({
        hour: new Date(h.hour).toISOString(),
        sent: Number(h.sent),
        failed: Number(h.failed),
      }));
      // Guidance events for actual attempts and, separately, for administrator rehearsals.
      type Raw = Omit<GuidanceRow, 'title'> & { title: string | null };
      const started = async (sql: string) =>
        Object.fromEntries(
          (await tx.query<{ stage: string; n: string }>(sql)).rows.map((r) => [
            r.stage,
            Number(r.n),
          ]),
        );
      const participants: GuidanceSet = {
        started: await started(
          `SELECT stage,count(*) AS n FROM attempts WHERE competition_id=${current} GROUP BY stage`,
        ),
        rows: (
          await tx.query<Raw>(
            `SELECT a.id AS "attemptId",a.participant_number AS label,a.stage,p.locality AS city,
              e.payload->>'questionId' AS "questionId",e.payload->>'gap' AS gap,q.snapshot->>'title' AS title
            FROM attempt_events e JOIN attempts a ON a.id=e.attempt_id
            JOIN participants p ON p.id=a.participant_id
            LEFT JOIN attempt_questions q ON q.attempt_id=a.id AND q.question_id=e.payload->>'questionId'
            WHERE a.competition_id=${current} AND e.payload->>'kind'='GUIDE'`,
          )
        ).rows.map((r) => ({ ...r, title: r.title ?? '' })),
      };
      const testRows = (
        await tx.query<Omit<Raw, 'title'> & { questions: { id: string; title: string }[] }>(
          `SELECT r.id AS "attemptId",r.participant_number AS label,r.stage,coalesce(r.config->>'testCity','') AS city,
            e.payload->>'questionId' AS "questionId",e.payload->>'gap' AS gap,r.questions
          FROM admin_test_events e JOIN admin_test_runs r ON r.id=e.run_id
          WHERE r.competition_id=${current} AND r.invalidated_at IS NULL AND e.payload->>'kind'='GUIDE'`,
        )
      ).rows;
      const tests: GuidanceSet = {
        started: await started(
          `SELECT stage,count(*) AS n FROM admin_test_runs WHERE competition_id=${current} AND invalidated_at IS NULL GROUP BY stage`,
        ),
        rows: testRows.map(({ questions, ...r }) => ({
          ...r,
          title: questions.find((q) => q.id === r.questionId)?.title ?? '',
        })),
      };
      return {
        rows,
        items,
        guidance: { participants, tests },
        otp: { enabled: otpEnabled(), hours },
        generatedAt: new Date(this.now()).toISOString(),
      };
    });
  }
}
