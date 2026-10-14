import { randomUUID, randomInt } from 'node:crypto';
import type { Database, Queryable } from './database';
import { AppError } from './domain';
import type { Session, ParticipantReport } from './service';
import { CompetitionService, snapshotQuestions } from './competition-service';
import {
  effectiveState,
  questionCount,
  registeredStage,
  stageKeys,
  stageNames,
  validateQuestion,
  type Competition,
  type CompetitionQuestion,
  type Stage,
} from './competition-domain';
import { isLocalMode } from './runtime';
import {
  PRACTICE_ENTRY_MS,
  PRACTICE_FINISH_MS,
  practiceStatus,
  type SimulationRun,
} from './simulation-domain';

export class SimulationService {
  private engine: CompetitionService;
  constructor(
    private db: Database,
    private now = () => Date.now(),
  ) {
    this.engine = new CompetitionService(db, now);
  }
  private require(s: Session, role: 'admin' | 'participant') {
    if (!s || s.role !== role) throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  }
  private async latest(tx: Queryable, competitionId: string) {
    return (
      await tx.query<SimulationRun>(
        'SELECT * FROM simulation_runs WHERE competition_id=$1 ORDER BY opened_at DESC,id DESC LIMIT 1',
        [competitionId],
      )
    ).rows[0];
  }
  async status() {
    const c = await this.engine.current();
    const run = await this.latest(this.db, c.id);
    return {
      run: run ? practiceStatus(run, effectiveState(c, this.now()) === 'DRAFT', this.now()) : null,
    };
  }
  async bank(c: Competition, tx: Queryable) {
    const book = await this.engine.book(c, tx);
    await this.engine.verifyBook(book);
    const banks = {} as Record<Stage, CompetitionQuestion[]>;
    for (const stage of stageKeys) {
      const frozen = (
        await tx.query<{ questions: CompetitionQuestion[] }>(
          'SELECT questions FROM competition_question_sets WHERE competition_id=$1 AND stage=$2',
          [c.id, stage],
        )
      ).rows[0];
      const questions =
        frozen?.questions ??
        (
          await tx.query<{ body: CompetitionQuestion }>(
            "SELECT body FROM questions WHERE body->>'active'='true' AND body->>'stage'=$1 AND body->>'bookVersionId'=$2 ORDER BY id",
            [stage, book.id],
          )
        ).rows.map((r) => r.body);
      if (questions.length !== questionCount(c, stage))
        throw new AppError(
          `بنك ${stageNames[stage]} يحتاج ${questionCount(c, stage)} سؤالًا صالحًا قبل فتح التجربة.`,
          409,
        );
      for (const q of questions) {
        if (q.bookVersionId !== book.id || q.stage !== stage || (!isLocalMode() && q.fixture))
          throw new AppError('التجربة تتطلب أسئلة كتاب المسابقة الحالي دون أسئلة اصطناعية.', 409);
        validateQuestion(q, book);
      }
      banks[stage] = questions;
    }
    return banks;
  }
  async admin(s: Session, checkBank = true) {
    this.require(s, 'admin');
    const c = await this.engine.current();
    const run = await this.latest(this.db, c.id);
    let blocker =
      effectiveState(c, this.now()) !== 'DRAFT'
        ? 'نافذة التجربة متاحة عندما تكون المسابقة مسودة فقط.'
        : '';
    if (checkBank && !blocker && (!run || this.now() >= new Date(run.finish_until).getTime())) {
      try {
        await this.bank(c, this.db);
      } catch (e) {
        if (!(e instanceof AppError)) throw e;
        blocker = e.message;
      }
    }
    const participants = run
      ? (
          await this.db.query<ParticipantReport>(
            `SELECT p.id,p.name,a.stage,p.institution,p.gender,p.region,p.locality,p.village,
       a.created_at,a.created_at AS attempt_started_at,a.id AS attempt_id,a.submitted_at,
       a.score,jsonb_array_length(a.questions) AS max_score,NULL::text AS receipt,'[]'::jsonb AS reading_flags
       FROM simulation_attempts a JOIN participants p ON p.id=a.participant_id WHERE a.run_id=$1 ORDER BY a.created_at`,
            [run.id],
          )
        ).rows
      : [];
    return {
      run: run ? practiceStatus(run, effectiveState(c, this.now()) === 'DRAFT', this.now()) : null,
      blocker,
      participants: participants.map((p) => ({ ...p, stage: stageNames[p.stage as Stage] })),
    };
  }
  async open(s: Session) {
    this.require(s, 'admin');
    await this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM settings WHERE id='current_competition' FOR UPDATE");
      const c = await this.engine.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c.id]);
      if (effectiveState(c, this.now()) !== 'DRAFT')
        throw new AppError('أبقِ المسابقة مسودة أثناء التجربة.', 409);
      const previous = await this.latest(tx, c.id);
      if (previous && this.now() < new Date(previous.finish_until).getTime())
        throw new AppError(
          'توجد نافذة تجربة أو مهلة إكمال قائمة. انتظر انتهاءها.',
          409,
          'PRACTICE_ACTIVE',
        );
      const banks = await this.bank(c, tx);
      const id = randomUUID(),
        now = this.now();
      await tx.query(
        'INSERT INTO simulation_runs(id,competition_id,actor,config,banks,opened_at,entry_closes_at,finish_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          id,
          c.id,
          s.actor ?? s.role,
          JSON.stringify(c),
          JSON.stringify(banks),
          new Date(now),
          new Date(now + PRACTICE_ENTRY_MS),
          new Date(now + PRACTICE_ENTRY_MS + PRACTICE_FINISH_MS),
        ],
      );
      await this.audit(tx, s, 'فتح نافذة التجربة', id);
    });
    return this.admin(s);
  }
  async close(s: Session, id: unknown, version: unknown) {
    this.require(s, 'admin');
    if (typeof id !== 'string' || !Number.isInteger(version))
      throw new AppError('بيانات النافذة غير صالحة.');
    await this.db.transaction(async (tx) => {
      const run = (
        await tx.query<SimulationRun>('SELECT * FROM simulation_runs WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!run) throw new AppError('نافذة التجربة غير موجودة.', 404);
      const closedAt = this.now();
      if (run.closed_at || closedAt >= new Date(run.entry_closes_at).getTime()) return;
      if (run.version !== version)
        throw new AppError('تغيرت النافذة. حدّث حالتها وأعد المحاولة.', 409);
      await tx.query(
        'UPDATE simulation_runs SET closed_at=$1,entry_closes_at=$1,finish_until=$2,version=version+1 WHERE id=$3',
        [new Date(closedAt), new Date(closedAt + PRACTICE_FINISH_MS), id],
      );
      await this.audit(tx, s, 'إغلاق دخول التجربة', id);
    });
    return this.admin(s);
  }
  private async audit(tx: Queryable, s: Session, action: string, runId: string) {
    await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
      s.actor ?? s.participant_id ?? s.role,
      action,
      JSON.stringify({ simulation: true, runId }),
    ]);
  }
  async start(s: Session, runId: unknown) {
    this.require(s, 'participant');
    if (typeof runId !== 'string') throw new AppError('نافذة غير صالحة.');
    await this.db.transaction(async (tx) => {
      const p = (
        await tx.query<{ stage: string }>('SELECT stage FROM participants WHERE id=$1 FOR UPDATE', [
          s.participant_id,
        ])
      ).rows[0];
      if (!p) throw new AppError('المشارك غير موجود.', 404);
      const row = (
        await tx.query<SimulationRun>('SELECT * FROM simulation_runs WHERE id=$1', [runId])
      ).rows[0];
      if (!row) throw new AppError('نافذة التجربة غير موجودة.', 404);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR SHARE', [row.competition_id]);
      const c = await this.engine.current(tx);
      const run = (
        await tx.query<SimulationRun>('SELECT * FROM simulation_runs WHERE id=$1 FOR SHARE', [
          runId,
        ])
      ).rows[0];
      const existing = (
        await tx.query('SELECT id FROM simulation_attempts WHERE run_id=$1 AND participant_id=$2', [
          runId,
          s.participant_id,
        ])
      ).rows[0];
      if (existing) return;
      if (
        c.id !== run.competition_id ||
        !practiceStatus(run, effectiveState(c, this.now()) === 'DRAFT', this.now()).entryOpen
      )
        throw new AppError(
          'أُغلق الدخول إلى التجربة. المشاركات القائمة تتابع ضمن مهلة الإكمال.',
          409,
          'PRACTICE_ENTRY_CLOSED',
        );
      const stage = registeredStage(p.stage);
      await tx.query(
        'INSERT INTO simulation_attempts(id,run_id,participant_id,stage,participant_number,questions,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          randomUUID(),
          runId,
          s.participant_id,
          stage,
          `PRACTICE-${randomInt(100000, 999999)}`,
          JSON.stringify(snapshotQuestions(run.banks[stage])),
          new Date(this.now()),
        ],
      );
      await this.audit(tx, s, 'بدء تجربة مشارك', runId);
    });
    return this.engine.practiceState(s, runId);
  }
}
