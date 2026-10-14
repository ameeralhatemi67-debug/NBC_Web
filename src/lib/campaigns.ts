import type { Database } from './database';
import { AppError } from './domain';
import { effectiveState, stageKeys, type Competition, type Stage } from './competition-domain';
import type { ParticipantReport, Session } from './service';

// Read-only history of every campaign, so results stay reachable after a new one is created.
export const RESULTS_PAGE_SIZE = 50;
function admin(s: Session) {
  if (!s || s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
}

export class CampaignHistory {
  constructor(
    private db: Database,
    private now: () => number = Date.now,
  ) {}

  async list(s: Session) {
    admin(s);
    const current = (
      await this.db.query<{ value: string }>(
        "SELECT value #>> '{}' AS value FROM settings WHERE id='current_competition'",
      )
    ).rows[0]?.value;
    const campaigns = (
      await this.db.query<{ body: Competition }>(
        "SELECT body FROM competitions WHERE id<>'legacy-demo' ORDER BY created_at DESC",
      )
    ).rows.map((r) => r.body);
    const counts = new Map(
      (
        await this.db.query<{ id: string; attempts: string; submitted: string }>(
          'SELECT competition_id AS id,count(*) AS attempts,count(submitted_at) AS submitted FROM attempts GROUP BY competition_id',
        )
      ).rows.map((r) => [r.id, r]),
    );
    const published = new Set(
      (
        await this.db.query<{ id: string }>(
          'SELECT competition_id AS id FROM competition_winner_publications',
        )
      ).rows.map((r) => r.id),
    );
    return campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      state: effectiveState(c, this.now()),
      opensAt: c.opensAt,
      closesAt: c.closesAt,
      closedAt: c.closedAt,
      current: c.id === current,
      attempts: Number(counts.get(c.id)?.attempts ?? 0),
      submitted: Number(counts.get(c.id)?.submitted ?? 0),
      winnersPublished: published.has(c.id),
    }));
  }

  private async campaign(id: unknown) {
    const row = (
      await this.db.query<{ body: Competition }>('SELECT body FROM competitions WHERE id=$1', [
        typeof id === 'string' ? id : '',
      ])
    ).rows[0];
    if (!row || row.body.id === 'legacy-demo') throw new AppError('المسابقة غير موجودة.', 404);
    return row.body;
  }

  async results(s: Session, query: { id?: string; stage?: string; page?: number }) {
    admin(s);
    const c = await this.campaign(query.id);
    const stage = stageKeys.includes(query.stage as Stage) ? (query.stage as Stage) : stageKeys[0];
    const page = Math.max(1, Math.trunc(query.page ?? 1) || 1);
    const summary = (
      await this.db.query<{
        stage: Stage;
        started: string;
        submitted: string;
        average: number | null;
      }>(
        'SELECT stage,count(*) AS started,count(submitted_at) AS submitted,avg(percentage) AS average FROM attempts WHERE competition_id=$1 GROUP BY stage',
        [c.id],
      )
    ).rows;
    const rows = (
      await this.db.query<{
        participant_number: string;
        name: string;
        institution: string | null;
        locality: string;
        score: number;
        max_score: number;
        percentage: number;
        rank: string;
      }>(
        `SELECT * FROM (SELECT a.participant_number,p.name,p.institution,p.locality,a.score,a.max_score,a.percentage,RANK() OVER (ORDER BY a.percentage DESC) AS rank FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.competition_id=$1 AND a.stage=$2 AND a.submitted_at IS NOT NULL) t ORDER BY rank,participant_number LIMIT $3 OFFSET $4`,
        [c.id, stage, RESULTS_PAGE_SIZE, (page - 1) * RESULTS_PAGE_SIZE],
      )
    ).rows;
    const awards = (
      await this.db.query<{
        stage: Stage | null;
        place: number;
        label: string | null;
        participant_number: string | null;
        name: string | null;
        reason: string | null;
      }>(
        'SELECT aw.stage,aw.place,aw.label,aw.reason,a.participant_number,p.name FROM competition_awards aw LEFT JOIN attempts a ON a.id=aw.attempt_id LEFT JOIN participants p ON p.id=a.participant_id WHERE aw.competition_id=$1 ORDER BY aw.stage NULLS LAST,aw.place',
        [c.id],
      )
    ).rows;
    const publication = (
      await this.db.query<{ published_at: string; show_names: boolean }>(
        'SELECT published_at,show_names FROM competition_winner_publications WHERE competition_id=$1',
        [c.id],
      )
    ).rows[0];
    return {
      competition: { id: c.id, title: c.title, state: effectiveState(c, this.now()) },
      stages: stageKeys.map((key) => {
        const row = summary.find((r) => r.stage === key);
        return {
          stage: key,
          started: Number(row?.started ?? 0),
          submitted: Number(row?.submitted ?? 0),
          average: row?.average === null || row === undefined ? null : Number(row.average),
        };
      }),
      results: {
        stage,
        page,
        pageSize: RESULTS_PAGE_SIZE,
        total: Number(summary.find((r) => r.stage === stage)?.submitted ?? 0),
        rows: rows.map((r) => ({
          participantNumber: r.participant_number,
          name: r.name,
          institution: r.institution,
          locality: r.locality,
          score: Number(r.score),
          maxScore: Number(r.max_score),
          percentage: Number(r.percentage),
          rank: Number(r.rank),
        })),
      },
      awards: awards.map((a) => ({
        stage: a.stage,
        place: a.place,
        label: a.label,
        participantNumber: a.participant_number,
        name: a.name,
        reason: a.reason,
      })),
      publication: publication
        ? { publishedAt: publication.published_at, showNames: publication.show_names }
        : null,
    };
  }

  // Participants who took part in one campaign, in the shape the CSV report already uses.
  async participants(s: Session, id: unknown): Promise<ParticipantReport[]> {
    admin(s);
    const c = await this.campaign(id);
    return (
      await this.db.query<ParticipantReport>(
        'SELECT p.id,p.name,p.stage,p.institution,p.gender,p.region,p.locality,p.village,p.created_at,a.score,a.max_score,a.submitted_at,a.receipt,a.id AS attempt_id,a.created_at AS attempt_started_at FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.competition_id=$1 ORDER BY p.created_at',
        [c.id],
      )
    ).rows;
  }
}
