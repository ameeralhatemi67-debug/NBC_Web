import { randomBytes, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './database';
import { AppError } from './domain';
import type { Session } from './service';
import { CompetitionService } from './competition-service';
import {
  effectiveState,
  stageKeys,
  stageNames,
  type Competition,
  type Stage,
} from './competition-domain';
import { resolveEligibility } from './eligibility';
import {
  DEFAULT_ALTERNATES,
  DRAW_ALGORITHM,
  DRAW_FORMAT,
  MAX_ALTERNATES,
  MAX_DRAW_PRIZES,
  MAX_PRIZE_LABEL,
  assignResults,
  drawOrder,
  failedStatus,
  groupPool,
  poolFingerprint,
  prizeHolders,
  sha256Hex,
  type DrawEntryRole,
  type DrawEntryStatus,
  type DrawPoolEntry,
  type DrawStage,
  type VerificationFile,
} from './prize-draw';

// The committee's random prize draw: a separate pool beside the ranked places. Freeze the pool,
// commit a secret seed, draw, then record contact outcomes. Every step is written once and audited.
export type DrawCriteria = { stage: DrawStage; excludeRanked: boolean; excludeFlags: boolean };
export type PoolStats = {
  submitted: number;
  eligible: number;
  ranked: number;
  flagged: number;
  sharedPhones: number;
  outsideCities: number;
  erased: number;
  previousPrize: number;
};
export type DrawRecord = {
  name: string;
  stage: Stage;
  institution: string | null;
  region: string;
  locality: string;
  gender: string | null;
  phone: string | null;
  backup: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  stageRank: number;
  stageSubmitted: number;
  minutes: number | null;
  readingMinutes: number;
  registeredAt: string;
  samePhone: number;
  flags: string[];
  recovered: boolean;
  erased: boolean;
  ranked: boolean;
};
export type DrawEntryView = {
  position: number;
  role: DrawEntryRole;
  prizeIndex: number | null;
  participantNumber: string;
  status: DrawEntryStatus;
  note: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  holds: number | null;
  record: DrawRecord;
};
export type DrawView = {
  id: string;
  stage: DrawStage;
  prizes: string[];
  alternates: number;
  excludeRanked: boolean;
  excludeFlags: boolean;
  poolSize: number;
  poolFingerprint: string;
  frozenBy: string;
  frozenAt: string;
  seedCommitment: string | null;
  committedAt: string | null;
  seed: string | null;
  drawnBy: string | null;
  drawnAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  entries: DrawEntryView[];
  holders: (number | null)[];
};
export type DrawSummary = {
  id: string;
  stage: DrawStage;
  prizes: number;
  poolSize: number;
  frozenAt: string;
  drawnAt: string | null;
  cancelledAt: string | null;
};
export type PrizeDrawState = {
  competition: { id: string; title: string; state: string };
  blocker: string;
  rankedMissing: Stage[];
  criteria: DrawCriteria;
  stats: PoolStats;
  draw: DrawView | null;
  draws: DrawSummary[];
};
export type ScreenState = {
  drawId: string | null;
  phase: 'idle' | 'frozen' | 'committed' | 'drawn';
  stage: DrawStage | null;
  poolSize: number;
  drawnAt: string | null;
  winners: { prize: string; number: string; firstName: string }[];
};

type DrawRow = {
  id: string;
  competition_id: string;
  stage: Stage | null;
  prizes: string[];
  alternates: number;
  exclude_ranked: boolean;
  exclude_flags: boolean;
  pool: DrawPoolEntry[];
  pool_size: number;
  pool_fingerprint: string;
  frozen_by: string;
  frozen_at: string;
  seed_commitment: string | null;
  seed: string | null;
  committed_at: string | null;
  drawn_by: string | null;
  drawn_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};
type EntryRow = {
  position: number;
  role: DrawEntryRole;
  prize_index: number | null;
  attempt_id: string;
  participant_number: string;
  status: DrawEntryStatus;
  note: string | null;
  decided_by: string | null;
  decided_at: string | null;
};
type Candidate = {
  attemptId: string;
  number: string;
  stage: Stage;
  phone: string;
  region: string;
  locality: string;
  erased: boolean;
  ranked: boolean;
  flags: string[];
};

const flagLabels: Record<string, string> = {
  page_jump: 'قفز بين صفحات المصدر',
  rapid_page_turn: 'تقليب سريع للصفحات',
  rapid_answers: 'إجابات متتابعة سريعة',
};
const statusLabels: Record<DrawEntryStatus, string> = {
  pending: 'بانتظار التواصل',
  confirmed: 'تم التواصل',
  unreachable: 'تعذر التواصل',
  ineligible: 'غير مؤهل',
};
const iso = (v: string | Date | null) => (v === null ? null : new Date(v).toISOString());
const toStage = (v: unknown): DrawStage =>
  v === 'all' || stageKeys.includes(v as Stage) ? (v as DrawStage) : 'all';
function admin(s: Session) {
  if (!s || s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return s.actor ?? s.role;
}
async function audit(tx: Queryable, actor: string, action: string, detail: unknown) {
  await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
    actor,
    action,
    JSON.stringify(detail),
  ]);
}

export class PrizeDrawService {
  private competitions: CompetitionService;
  constructor(
    private db: Database,
    private now: () => number = Date.now,
  ) {
    this.competitions = new CompetitionService(db, now);
  }

  // Every submitted attempt of the campaign, with what the pool rules need to know about it.
  private async candidates(tx: Queryable, c: Competition, stage: DrawStage) {
    const rows = (
      await tx.query<{
        attempt_id: string;
        participant_number: string;
        stage: Stage;
        phone: string;
        region: string;
        locality: string;
        erased_at: string | null;
        ranked: boolean;
        reading_flags: string[] | null;
      }>(
        `SELECT a.id AS attempt_id,a.participant_number,a.stage,p.phone,p.region,p.locality,p.erased_at,
          EXISTS(SELECT 1 FROM competition_awards aw WHERE aw.competition_id=a.competition_id AND aw.attempt_id=a.id) AS ranked,
          (SELECT array_agg(DISTINCT f) FROM attempt_events e, jsonb_array_elements_text(COALESCE(e.payload->'flags','[]'::jsonb)) f
            WHERE e.attempt_id=a.id AND e.payload->>'kind'='READ') AS reading_flags
        FROM attempts a JOIN participants p ON p.id=a.participant_id
        WHERE a.competition_id=$1 AND a.submitted_at IS NOT NULL AND ($2::text IS NULL OR a.stage=$2)
        ORDER BY a.participant_number`,
        [c.id, stage === 'all' ? null : stage],
      )
    ).rows;
    const rapid = new Set<string>();
    for (const r of (
      await tx.query<{ detail: string }>(
        "SELECT detail FROM audit WHERE action='ملاحظة على وتيرة الإجابة' AND detail LIKE $1",
        [`%${c.id}%`],
      )
    ).rows) {
      try {
        const d = JSON.parse(r.detail) as {
          competitionId?: string;
          attemptId?: string;
          testRun?: boolean;
        };
        if (d.competitionId === c.id && !d.testRun && d.attemptId) rapid.add(d.attemptId);
      } catch {
        // Older free-text audit rows carry no attempt.
      }
    }
    return rows.map((r): Candidate => ({
      attemptId: r.attempt_id,
      number: r.participant_number,
      stage: r.stage,
      phone: r.phone,
      region: r.region,
      locality: r.locality,
      erased: !!r.erased_at,
      ranked: r.ranked,
      flags: [...(r.reading_flags ?? []), ...(rapid.has(r.attempt_id) ? ['rapid_answers'] : [])],
    }));
  }
  // Attempts that already hold a prize from an earlier draw of this campaign, and their phones.
  private async previousHolders(tx: Queryable, c: Competition) {
    const draws = (
      await tx.query<{ id: string; prizes: string[] }>(
        'SELECT id,prizes FROM prize_draws WHERE competition_id=$1 AND drawn_at IS NOT NULL',
        [c.id],
      )
    ).rows;
    const attempts = new Set<string>();
    for (const d of draws) {
      const entries = await this.entries(tx, d.id);
      const holders = prizeHolders(d.prizes.length, this.holderInput(entries));
      for (const e of entries) if (holders.includes(e.position)) attempts.add(e.attempt_id);
    }
    const phones = new Set(
      attempts.size
        ? (
            await tx.query<{ phone: string }>(
              'SELECT p.phone FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.id = ANY($1::text[])',
              [[...attempts]],
            )
          ).rows.map((r) => r.phone)
        : [],
    );
    return { attempts, phones };
  }
  private async pool(tx: Queryable, c: Competition, criteria: DrawCriteria) {
    const all = await this.candidates(tx, c, criteria.stage);
    const eligibility = resolveEligibility(c);
    const previous = await this.previousHolders(tx, c);
    const rankedPhones = new Set(all.filter((p) => p.ranked).map((p) => p.phone));
    if (criteria.excludeRanked)
      for (const r of (
        await tx.query<{ phone: string }>(
          'SELECT p.phone FROM competition_awards aw JOIN attempts a ON a.id=aw.attempt_id JOIN participants p ON p.id=a.participant_id WHERE aw.competition_id=$1',
          [c.id],
        )
      ).rows)
        rankedPhones.add(r.phone);
    const inCities = (p: Candidate) =>
      eligibility.regions.includes(p.region) &&
      (eligibility.cities[p.region] ?? []).includes(p.locality);
    const phoneCount = new Map<string, number>();
    for (const p of all) phoneCount.set(p.phone, (phoneCount.get(p.phone) ?? 0) + 1);
    const eligible = all.filter(
      (p) =>
        !p.erased &&
        inCities(p) &&
        !previous.attempts.has(p.attemptId) &&
        !previous.phones.has(p.phone) &&
        !(criteria.excludeRanked && (p.ranked || rankedPhones.has(p.phone))) &&
        !(criteria.excludeFlags && p.flags.length),
    );
    const stats: PoolStats = {
      submitted: all.length,
      eligible: eligible.length,
      ranked: all.filter((p) => p.ranked).length,
      flagged: all.filter((p) => p.flags.length).length,
      sharedPhones: all.filter((p) => !p.erased && (phoneCount.get(p.phone) ?? 0) > 1).length,
      outsideCities: all.filter((p) => !p.erased && !inCities(p)).length,
      erased: all.filter((p) => p.erased).length,
      previousPrize: all.filter(
        (p) => previous.attempts.has(p.attemptId) || previous.phones.has(p.phone),
      ).length,
    };
    return {
      stats,
      entries: groupPool(eligible.map((p) => ({ number: p.number, key: p.phone }))),
    };
  }
  private async rankedMissing(tx: Queryable, c: Competition) {
    return (
      await tx.query<{ stage: Stage }>(
        'SELECT DISTINCT a.stage FROM attempts a WHERE a.competition_id=$1 AND a.submitted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM competition_awards aw WHERE aw.competition_id=a.competition_id AND aw.stage=a.stage)',
        [c.id],
      )
    ).rows
      .map((r) => r.stage)
      .sort((a, b) => stageKeys.indexOf(a) - stageKeys.indexOf(b));
  }
  private entries(tx: Queryable, drawId: string) {
    return tx
      .query<EntryRow>('SELECT * FROM prize_draw_entries WHERE draw_id=$1 ORDER BY position', [
        drawId,
      ])
      .then((r) => r.rows);
  }
  private holderInput(entries: EntryRow[]) {
    return entries.map((e) => ({
      position: e.position,
      role: e.role,
      prizeIndex: e.prize_index,
      status: e.status,
      decidedAt: iso(e.decided_at),
    }));
  }
  // The operator's full record for each drawn number. Never sent to the audience screen.
  private async records(tx: Queryable, c: Competition, attemptIds: string[]) {
    if (!attemptIds.length) return new Map<string, DrawRecord>();
    const rows = (
      await tx.query<{
        attempt_id: string;
        name: string;
        stage: Stage;
        institution: string | null;
        region: string;
        locality: string;
        gender: string | null;
        phone: string;
        backup: string | null;
        score: number;
        max_score: number;
        percentage: number;
        started_at: string;
        submitted_at: string;
        registered_at: string;
        erased_at: string | null;
        stage_rank: string;
        stage_submitted: string;
        same_phone: string;
        reading_seconds: number | null;
        recovered: boolean;
        ranked: boolean;
      }>(
        `SELECT a.id AS attempt_id,p.name,a.stage,p.institution,p.region,p.locality,p.gender,p.phone,p.backup,
          a.score,a.max_score,a.percentage,a.created_at AS started_at,a.submitted_at,p.created_at AS registered_at,p.erased_at,
          (SELECT count(*)+1 FROM attempts o WHERE o.competition_id=a.competition_id AND o.stage=a.stage AND o.submitted_at IS NOT NULL AND o.percentage>a.percentage) AS stage_rank,
          (SELECT count(*) FROM attempts o WHERE o.competition_id=a.competition_id AND o.stage=a.stage AND o.submitted_at IS NOT NULL) AS stage_submitted,
          (SELECT count(*) FROM participants q WHERE q.phone=p.phone AND q.id<>p.id AND q.erased_at IS NULL) AS same_phone,
          (SELECT SUM((e.payload->>'creditedSeconds')::double precision) FROM attempt_events e WHERE e.attempt_id=a.id AND e.payload->>'kind'='READ') AS reading_seconds,
          EXISTS(SELECT 1 FROM attempt_recoveries r WHERE r.attempt_id=a.id) AS recovered,
          EXISTS(SELECT 1 FROM competition_awards aw WHERE aw.competition_id=a.competition_id AND aw.attempt_id=a.id) AS ranked
        FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.id = ANY($1::text[])`,
        [attemptIds],
      )
    ).rows;
    const flags = new Map(
      (await this.candidates(tx, c, 'all'))
        .filter((p) => attemptIds.includes(p.attemptId))
        .map((p) => [p.attemptId, p.flags]),
    );
    return new Map(
      rows.map((r): [string, DrawRecord] => [
        r.attempt_id,
        {
          name: r.name,
          stage: r.stage,
          institution: r.institution,
          region: r.region,
          locality: r.locality,
          gender: r.gender,
          phone: r.erased_at ? null : r.phone,
          backup: r.erased_at ? null : r.backup || null,
          score: Number(r.score),
          maxScore: Number(r.max_score),
          percentage: Number(r.percentage),
          stageRank: Number(r.stage_rank),
          stageSubmitted: Number(r.stage_submitted),
          minutes:
            r.submitted_at && r.started_at
              ? Math.max(
                  0,
                  Math.round((Date.parse(r.submitted_at) - Date.parse(r.started_at)) / 60000),
                )
              : null,
          readingMinutes: Math.round(Number(r.reading_seconds ?? 0) / 60),
          registeredAt: new Date(r.registered_at).toISOString(),
          samePhone: r.erased_at ? 0 : Number(r.same_phone),
          flags: (flags.get(r.attempt_id) ?? []).map((f) => flagLabels[f] ?? f),
          recovered: r.recovered,
          erased: !!r.erased_at,
          ranked: r.ranked,
        },
      ]),
    );
  }
  private async drawView(tx: Queryable, c: Competition, row: DrawRow): Promise<DrawView> {
    const entries = await this.entries(tx, row.id);
    const holders = prizeHolders(row.prizes.length, this.holderInput(entries));
    const records = await this.records(
      tx,
      c,
      entries.map((e) => e.attempt_id),
    );
    return {
      id: row.id,
      stage: row.stage ?? 'all',
      prizes: row.prizes,
      alternates: row.alternates,
      excludeRanked: row.exclude_ranked,
      excludeFlags: row.exclude_flags,
      poolSize: row.pool_size,
      poolFingerprint: row.pool_fingerprint,
      frozenBy: row.frozen_by,
      frozenAt: iso(row.frozen_at)!,
      seedCommitment: row.seed_commitment,
      committedAt: iso(row.committed_at),
      // The seed stays secret until the draw is recorded.
      seed: row.drawn_at ? row.seed : null,
      drawnBy: row.drawn_by,
      drawnAt: iso(row.drawn_at),
      cancelledAt: iso(row.cancelled_at),
      cancelReason: row.cancel_reason,
      holders,
      entries: entries.map((e) => ({
        position: e.position,
        role: e.role,
        prizeIndex: e.prize_index,
        participantNumber: e.participant_number,
        status: e.status,
        note: e.note,
        decidedBy: e.decided_by,
        decidedAt: iso(e.decided_at),
        holds: holders.includes(e.position) ? holders.indexOf(e.position) : null,
        record: records.get(e.attempt_id)!,
      })),
    };
  }
  private async row(tx: Queryable, c: Competition, id: string, lock = false) {
    const row = (
      await tx.query<DrawRow>(
        `SELECT * FROM prize_draws WHERE id=$1 AND competition_id=$2${lock ? ' FOR UPDATE' : ''}`,
        [id, c.id],
      )
    ).rows[0];
    if (!row) throw new AppError('السحب غير موجود.', 404);
    return row;
  }

  async state(
    s: Session,
    query: { id?: string; stage?: string; excludeRanked?: boolean; excludeFlags?: boolean } = {},
  ): Promise<PrizeDrawState> {
    admin(s);
    const c = await this.competitions.current();
    let blocker = '';
    try {
      await this.competitions.assertFinal(this.db, c);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      blocker = e.message;
    }
    const rows = (
      await this.db.query<DrawRow>(
        'SELECT * FROM prize_draws WHERE competition_id=$1 ORDER BY frozen_at DESC,id',
        [c.id],
      )
    ).rows;
    const open = rows.find((r) => !r.drawn_at && !r.cancelled_at);
    const chosen = query.id
      ? rows.find((r) => r.id === query.id)
      : (open ?? rows.find((r) => !r.cancelled_at));
    if (query.id && !chosen) throw new AppError('السحب غير موجود.', 404);
    // A draw in progress keeps the criteria it was frozen with; so does a shown past draw unless
    // the operator is previewing new criteria.
    const fixed = open ?? (query.stage === undefined ? chosen : undefined);
    const criteria: DrawCriteria = fixed
      ? {
          stage: fixed.stage ?? 'all',
          excludeRanked: fixed.exclude_ranked,
          excludeFlags: fixed.exclude_flags,
        }
      : {
          stage: toStage(query.stage ?? 'all'),
          excludeRanked: query.excludeRanked ?? true,
          excludeFlags: query.excludeFlags ?? false,
        };
    const { stats } = await this.pool(this.db, c, criteria);
    return {
      competition: { id: c.id, title: c.title, state: effectiveState(c, this.now()) },
      blocker,
      rankedMissing: await this.rankedMissing(this.db, c),
      criteria,
      stats,
      draw: chosen ? await this.drawView(this.db, c, chosen) : null,
      draws: rows.map((r) => ({
        id: r.id,
        stage: r.stage ?? 'all',
        prizes: r.prizes.length,
        poolSize: r.pool_size,
        frozenAt: iso(r.frozen_at)!,
        drawnAt: iso(r.drawn_at),
        cancelledAt: iso(r.cancelled_at),
      })),
    };
  }

  async freeze(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    if (body.stage !== 'all' && !stageKeys.includes(body.stage as Stage))
      throw new AppError('مرحلة غير صالحة.');
    if (typeof body.excludeRanked !== 'boolean' || typeof body.excludeFlags !== 'boolean')
      throw new AppError('حدد شروط الاستبعاد.');
    if (!Array.isArray(body.prizes) || !body.prizes.length)
      throw new AppError('أضف جائزة واحدة على الأقل للسحب.');
    if (body.prizes.length > MAX_DRAW_PRIZES)
      throw new AppError(`الحد الأقصى ${MAX_DRAW_PRIZES} جائزة في السحب الواحد.`);
    const prizes = body.prizes.map((p) =>
      typeof p === 'string' ? p.replace(/\s+/g, ' ').trim() : '',
    );
    if (prizes.some((p) => !p || p.length > MAX_PRIZE_LABEL || /[\u0000-\u001f\u007f<>]/.test(p)))
      throw new AppError('اكتب وصفًا صالحًا لكل جائزة.');
    const alternates = body.alternates ?? DEFAULT_ALTERNATES;
    if (
      !Number.isInteger(alternates) ||
      (alternates as number) < 0 ||
      (alternates as number) > MAX_ALTERNATES
    )
      throw new AppError(`عدد البدلاء من ٠ إلى ${MAX_ALTERNATES} لكل جائزة.`);
    const criteria: DrawCriteria = {
      stage: body.stage as DrawStage,
      excludeRanked: body.excludeRanked,
      excludeFlags: body.excludeFlags,
    };
    const id = randomUUID();
    await this.db.transaction(async (tx) => {
      const c0 = await this.competitions.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c0.id]);
      const c = await this.competitions.current(tx, c0.id);
      await this.competitions.assertFinal(tx, c);
      if (
        (
          await tx.query(
            'SELECT 1 FROM prize_draws WHERE competition_id=$1 AND drawn_at IS NULL AND cancelled_at IS NULL',
            [c.id],
          )
        ).rows.length
      )
        throw new AppError('يوجد سحب قائم. أكمله أو ألغه قبل تجميد قائمة جديدة.', 409);
      if (criteria.excludeRanked) {
        const missing = (await this.rankedMissing(tx, c)).filter(
          (st) => criteria.stage === 'all' || criteria.stage === st,
        );
        if (missing.length)
          throw new AppError(
            `احفظ قرار فائزي ${missing.map((st) => stageNames[st]).join(' و')} قبل تجميد قائمة السحب، حتى يُستبعد أصحاب المراكز.`,
            409,
          );
      }
      const { entries, stats } = await this.pool(tx, c, criteria);
      if (!entries.length) throw new AppError('لا يوجد مشاركون مؤهلون للسحب بهذه الشروط.', 409);
      const fingerprint = await poolFingerprint(entries);
      await tx.query(
        'INSERT INTO prize_draws(id,competition_id,stage,prizes,alternates,exclude_ranked,exclude_flags,pool,pool_size,pool_fingerprint,frozen_by,frozen_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [
          id,
          c.id,
          criteria.stage === 'all' ? null : criteria.stage,
          JSON.stringify(prizes),
          alternates,
          criteria.excludeRanked,
          criteria.excludeFlags,
          JSON.stringify(entries),
          entries.length,
          fingerprint,
          actor,
          new Date(this.now()),
        ],
      );
      await audit(tx, actor, 'تجميد قائمة السحب', {
        competitionId: c.id,
        drawId: id,
        ...criteria,
        prizes,
        alternates,
        poolSize: entries.length,
        poolFingerprint: fingerprint,
        stats,
      });
    });
    return this.state(s, { id });
  }

  async commit(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const id = String(body.id ?? '');
    await this.db.transaction(async (tx) => {
      const c = await this.competitions.current(tx);
      const row = await this.row(tx, c, id, true);
      if (row.cancelled_at) throw new AppError('أُلغي هذا السحب.', 409);
      if (row.seed) throw new AppError('ثُبّتت بذرة هذا السحب من قبل.', 409);
      const seed = randomBytes(32).toString('hex');
      const commitment = await sha256Hex(seed);
      await tx.query(
        'UPDATE prize_draws SET seed=$1,seed_commitment=$2,committed_by=$3,committed_at=$4 WHERE id=$5',
        [seed, commitment, actor, new Date(this.now()), id],
      );
      await audit(tx, actor, 'تثبيت بذرة السحب', {
        competitionId: c.id,
        drawId: id,
        seedCommitment: commitment,
      });
    });
    return this.state(s, { id });
  }

  async draw(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const id = String(body.id ?? '');
    await this.db.transaction(async (tx) => {
      const c0 = await this.competitions.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c0.id]);
      const c = await this.competitions.current(tx, c0.id);
      await this.competitions.assertFinal(tx, c);
      const row = await this.row(tx, c, id, true);
      if (row.cancelled_at) throw new AppError('أُلغي هذا السحب.', 409);
      if (row.drawn_at) throw new AppError('أُجري هذا السحب من قبل.', 409);
      if (!row.seed) throw new AppError('ثبّت البذرة قبل السحب.', 409);
      const order = await drawOrder(
        row.pool,
        row.seed,
        row.pool_fingerprint,
        row.prizes.length * (1 + row.alternates),
      );
      const results = assignResults(order, row.prizes.length);
      const attempts = new Map(
        (
          await tx.query<{ id: string; participant_number: string }>(
            'SELECT id,participant_number FROM attempts WHERE competition_id=$1 AND participant_number = ANY($2::text[])',
            [c.id, results.map((r) => r.number)],
          )
        ).rows.map((r) => [r.participant_number, r.id]),
      );
      for (const r of results) {
        const attemptId = attempts.get(r.number);
        if (!attemptId) throw new AppError('تعذر مطابقة رقم مشارك في القائمة المجمدة.', 409);
        await tx.query(
          'INSERT INTO prize_draw_entries(draw_id,position,role,prize_index,attempt_id,participant_number) VALUES($1,$2,$3,$4,$5,$6)',
          [id, r.position, r.role, r.prizeIndex, attemptId, r.number],
        );
      }
      await tx.query('UPDATE prize_draws SET drawn_by=$1,drawn_at=$2 WHERE id=$3', [
        actor,
        new Date(this.now()),
        id,
      ]);
      await audit(tx, actor, 'إجراء سحب الجوائز', {
        competitionId: c.id,
        drawId: id,
        seed: row.seed,
        winners: results.filter((r) => r.role === 'winner').map((r) => r.number),
        alternates: results.filter((r) => r.role === 'alternate').map((r) => r.number),
      });
    });
    return this.state(s, { id });
  }

  async cancel(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const id = String(body.id ?? '');
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 15) throw new AppError('اكتب سبب الإلغاء (15 حرفًا على الأقل).');
    if (reason.length > 1000) throw new AppError('سبب الإلغاء طويل جدًا.');
    await this.db.transaction(async (tx) => {
      const c = await this.competitions.current(tx);
      const row = await this.row(tx, c, id, true);
      if (row.drawn_at)
        throw new AppError('لا يمكن إلغاء سحب أُجري. سجل حالة كل فائز بدلًا من ذلك.', 409);
      if (row.cancelled_at) throw new AppError('أُلغي هذا السحب من قبل.', 409);
      await tx.query(
        'UPDATE prize_draws SET cancelled_by=$1,cancelled_at=$2,cancel_reason=$3 WHERE id=$4',
        [actor, new Date(this.now()), reason, id],
      );
      await audit(tx, actor, 'إلغاء سحب الجوائز', { competitionId: c.id, drawId: id, reason });
    });
    return this.state(s);
  }

  async setStatus(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const id = String(body.id ?? '');
    const status = body.status as DrawEntryStatus;
    if (!['confirmed', 'unreachable', 'ineligible'].includes(status))
      throw new AppError('حالة غير صالحة.');
    const note = String(body.note ?? '').trim();
    if (note.length > 500) throw new AppError('الملاحظة طويلة جدًا.');
    if (status === 'ineligible' && note.length < 15)
      throw new AppError('اكتب سبب عدم الأهلية (15 حرفًا على الأقل).');
    await this.db.transaction(async (tx) => {
      const c = await this.competitions.current(tx);
      const row = await this.row(tx, c, id, true);
      if (!row.drawn_at) throw new AppError('لم يُجرَ هذا السحب بعد.', 409);
      const entries = await this.entries(tx, id);
      const holders = prizeHolders(row.prizes.length, this.holderInput(entries));
      const entry = entries.find((e) => e.position === body.position);
      if (!entry) throw new AppError('النتيجة غير موجودة.', 404);
      if (!holders.includes(entry.position))
        throw new AppError(
          'سجّل حالة صاحب الجائزة الحالي فقط. البديل يتسلّم عند تعذر الفائز.',
          409,
        );
      if (entry.status !== 'pending') throw new AppError('سُجلت حالة هذا الفائز من قبل.', 409);
      await tx.query(
        'UPDATE prize_draw_entries SET status=$1,note=$2,decided_by=$3,decided_at=$4 WHERE draw_id=$5 AND position=$6',
        [status, note || null, actor, new Date(this.now()), id, entry.position],
      );
      const after = prizeHolders(
        row.prizes.length,
        this.holderInput(
          entries.map((e) =>
            e.position === entry.position
              ? { ...e, status, decided_at: new Date(this.now()).toISOString() }
              : e,
          ),
        ),
      );
      const prize = holders.indexOf(entry.position);
      const next = after[prize];
      await audit(tx, actor, 'تحديث حالة فائز السحب', {
        competitionId: c.id,
        drawId: id,
        prize: row.prizes[prize],
        participantNumber: entry.participant_number,
        status: statusLabels[status],
        note,
        ...(failedStatus(status)
          ? {
              passedTo:
                next === null ? null : entries.find((e) => e.position === next)?.participant_number,
            }
          : {}),
      });
    });
    return this.state(s, { id });
  }

  // The proof a witness re-runs. Available only after the draw, when the seed is revealed.
  async verificationFile(s: Session, id: string): Promise<VerificationFile> {
    const actor = admin(s);
    const c = await this.competitions.current();
    const row = await this.row(this.db, c, id);
    if (!row.drawn_at || !row.seed) throw new AppError('ملف التحقق متاح بعد إجراء السحب.', 409);
    const entries = await this.entries(this.db, id);
    await audit(this.db, actor, 'تنزيل ملف التحقق من السحب', { competitionId: c.id, drawId: id });
    return {
      format: DRAW_FORMAT,
      drawId: row.id,
      competitionId: c.id,
      competitionTitle: c.title,
      stage: row.stage ?? 'all',
      prizes: row.prizes,
      alternates: row.alternates,
      criteria: [
        'مشاركة مرسلة نهائيًا في المسابقة',
        row.stage ? `المرحلة: ${stageNames[row.stage]}` : 'جميع المراحل',
        'منطقة ومدينة ضمن القائمة المعتمدة للمسابقة',
        'بيانات غير محذوفة',
        'لم يفز بجائزة في سحب سابق للمسابقة، ولا يشارك جوالًا مع فائز سابق',
        ...(row.exclude_ranked ? ['استبعاد الفائزين بالمراكز ومن يشاركهم الجوال'] : []),
        ...(row.exclude_flags ? ['استبعاد أصحاب ملاحظات القراءة والإجابة'] : []),
        'جائزة واحدة لكل جوال داخل السحب',
      ],
      frozenAt: iso(row.frozen_at)!,
      drawnAt: iso(row.drawn_at)!,
      pool: row.pool,
      poolFingerprint: row.pool_fingerprint,
      seedCommitment: row.seed_commitment!,
      seed: row.seed,
      algorithm: DRAW_ALGORITHM,
      results: entries.map((e) => ({
        position: e.position,
        role: e.role,
        prizeIndex: e.prize_index,
        number: e.participant_number,
      })),
    };
  }

  // What the projector shows: participant number and first name only.
  async screen(s: Session): Promise<ScreenState> {
    admin(s);
    const c = await this.competitions.current();
    const row = (
      await this.db.query<DrawRow>(
        'SELECT * FROM prize_draws WHERE competition_id=$1 AND cancelled_at IS NULL ORDER BY (drawn_at IS NULL) DESC,frozen_at DESC LIMIT 1',
        [c.id],
      )
    ).rows[0];
    if (!row)
      return { drawId: null, phase: 'idle', stage: null, poolSize: 0, drawnAt: null, winners: [] };
    const winners = row.drawn_at
      ? (
          await this.db.query<{
            prize_index: number;
            participant_number: string;
            name: string;
            erased_at: string | null;
          }>(
            "SELECT e.prize_index,e.participant_number,p.name,p.erased_at FROM prize_draw_entries e JOIN attempts a ON a.id=e.attempt_id JOIN participants p ON p.id=a.participant_id WHERE e.draw_id=$1 AND e.role='winner' ORDER BY e.prize_index",
            [row.id],
          )
        ).rows.map((w) => ({
          prize: row.prizes[w.prize_index],
          number: w.participant_number,
          firstName: w.erased_at ? '' : w.name.trim().split(/\s+/)[0],
        }))
      : [];
    return {
      drawId: row.id,
      phase: row.drawn_at ? 'drawn' : row.seed ? 'committed' : 'frozen',
      stage: row.stage ?? 'all',
      poolSize: row.pool_size,
      drawnAt: iso(row.drawn_at),
      winners,
    };
  }
}
