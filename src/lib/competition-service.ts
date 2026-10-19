import { practiceCompetition, practiceStatus, type SimulationRun } from './simulation-domain';
import { randomInt, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database, Queryable } from './database';
import { AppError } from './domain';
import type { Session } from './service';
import { isLocalMode } from './runtime';
import {
  readingVisit,
  sourceReadingReady,
  type ReadingProgress,
  type ReadingVisit,
} from './reading-progress';
import { defaultPrizes, type PrizeSettings } from './prizes';
import {
  PLACES,
  awardAmount,
  awardKey,
  evaluateStage,
  reasonProblem,
  type Candidate,
  type WinnersAnnouncement,
} from './winners';
import { registrationState } from './competition-domain';
import { BookStore } from './book-store';
import { resolveEligibility, validateEligibility, type Eligibility } from './eligibility';
import {
  applyEvent,
  finalSubmission,
  meetingQuestionCounts,
  questionCount,
  assertWindow,
  effectiveState,
  rankResults,
  registeredStage,
  safeQuestions,
  stageKeys,
  stageNames,
  orderByPage,
  questionOrders,
  guideGaps,
  validateBank,
  validateQuestion,
  type AnswerMap,
  type BookVersion,
  type Competition,
  type CompetitionQuestion,
  type CompetitionState,
  type QuestionOrder,
  type Stage,
  type Standing,
  type WriteEvent,
} from './competition-domain';

export const officialBook: BookVersion = {
  id: 'national-belonging-ec07ef57',
  title: 'الانتماء واللحمة الوطنية',
  url: '/books/ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd.pdf',
  sha256: 'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd',
  pageCount: 66,
  approved: false,
};
export function newCompetition(id: string, bookVersionId = officialBook.id): Competition {
  return {
    id,
    title: 'مسابقة الانتماء واللحمة الوطنية 1448 / 2026',
    state: 'DRAFT',
    opensAt: null,
    closesAt: null,
    closedAt: null,
    feedbackMode: 'educational',
    leaderboardMode: 'publish_after_close',
    closingPolicy: 'grace',
    graceMinutes: 60,
    bookVersionId,
    frozenAt: null,
    version: 1,
    questionCounts: { ...meetingQuestionCounts },
    answerMode: 'final_submission',
  };
}
function requireRole(s: Session, roles: string[]) {
  if (!s || !roles.includes(s.role)) throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
}
function actor(s: Session) {
  return s.actor ?? s.participant_id ?? s.role;
}
async function audit(tx: Queryable, s: Session, action: string, detail: unknown) {
  await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
    actor(s),
    action,
    JSON.stringify(detail),
  ]);
}
type AttemptRow = {
  id: string;
  competition_id: string;
  questions: CompetitionQuestion[];
  answers: AnswerMap;
  revision: number;
  submitted_at: string | null;
  score: number | null;
  percentage: number | null;
  participant_number: string;
  receipt?: string | null;
  stage: Stage;
  invalidated_at?: string | null;
  recovery_until?: string | null;
  config?: Competition;
  reading?: ReadingProgress;
};
function shuffled<T>(items: T[]): T[] {
  const next = structuredClone(items);
  for (let i = next.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
export function snapshotQuestions(
  questions: CompetitionQuestion[],
  order: QuestionOrder = 'random',
) {
  // Answer options are shuffled either way; book order only changes the question sequence.
  const sequence = order === 'page' ? orderByPage(shuffled(questions)) : shuffled(questions);
  return sequence.map((q) => {
    const indices = q.options.map((_, i) => i);
    const order = q.preserveOptionOrder ? indices : shuffled(indices);
    const correctAnswers = q.correctAnswers.map((i) => order.indexOf(i));
    return {
      ...q,
      options: order.map((i) => q.options[i]),
      correctAnswers,
      correct: correctAnswers[0],
    };
  });
}
export class CompetitionService {
  constructor(
    private db: Database,
    private now: () => number = Date.now,
  ) {}
  async current(tx: Queryable = this.db, id?: string): Promise<Competition> {
    const currentId =
      id ??
      (
        await tx.query<{ value: string }>(
          "SELECT value FROM settings WHERE id='current_competition'",
        )
      ).rows[0]?.value;
    const c = (
      await tx.query<{ body: Competition }>('SELECT body FROM competitions WHERE id=$1', [
        currentId,
      ])
    ).rows[0]?.body;
    if (!c || c.id === 'legacy-demo') throw new AppError('المسابقة غير مهيأة.', 409);
    return c;
  }
  // Public registration options. Existing participants keep their stored region and city.
  // Registration policy for the OTP service: open/closed, per-phone cap and the allowed places.
  async registrationInfo() {
    const c = await this.current().catch(() => null);
    return {
      eligibility: resolveEligibility(c),
      ...(c ? registrationState(c, this.now()) : { open: true, reason: null, maxPerPhone: 3 }),
    };
  }
  // Public, read-only summary the home and registration pages use.
  async publicStatus() {
    const c = await this.current();
    const state = effectiveState(c, this.now());
    return {
      title: c.title,
      state,
      opensAt: c.opensAt,
      closesAt: c.closesAt,
      closedAt: c.closedAt,
      registration: registrationState(c, this.now()),
      winnersPublished: await this.isPublished(this.db, c.id),
      questionCounts: Object.fromEntries(
        stageKeys.map((stage) => [stage, questionCount(c, stage)]),
      ) as Record<Stage, number>,
      answerMode: c.answerMode ?? 'per_question',
      questionOrder: c.questionOrder ?? 'random',
    };
  }
  async registrationOptions(): Promise<Eligibility> {
    // Before the first competition record exists the original default (الشرقية) applies.
    return resolveEligibility(await this.current().catch(() => null));
  }
  async book(c: Competition, tx: Queryable = this.db) {
    const book = (
      await tx.query<{ body: BookVersion }>('SELECT body FROM book_versions WHERE id=$1', [
        c.bookVersionId,
      ])
    ).rows[0]?.body;
    if (!book) throw new AppError('نسخة الكتاب غير موجودة.', 409);
    return book;
  }
  async practiceState(
    s: Session,
    runId: string,
    tx: Queryable = this.db,
  ): Promise<CompetitionState> {
    requireRole(s, ['participant']);
    const run = (
      await tx.query<SimulationRun>('SELECT * FROM simulation_runs WHERE id=$1', [runId])
    ).rows[0];
    if (!run) throw new AppError('نافذة التجربة غير موجودة.', 404);
    const p = (
      await tx.query<{ name: string; stage: string }>(
        'SELECT name,stage FROM participants WHERE id=$1',
        [s.participant_id],
      )
    ).rows[0];
    if (!p) throw new AppError('المشارك غير موجود.', 404);
    const a = (
      await tx.query<AttemptRow>(
        'SELECT * FROM simulation_attempts WHERE run_id=$1 AND participant_id=$2',
        [runId, s.participant_id],
      )
    ).rows[0];
    if (a) a.reading = await this.readingProgress(tx, a.id, 'simulation');
    const official = await this.current(tx);
    const status = practiceStatus(
      run,
      official.id === run.competition_id && effectiveState(official, this.now()) === 'DRAFT',
      this.now(),
    );
    const config = practiceCompetition(run, Boolean(a));
    if (a ? !status.canFinish : !status.entryOpen) config.state = 'CLOSED';
    return {
      ...this.project(
        config,
        await this.book(config, tx),
        a,
        p.name,
        a ? stageNames[a.stage] : p.stage,
      ),
      practice: status,
    };
  }
  private async practiceRow(tx: Queryable, s: Session, id: string) {
    const owner = (
      await tx.query<{ run_id: string }>(
        'SELECT run_id FROM simulation_attempts WHERE id=$1 AND participant_id=$2',
        [id, s.participant_id],
      )
    ).rows[0];
    if (!owner) throw new AppError('التجربة غير موجودة.', 404);
    const row = (
      await tx.query<SimulationRun>('SELECT * FROM simulation_runs WHERE id=$1', [owner.run_id])
    ).rows[0];
    await tx.query('SELECT id FROM competitions WHERE id=$1 FOR SHARE', [row.competition_id]);
    const run = (
      await tx.query<SimulationRun>('SELECT * FROM simulation_runs WHERE id=$1 FOR SHARE', [
        owner.run_id,
      ])
    ).rows[0];
    const a = (
      await tx.query<AttemptRow>(
        'SELECT * FROM simulation_attempts WHERE id=$1 AND participant_id=$2 FOR UPDATE',
        [id, s.participant_id],
      )
    ).rows[0];
    return { run, a, c: practiceCompetition(run, true) };
  }
  private async assertPractice(tx: Queryable, c: Competition) {
    const official = await this.current(tx);
    if (
      official.id !== c.id ||
      effectiveState(official, this.now()) !== 'DRAFT' ||
      this.now() >= Date.parse(c.closesAt!)
    )
      throw new AppError(
        'انتهت مهلة التجربة. تبقى الإجابات المعلقة محفوظة على جهازك.',
        409,
        'PRACTICE_EXPIRED',
      );
  }
  async readingProgress(
    tx: Queryable,
    id: string,
    test: boolean | 'simulation',
  ): Promise<ReadingProgress> {
    const table =
      test === 'simulation' ? 'simulation_events' : test ? 'admin_test_events' : 'attempt_events';
    const owner = test === true ? 'run_id' : 'attempt_id';
    const rows = (
      await tx.query<{ page: string; seconds: number }>(
        `SELECT payload->>'page' AS page, SUM((payload->>'creditedSeconds')::double precision) AS seconds FROM ${table} WHERE ${owner}=$1 AND payload->>'kind'='READ' GROUP BY payload->>'page'`,
        [id],
      )
    ).rows;
    return {
      pageSeconds: Object.fromEntries(rows.map((r) => [Number(r.page), Number(r.seconds)])),
    };
  }
  async recordReading(
    s: Session,
    body: Record<string, unknown>,
    test: boolean | 'simulation' = false,
  ) {
    const simulation = test === 'simulation';
    requireRole(s, test === true ? ['admin'] : ['participant']);
    if (
      typeof body.attemptId !== 'string' ||
      typeof body.clientEventId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(body.clientEventId) ||
      !Number.isInteger(body.page) ||
      typeof body.active !== 'boolean'
    )
      throw new AppError('تقدم القراءة غير صالح.');
    return this.db.transaction(async (tx) => {
      const practice = simulation ? await this.practiceRow(tx, s, String(body.attemptId)) : null;
      const table = test ? 'admin_test_runs' : 'attempts';
      const owner = test ? 'actor' : 'participant_id';
      const a =
        practice?.a ??
        (
          await tx.query<AttemptRow & { invalidated_at?: string }>(
            `SELECT * FROM ${table} WHERE id=$1 AND ${owner}=$2 FOR UPDATE`,
            [body.attemptId, test ? actor(s) : s.participant_id],
          )
        ).rows[0];
      if (!a || a.invalidated_at)
        throw new AppError('الجلسة غير متاحة. افتح التجربة الحالية.', 409);
      if (test === true && !isLocalMode() && a.questions.some((q) => q.fixture))
        throw new AppError('ابدأ تجربة جديدة من بنك المسابقة.', 409, 'TEST_BANK_REPLACED');
      const c = practice?.c ?? (test ? a.config! : await this.current(tx, a.competition_id));
      if (a.submitted_at) return this.readingProgress(tx, a.id, test);
      if (simulation) await this.assertPractice(tx, c);
      else assertWindow(c, true, this.now(), a.recovery_until);
      const book = await this.book(c, tx);
      if (Number(body.page) < 1 || Number(body.page) > book.pageCount)
        throw new AppError('صفحة خارج نطاق الكتاب.');
      const events = simulation
        ? 'simulation_events'
        : test
          ? 'admin_test_events'
          : 'attempt_events';
      const key = test === true ? 'run_id' : 'attempt_id';
      const existing = (
        await tx.query<{ payload: { page: number; active: boolean } }>(
          `SELECT payload FROM ${events} WHERE ${key}=$1 AND client_event_id=$2`,
          [a.id, body.clientEventId],
        )
      ).rows[0];
      if (existing) {
        if (existing.payload.page !== body.page || existing.payload.active !== body.active)
          throw new AppError('معرف الحدث مستخدم لمحتوى آخر.', 409, 'EVENT_REUSED');
        return this.readingProgress(tx, a.id, test);
      }
      const previous = (
        await tx.query<{ payload: ReadingVisit }>(
          `SELECT payload FROM ${events} WHERE ${key}=$1 AND payload->>'kind'='READ' ORDER BY (payload->>'acceptedAt')::bigint DESC LIMIT 1`,
          [a.id],
        )
      ).rows[0]?.payload;
      const visit = readingVisit(previous, Number(body.page), body.active === true, this.now());
      await tx.query(`INSERT INTO ${events}(${key},client_event_id,payload) VALUES($1,$2,$3)`, [
        a.id,
        body.clientEventId,
        JSON.stringify({ kind: 'READ', ...visit }),
      ]);
      if (visit.flags.length)
        await audit(tx, s, 'ملاحظة على وتيرة القراءة', {
          competitionId: c.id,
          attemptId: a.id,
          testRun: Boolean(test),
          simulation,
          page: visit.page,
          previousPage: previous?.page,
          flags: visit.flags,
        });
      return this.readingProgress(tx, a.id, test);
    });
  }
  // Each time the exam moved a student's book to an answer page. Committee analytics only.
  async recordGuide(
    s: Session,
    body: Record<string, unknown>,
    test: boolean | 'simulation' = false,
  ) {
    const simulation = test === 'simulation';
    requireRole(s, test === true ? ['admin'] : ['participant']);
    if (
      typeof body.attemptId !== 'string' ||
      typeof body.clientEventId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(body.clientEventId) ||
      typeof body.questionId !== 'string' ||
      !guideGaps.includes(body.gap as (typeof guideGaps)[number])
    )
      throw new AppError('حدث الإرشاد غير صالح.');
    await this.db.transaction(async (tx) => {
      const practice = simulation ? await this.practiceRow(tx, s, String(body.attemptId)) : null;
      const a =
        practice?.a ??
        (
          await tx.query<AttemptRow & { invalidated_at?: string }>(
            `SELECT * FROM ${test ? 'admin_test_runs' : 'attempts'} WHERE id=$1 AND ${test ? 'actor' : 'participant_id'}=$2`,
            [body.attemptId, test ? actor(s) : s.participant_id],
          )
        ).rows[0];
      if (!a || a.invalidated_at)
        throw new AppError('الجلسة غير متاحة. افتح التجربة الحالية.', 409);
      if (a.submitted_at) return;
      if (!a.questions.some((q) => q.id === body.questionId))
        throw new AppError('السؤال غير موجود.');
      const events = simulation
        ? 'simulation_events'
        : test
          ? 'admin_test_events'
          : 'attempt_events';
      await tx.query(
        `INSERT INTO ${events}(${test === true ? 'run_id' : 'attempt_id'},client_event_id,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [
          a.id,
          body.clientEventId,
          JSON.stringify({
            kind: 'GUIDE',
            questionId: body.questionId,
            gap: body.gap,
            acceptedAt: this.now(),
          }),
        ],
      );
    });
    return { ok: true };
  }
  async readAttempt(tx: Queryable, participantId: string | null, c: Competition, lock = false) {
    const a = (
      await tx.query<AttemptRow>(
        `SELECT * FROM attempts WHERE participant_id=$1 AND competition_id=$2${lock ? ' FOR UPDATE' : ''}`,
        [participantId, c.id],
      )
    ).rows[0];
    if (a) {
      const rows = (
        await tx.query<{ question_id: string; selected: number[]; checked_at: string | null }>(
          'SELECT question_id,selected,checked_at FROM attempt_answers WHERE attempt_id=$1',
          [a.id],
        )
      ).rows;
      a.reading = await this.readingProgress(tx, a.id, false);
      a.answers = Object.fromEntries(
        rows.map((r) => [
          r.question_id,
          { selected: r.selected, locked: !!r.checked_at, checkedAt: r.checked_at },
        ]),
      );
    }
    return a;
  }
  project(
    c: Competition,
    book: BookVersion,
    a: AttemptRow | undefined,
    name: string,
    stage: string,
    testRun = false,
  ): CompetitionState {
    const visible = c.leaderboardMode !== 'hidden';
    return {
      participant: { name, stage },
      competition: {
        ...c,
        readingRequired: a?.questions.some((q) => !q.fixture) ?? false,
        feedbackMode: 'educational',
        state: effectiveState(c, this.now()),
      },
      book,
      published: effectiveState(c, this.now()) === 'RESULTS_PUBLISHED',
      testRun,
      ...(testRun
        ? {
            testQuestionSource: a?.questions.some((q) => q.fixture)
              ? ('synthetic' as const)
              : ('bank' as const),
          }
        : {}),
      attempt: a
        ? {
            id: a.id,
            questions: a.submitted_at ? [] : safeQuestions(a.questions),
            answers: a.submitted_at ? {} : a.answers,
            reading: a.submitted_at ? { pageSeconds: {} } : (a.reading ?? { pageSeconds: {} }),
            // Both participant and rehearsal responses disclose only the aggregate score.
            feedback: {},
            revision: a.revision,
            submittedAt: a.submitted_at,
            participantNumber: a.participant_number,
            receipt: a.receipt ?? null,
            score: visible && a.submitted_at ? a.score : null,
            maxScore: a.questions.length,
            percentage: visible && a.submitted_at ? a.percentage : null,
            recoveryUntil: a.recovery_until ?? null,
          }
        : null,
    };
  }
  async state(s: Session, id?: string) {
    requireRole(s, ['participant']);
    return this.db.transaction(async (tx) => {
      const c = await this.current(tx, id);
      const p = (
        await tx.query<{ name: string; stage: string }>(
          'SELECT id,name,stage,region,locality,institution,gender FROM participants WHERE id=$1',
          [s.participant_id],
        )
      ).rows[0];
      if (!p) throw new AppError('المشارك غير موجود.', 404);
      return {
        ...this.project(
          c,
          await this.book(c, tx),
          await this.readAttempt(tx, s.participant_id, c),
          p.name,
          p.stage,
        ),
        participant: p,
      };
    });
  }
  async start(s: Session) {
    requireRole(s, ['participant']);
    await this.db.transaction(async (tx) => {
      // Participant lock protects concurrent starts and stage lookup on PostgreSQL as well as PGlite.
      const p = (
        await tx.query<{ stage: string }>('SELECT stage FROM participants WHERE id=$1 FOR UPDATE', [
          s.participant_id,
        ])
      ).rows[0];
      if (!p) throw new AppError('المشارك غير موجود.', 404);
      let c = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c.id]);
      c = await this.current(tx, c.id);
      if (await this.readAttempt(tx, s.participant_id, c)) return;
      assertWindow(c, false, this.now());
      if (!c.frozenAt) throw new AppError('اعتمد نسخة المسابقة قبل فتحها.', 409);
      const stage = registeredStage(p.stage);
      const bank = (
        await tx.query<{ questions: CompetitionQuestion[] }>(
          'SELECT questions FROM competition_question_sets WHERE competition_id=$1 AND stage=$2',
          [c.id, stage],
        )
      ).rows[0]?.questions;
      if (!bank || bank.length !== questionCount(c, stage))
        throw new AppError('بنك المرحلة غير مكتمل.', 409);
      const questions = snapshotQuestions(bank, c.questionOrder);
      const id = randomUUID();
      let number: string;
      // Campaign row lock serializes random number reservation, without sequential public identifiers.
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c.id]);
      do {
        number = String(randomInt(100000, 100000000));
      } while (
        (
          await tx.query(
            'SELECT id FROM attempts WHERE competition_id=$1 AND participant_number=$2',
            [c.id, number],
          )
        ).rows.length
      );
      await tx.query(
        'INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [id, s.participant_id, c.id, stage, number, JSON.stringify(questions), questions.length],
      );
      for (const [i, q] of questions.entries())
        await tx.query('INSERT INTO attempt_questions VALUES($1,$2,$3,$4)', [
          id,
          q.id,
          i,
          JSON.stringify(q),
        ]);
      await audit(tx, s, 'بدء مشاركة', { competitionId: c.id, attemptId: id, stage });
    });
    return this.state(s);
  }
  async write(s: Session, e: WriteEvent, test: boolean | 'simulation' = false) {
    const simulation = test === 'simulation';
    requireRole(s, test === true ? ['admin'] : ['participant']);
    if (
      !e ||
      typeof e.clientEventId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(e.clientEventId) ||
      typeof e.attemptId !== 'string' ||
      !Number.isInteger(e.revision)
    )
      throw new AppError('حدث المزامنة غير صالح.');
    const payload = JSON.stringify({
      kind: e.kind,
      questionId: e.questionId,
      selected: e.selected,
      acceptedAt: this.now(),
    });
    let competitionId = '';
    let simulationRunId = '';
    await this.db.transaction(async (tx) => {
      let a: AttemptRow;
      let c: Competition;
      if (simulation) {
        const practice = await this.practiceRow(tx, s, e.attemptId);
        a = practice.a;
        c = practice.c;
        simulationRunId = practice.run.id;
      } else if (test) {
        const run = (
          await tx.query<AttemptRow>(
            'SELECT * FROM admin_test_runs WHERE id=$1 AND actor=$2 FOR UPDATE',
            [e.attemptId, actor(s)],
          )
        ).rows[0];
        if (!run) throw new AppError('التجربة غير موجودة.', 404);
        if ((run as AttemptRow & { invalidated_at?: string }).invalidated_at)
          throw new AppError('أُعيدت هذه التجربة. افتح الجلسة الجديدة.', 409, 'TEST_RESET');
        if (!isLocalMode() && run.questions.some((q) => q.fixture))
          throw new AppError(
            'هذه تجربة سابقة بأسئلة اصطناعية. ابدأ تجربة جديدة لاستخدام أسئلة بنك المسابقة.',
            409,
            'TEST_BANK_REPLACED',
          );
        a = run;
        c = run.config!;
      } else {
        const row = (
          await tx.query<AttemptRow>('SELECT * FROM attempts WHERE id=$1 AND participant_id=$2', [
            e.attemptId,
            s.participant_id,
          ])
        ).rows[0];
        if (!row || row.competition_id === 'legacy-demo')
          throw new AppError('المشاركة غير موجودة.', 404);
        await tx.query('SELECT id FROM competitions WHERE id=$1 FOR SHARE', [row.competition_id]);
        c = await this.current(tx, row.competition_id);
        a = (await this.readAttempt(tx, s.participant_id, c, true))!;
      }
      competitionId = c.id;
      const eventTable = simulation
        ? 'simulation_events'
        : test
          ? 'admin_test_events'
          : 'attempt_events';
      const ownerColumn = test === true ? 'run_id' : 'attempt_id';
      const old = (
        await tx.query<{ payload: unknown }>(
          `SELECT payload FROM ${eventTable} WHERE ${ownerColumn}=$1 AND client_event_id=$2`,
          [a.id, e.clientEventId],
        )
      ).rows[0];
      if (old) {
        if (JSON.stringify(old.payload) !== JSON.stringify(JSON.parse(payload))) {
          // JSONB property order is not stable; compare canonical individual fields.
          const o = old.payload as Record<string, unknown>;
          const n = JSON.parse(payload);
          if (
            o.kind !== n.kind ||
            o.questionId !== n.questionId ||
            JSON.stringify(o.selected) !== JSON.stringify(n.selected)
          )
            throw new AppError('معرف الحدث مستخدم لمحتوى آخر.', 409, 'EVENT_REUSED');
        }
        return;
      }
      if (a.submitted_at) {
        if (e.kind === 'SUBMIT') return;
        throw new AppError('المشاركة مكتملة.', 409, 'SUBMITTED');
      }
      if (simulation) await this.assertPractice(tx, c);
      else assertWindow(c, true, this.now(), a.recovery_until);
      const reading = await this.readingProgress(tx, a.id, test);
      const needsReading = (q: CompetitionQuestion) =>
        !q.fixture && !sourceReadingReady(reading, q);
      if (
        e.kind === 'SUBMIT'
          ? a.questions.some(needsReading)
          : a.questions.some((q) => q.id === e.questionId && needsReading(q))
      )
        throw new AppError(
          'تصفّح موضع السؤال في الكتاب بهدوء قبل تسجيل الإجابة والمتابعة.',
          409,
          'READING_REQUIRED',
        );
      const result = applyEvent(
        a.questions,
        a.answers,
        a.revision,
        e,
        new Date(this.now()).toISOString(),
        (
          await tx.query<{ question_id: string }>(
            'SELECT question_id FROM competition_corrections WHERE competition_id=$1 AND $2=false',
            [c.id, Boolean(test)],
          )
        ).rows.map((r) => r.question_id),
        c,
      );
      if (e.kind === 'SELECT' && a.questions.some((q) => !q.fixture)) {
        const previousAnswer = (
          await tx.query<{ payload: { acceptedAt?: number; questionId?: string } }>(
            `SELECT payload FROM ${eventTable} WHERE ${ownerColumn}=$1 AND payload->>'kind'='SELECT' ORDER BY (payload->>'acceptedAt')::bigint DESC NULLS LAST LIMIT 1`,
            [a.id],
          )
        ).rows[0]?.payload;
        if (
          !a.answers[e.questionId!]?.selected.length &&
          previousAnswer?.acceptedAt !== undefined &&
          previousAnswer.questionId !== e.questionId &&
          this.now() - previousAnswer.acceptedAt < 1500
        )
          await audit(tx, s, 'ملاحظة على وتيرة الإجابة', {
            competitionId: c.id,
            attemptId: a.id,
            testRun: Boolean(test),
            simulation,
            flags: ['rapid_answers'],
          });
      }
      if (test) {
        await tx.query(
          `UPDATE ${simulation ? 'simulation_attempts' : 'admin_test_runs'} SET answers=$1,revision=revision+1,submitted_at=$2,score=$3,percentage=$4 WHERE id=$5`,
          [
            JSON.stringify(result.answers),
            e.kind === 'SUBMIT' ? new Date(this.now()) : null,
            result.score ?? null,
            result.percentage ?? null,
            a.id,
          ],
        );
      } else {
        if (e.kind !== 'SUBMIT') {
          const answer = result.answers[e.questionId!];
          await tx.query(
            'INSERT INTO attempt_answers(attempt_id,question_id,selected,checked_at) VALUES($1,$2,$3,$4) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected=excluded.selected,checked_at=excluded.checked_at,synced_at=now()',
            [a.id, e.questionId, JSON.stringify(answer.selected), answer.checkedAt],
          );
        }
        if (e.kind === 'SUBMIT' && finalSubmission(c)) {
          for (const [questionId, answer] of Object.entries(result.answers))
            await tx.query(
              'UPDATE attempt_answers SET checked_at=$1,synced_at=now() WHERE attempt_id=$2 AND question_id=$3',
              [answer.checkedAt, a.id, questionId],
            );
        }
        await tx.query(
          'UPDATE attempts SET revision=revision+1,submitted_at=$1,score=$2,percentage=$3,receipt=$4 WHERE id=$5',
          [
            e.kind === 'SUBMIT' ? new Date(this.now()) : null,
            result.score ?? null,
            result.percentage ?? null,
            e.kind === 'SUBMIT' ? `NBC-${a.participant_number}` : null,
            a.id,
          ],
        );
        if (e.kind === 'SUBMIT')
          await audit(tx, s, 'إرسال نهائي', {
            competitionId: c.id,
            attemptId: a.id,
            participantNumber: a.participant_number,
          });
      }
      await tx.query(
        `INSERT INTO ${eventTable}(${ownerColumn},client_event_id,payload) VALUES($1,$2,$3)`,
        [a.id, e.clientEventId, payload],
      );
    });
    return simulation
      ? this.practiceState(s, simulationRunId)
      : test
        ? this.testState(s, e.attemptId)
        : this.state(s, competitionId);
  }
  async leaderboard(
    id: string | undefined,
    stage: Stage,
    options: { page?: number; pageSize?: number; me?: string } = {},
  ) {
    if (!stageKeys.includes(stage)) throw new AppError('مرحلة غير صالحة.');
    const c = await this.current(this.db, id);
    if (!(
      c.leaderboardMode === 'public_live' ||
      (c.leaderboardMode === 'publish_after_close' &&
        effectiveState(c, this.now()) === 'RESULTS_PUBLISHED')
    ))
      throw new AppError('قائمة الترتيب غير منشورة.', 403);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize ?? 50) || 50));
    const page = Math.max(1, Math.trunc(options.page ?? 1) || 1);
    // Ranking is done in SQL so a large stage is never loaded whole: equal percentages share a rank.
    const ranked =
      'SELECT participant_number,score,max_score,percentage,RANK() OVER (ORDER BY percentage DESC) AS rank FROM attempts WHERE competition_id=$1 AND stage=$2 AND submitted_at IS NOT NULL';
    type Row = {
      participant_number: string;
      score: number;
      max_score: number;
      percentage: number;
      rank: string | number;
    };
    const toEntry = (r: Row) => ({
      participantNumber: r.participant_number,
      score: Number(r.score),
      maxScore: Number(r.max_score),
      percentage: Number(r.percentage),
      rank: Number(r.rank),
    });
    const rows = (
      await this.db.query<Row>(
        `SELECT * FROM (${ranked}) t ORDER BY rank,participant_number LIMIT $3 OFFSET $4`,
        [c.id, stage, pageSize, (page - 1) * pageSize],
      )
    ).rows;
    const total = Number(
      (
        await this.db.query<{ n: string }>(
          'SELECT count(*) AS n FROM attempts WHERE competition_id=$1 AND stage=$2 AND submitted_at IS NOT NULL',
          [c.id, stage],
        )
      ).rows[0].n,
    );
    const mine = options.me
      ? (
          await this.db.query<Row>(`SELECT * FROM (${ranked}) t WHERE participant_number=$3`, [
            c.id,
            stage,
            options.me,
          ])
        ).rows[0]
      : undefined;
    return {
      stage,
      entries: rows.map(toEntry),
      total,
      page,
      pageSize,
      mine: mine ? toEntry(mine) : null,
    };
  }
  // The student's own position right after submission, within the stage and within their city.
  // Only their rank and the totals are disclosed, never another participant's entry.
  async standing(s: Session, competitionId?: string): Promise<Standing | null> {
    requireRole(s, ['participant']);
    const c = await this.current(this.db, competitionId);
    if (c.leaderboardMode === 'hidden') return null;
    const own = (
      await this.db.query<{ stage: Stage; percentage: number; locality: string }>(
        'SELECT a.stage,a.percentage,p.locality FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.participant_id=$1 AND a.competition_id=$2 AND a.submitted_at IS NOT NULL',
        [s.participant_id, c.id],
      )
    ).rows[0];
    if (!own) throw new AppError('لم تُرسل المشاركة بعد.', 409);
    const position = async (city: boolean) => {
      const row = (
        await this.db.query<{ above: string; total: string }>(
          `SELECT count(*) FILTER (WHERE a.percentage > $3) AS above,count(*) AS total FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.competition_id=$1 AND a.stage=$2 AND a.submitted_at IS NOT NULL${city ? ' AND p.locality=$4' : ''}`,
          city
            ? [c.id, own.stage, own.percentage, own.locality]
            : [c.id, own.stage, own.percentage],
        )
      ).rows[0];
      return { rank: Number(row.above) + 1, total: Number(row.total) };
    };
    return {
      stage: own.stage,
      overall: await position(false),
      city: { name: own.locality, ...(await position(true)) },
    };
  }
  // Rehearsal standing ranks the administrator's own submitted runs, with a chosen test city.
  async testStanding(s: Session, id: string): Promise<Standing> {
    await this.testState(s, id);
    const own = (
      await this.db.query<{
        competition_id: string;
        stage: Stage;
        percentage: number;
        city: string | null;
        submitted_at: string | null;
      }>(
        "SELECT competition_id,stage,percentage,config->>'testCity' AS city,submitted_at FROM admin_test_runs WHERE id=$1 AND actor=$2",
        [id, actor(s)],
      )
    ).rows[0];
    if (!own?.submitted_at) throw new AppError('لم تُرسل التجربة بعد.', 409);
    const city = own.city ?? '';
    const position = async (byCity: boolean) => {
      const row = (
        await this.db.query<{ above: string; total: string }>(
          `SELECT count(*) FILTER (WHERE percentage > $4) AS above,count(*) AS total FROM admin_test_runs WHERE actor=$1 AND competition_id=$2 AND stage=$3 AND submitted_at IS NOT NULL AND invalidated_at IS NULL${byCity ? " AND coalesce(config->>'testCity','')=$5" : ''}`,
          byCity
            ? [actor(s), own.competition_id, own.stage, own.percentage, city]
            : [actor(s), own.competition_id, own.stage, own.percentage],
        )
      ).rows[0];
      return { rank: Number(row.above) + 1, total: Number(row.total) };
    };
    return {
      stage: own.stage,
      overall: await position(false),
      city: { name: city || 'مدينة التجربة', ...(await position(true)) },
    };
  }
  async testState(s: Session, id: string, tx: Queryable = this.db) {
    requireRole(s, ['admin']);
    const a = (
      await tx.query<AttemptRow>(
        'SELECT * FROM admin_test_runs WHERE id=$1 AND actor=$2 AND invalidated_at IS NULL',
        [id, actor(s)],
      )
    ).rows[0];
    if (!a) throw new AppError('التجربة غير موجودة.', 404);
    if (!isLocalMode() && a.questions.some((q) => q.fixture))
      throw new AppError(
        'هذه تجربة سابقة بأسئلة اصطناعية. ابدأ تجربة جديدة لاستخدام أسئلة بنك المسابقة.',
        409,
        'TEST_BANK_REPLACED',
      );
    a.reading = await this.readingProgress(tx, a.id, true);
    return this.project(
      a.config!,
      await this.book(a.config!, tx),
      a,
      'تجربة الإدارة',
      a.stage,
      true,
    );
  }
  async startTest(s: Session, body: Record<string, unknown>, tx: Queryable = this.db) {
    requireRole(s, ['admin']);
    const stage = body.stage as Stage;
    if (!stageKeys.includes(stage)) throw new AppError('مرحلة غير صالحة.');
    const c = await this.current(tx);
    let questions = (
      await tx.query<{ questions: CompetitionQuestion[] }>(
        'SELECT questions FROM competition_question_sets WHERE competition_id=$1 AND stage=$2',
        [c.id, stage],
      )
    ).rows[0]?.questions;
    if (!questions)
      questions = (
        await tx.query<{ body: CompetitionQuestion }>(
          "SELECT body FROM questions WHERE body->>'stage'=$1 AND body->>'active'='true' AND body->>'bookVersionId'=$2 ORDER BY id",
          [stage, c.bookVersionId],
        )
      ).rows.map((q) => q.body);
    // Synthetic content exists only inside owned test snapshots, never in the
    // question bank, participant attempts, or a frozen production competition.
    const count = questionCount(c, stage);
    if (questions.length !== count && body.synthetic === true && isLocalMode()) {
      const { fixturesForCampaign } = await import('./competition-fixtures');
      questions = fixturesForCampaign(c)
        .filter((q) => q.stage === stage)
        .map((q) => ({ ...q, bookVersionId: c.bookVersionId, approved: false }));
    }
    if (questions.length !== count)
      throw new AppError(
        `أضف ${count} سؤالًا للمرحلة قبل التجربة. يمكن تجربة المسودات دون اعتمادها.`,
        409,
      );
    if (!isLocalMode() && questions.some((q) => q.fixture))
      throw new AppError(
        'التجربة تتطلب أسئلة بنك المسابقة. استورد أسئلة المرحلة ثم ابدأ تجربة جديدة.',
        409,
      );
    const book = await this.book(c, tx);
    await this.verifyBook(book);
    questions.forEach((q) => validateQuestion(q, book));
    const cities = Object.values(resolveEligibility(c).cities).flat();
    const config = {
      ...c,
      questionOrder: questionOrders.includes(body.order as QuestionOrder)
        ? (body.order as QuestionOrder)
        : (c.questionOrder ?? 'random'),
      // Rehearsal-only city, so the result screen can show a city standing like a participant's.
      testCity: typeof body.city === 'string' && cities.includes(body.city) ? body.city : cities[0],
      state: body.closed === true ? ('CLOSED' as const) : ('OPEN' as const),
      closesAt: null,
      closedAt: body.closed === true ? new Date(this.now()).toISOString() : null,
      closingPolicy: 'immediate' as const,
      feedbackMode: 'educational' as const,
      leaderboardMode: 'public_live' as const,
    };
    const id = randomUUID();
    await tx.query(
      'INSERT INTO admin_test_runs(id,actor,competition_id,stage,config,questions,participant_number) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        actor(s),
        c.id,
        stage,
        JSON.stringify(config),
        JSON.stringify(snapshotQuestions(questions, config.questionOrder)),
        `TEST-${randomInt(100000, 999999)}`,
      ],
    );
    return this.testState(s, id, tx);
  }
  async resetTest(s: Session, id: string) {
    requireRole(s, ['admin']);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM admin_test_runs WHERE id=$1 AND actor=$2 FOR UPDATE', [
        id,
        actor(s),
      ]);
      const old = await this.testState(s, id, tx);
      // New namespace prevents queued events from the old run being applied to its replacement.
      const next = await this.startTest(
        s,
        {
          stage: old.participant.stage,
          reveal: old.competition.feedbackMode === 'educational',
          closed: old.competition.state === 'CLOSED',
          synthetic: old.testQuestionSource === 'synthetic',
          city: (old.competition as Competition & { testCity?: string }).testCity,
          order: old.competition.questionOrder,
        },
        tx,
      );
      await tx.query('UPDATE admin_test_runs SET invalidated_at=$1 WHERE id=$2 AND actor=$3', [
        new Date(this.now()),
        id,
        actor(s),
      ]);
      return next;
    });
  }
  async testLeaderboard(s: Session, id: string) {
    const state = await this.testState(s, id);
    const rows = (
      await this.db.query<{ participant_number: string; score: number; percentage: number }>(
        'SELECT participant_number,score,percentage FROM admin_test_runs WHERE actor=$1 AND competition_id=$2 AND stage=$3 AND submitted_at IS NOT NULL AND invalidated_at IS NULL',
        [actor(s), state.competition.id, state.participant.stage],
      )
    ).rows;
    return {
      entries: rankResults(
        rows.map((r) => ({
          participantNumber: r.participant_number,
          score: r.score,
          percentage: r.percentage,
          maxScore: questionCount(state.competition, registeredStage(state.participant.stage)),
        })),
      ),
    };
  }
  async admin(s: Session) {
    requireRole(s, ['admin', 'editor']);
    const c = await this.current();
    return {
      published: effectiveState(c, this.now()) === 'RESULTS_PUBLISHED',
      competition: { ...c, state: effectiveState(c, this.now()) },
      book: await this.book(c),
      books: await new BookStore(this.db).list(),
      competitions: (
        await this.db.query<{ body: Competition }>(
          'SELECT body FROM competitions ORDER BY created_at',
        )
      ).rows.map((r) => r.body),
      history: (
        await this.db.query(
          'SELECT question_id,version,body,created_at FROM question_versions ORDER BY question_id,version DESC',
        )
      ).rows,
    };
  }
  async configure(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    await this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM settings WHERE id='current_competition' FOR UPDATE");
      let c = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c.id]);
      c = await this.current(tx);
      if (
        body.action === 'open' ||
        body.action === 'create' ||
        (body.action === 'settings' && body.scheduled)
      ) {
        const active = (
          await tx.query(
            'SELECT id FROM simulation_runs WHERE competition_id=$1 AND finish_until>$2 LIMIT 1',
            [c.id, new Date(this.now())],
          )
        ).rows.length;
        if (active)
          throw new AppError(
            'انتظر انتهاء مهلة التجربة العامة قبل إطلاق المسابقة أو تغيير الحملة.',
            409,
            'PRACTICE_ACTIVE',
          );
      }
      const before = structuredClone(c);
      if (effectiveState(c, this.now()) === 'CLOSED' && c.state !== 'CLOSED') {
        c.state = 'CLOSED';
        c.closedAt = c.closesAt;
      }
      if (body.action === 'create') {
        if (['OPEN', 'SCHEDULED'].includes(effectiveState(c, this.now())))
          throw new AppError('أغلق المسابقة الحالية قبل إنشاء حملة جديدة.', 409);
        const next = {
          ...newCompetition(randomUUID(), c.bookVersionId),
          ...(isLocalMode() && c.fixture ? { fixture: true } : {}),
          // A new campaign starts with the previous campaign's regions; the admin can change them.
          ...(c.eligibility ? { eligibility: c.eligibility } : {}),
        };
        next.title = String(body.title || 'مسابقة جديدة').slice(0, 160);
        await tx.query('INSERT INTO competitions(id,body) VALUES($1,$2)', [
          next.id,
          JSON.stringify(next),
        ]);
        await tx.query("UPDATE settings SET value=$1 WHERE id='current_competition'", [
          JSON.stringify(next.id),
        ]);
        await audit(tx, s, 'إنشاء مسابقة', next);
        return;
      }
      if (body.version !== c.version) throw new AppError('إعدادات أحدث. حدّث الصفحة.', 409);
      if (body.action === 'adopt-meeting-rules') {
        if (
          effectiveState(c, this.now()) !== 'DRAFT' ||
          (await tx.query('SELECT id FROM attempts WHERE competition_id=$1 LIMIT 1', [c.id])).rows
            .length
        )
          throw new AppError('يمكن تطبيق قواعد الاجتماع على مسابقة مسودة بلا محاولات فقط.', 409);
        c.questionCounts = { ...meetingQuestionCounts };
        c.answerMode = 'final_submission';
        c.frozenAt = null;
        await tx.query('DELETE FROM competition_question_sets WHERE competition_id=$1', [c.id]);
      } else if (body.action === 'freeze') {
        if (!['DRAFT', 'SCHEDULED'].includes(effectiveState(c, this.now())))
          throw new AppError('لا يمكن تغيير نسخة مسابقة بدأت.', 409);
        const book = await this.book(c, tx);
        await this.verifyBook(book);
        const bank = (
          await tx.query<{ body: CompetitionQuestion }>(
            "SELECT body FROM questions WHERE body->>'active'='true' AND body->>'bookVersionId'=$1 ORDER BY id",
            [book.id],
          )
        ).rows.map((r) => r.body);
        validateBank(bank, book, isLocalMode() && c.fixture === true, c);
        for (const stage of stageKeys)
          await tx.query(
            'INSERT INTO competition_question_sets VALUES($1,$2,$3) ON CONFLICT(competition_id,stage) DO UPDATE SET questions=excluded.questions',
            [c.id, stage, JSON.stringify(bank.filter((q) => q.stage === stage))],
          );
        c.frozenAt = new Date(this.now()).toISOString();
      } else if (body.action === 'set-book') {
        if (effectiveState(c, this.now()) !== 'DRAFT' || c.frozenAt)
          throw new AppError('لا يمكن تغيير الكتاب بعد اعتماد نسخة الأسئلة.', 409);
        const next = (
          await tx.query<{ body: BookVersion }>('SELECT body FROM book_versions WHERE id=$1', [
            typeof body.bookVersionId === 'string' ? body.bookVersionId : '',
          ])
        ).rows[0]?.body;
        if (!next) throw new AppError('نسخة الكتاب غير موجودة.', 404);
        c.bookVersionId = next.id;
      } else if (body.action === 'approve-book') {
        const b = await this.book(c, tx);
        await this.verifyBook(b);
        await tx.query('UPDATE book_versions SET body=$1 WHERE id=$2', [
          JSON.stringify({ ...b, approved: true }),
          b.id,
        ]);
      } else if (body.action === 'open') {
        if (!['DRAFT', 'SCHEDULED'].includes(effectiveState(c, this.now())) || !c.frozenAt)
          throw new AppError('اعتمد نسخة مسابقة جديدة قبل فتحها.', 409);
        await this.verifyBook(await this.book(c, tx));
        c.state = 'OPEN';
        c.opensAt = new Date(this.now()).toISOString();
        c.closedAt = null;
        if (c.closesAt && Date.parse(c.closesAt) <= this.now())
          throw new AppError('وقت الإغلاق مضى.');
      } else if (body.action === 'close') {
        c.state = 'CLOSED';
        c.closedAt = new Date(this.now()).toISOString();
      } else if (body.action === 'publish') {
        if (effectiveState(c, this.now()) !== 'CLOSED')
          throw new AppError('أغلق المسابقة قبل نشر النتائج.', 409);
        const close = c.closedAt ?? c.closesAt;
        if (
          c.closingPolicy === 'grace' &&
          close &&
          this.now() < Date.parse(close) + c.graceMinutes * 60000
        )
          throw new AppError('انتظر انتهاء مهلة المزامنة قبل النشر.', 409);
        if (
          (
            await tx.query(
              'SELECT id FROM attempts WHERE competition_id=$1 AND recovery_until > $2',
              [c.id, new Date(this.now())],
            )
          ).rows.length
        )
          throw new AppError('انتظر انتهاء مهلة المعالجة التقنية.', 409);
        c.state = 'RESULTS_PUBLISHED';
      } else if (body.action === 'unpublish') {
        if (c.state !== 'RESULTS_PUBLISHED') throw new AppError('النتائج غير منشورة.', 409);
        c.state = 'CLOSED';
      } else if (body.action === 'settings') {
        if (
          !['formal', 'educational'].includes(String(body.feedbackMode)) ||
          !['hidden', 'own_result_only', 'publish_after_close', 'public_live'].includes(
            String(body.leaderboardMode),
          ) ||
          !['immediate', 'grace'].includes(String(body.closingPolicy)) ||
          !Number.isInteger(body.graceMinutes) ||
          Number(body.graceMinutes) < 0 ||
          Number(body.graceMinutes) > 10080
        )
          throw new AppError('إعدادات غير صالحة.');
        const opensAt = body.opensAt ? String(body.opensAt) : null;
        const closesAt = body.closesAt ? String(body.closesAt) : null;
        if (
          (opensAt && !Number.isFinite(Date.parse(opensAt))) ||
          (closesAt && !Number.isFinite(Date.parse(closesAt))) ||
          (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt))
        )
          throw new AppError('مواعيد غير صالحة.');
        if (c.state === 'RESULTS_PUBLISHED')
          throw new AppError('اسحب النشر قبل تغيير السياسة.', 409);
        if (
          body.questionOrder !== undefined &&
          !questionOrders.includes(body.questionOrder as QuestionOrder)
        )
          throw new AppError('ترتيب الأسئلة غير صالح.');
        if (
          body.questionOrder !== undefined &&
          body.questionOrder !== (c.questionOrder ?? 'random') &&
          !['DRAFT', 'SCHEDULED'].includes(effectiveState(c, this.now()))
        )
          throw new AppError('لا يتغير ترتيب الأسئلة بعد فتح المسابقة.', 409);
        if (body.registrationPaused !== undefined && typeof body.registrationPaused !== 'boolean')
          throw new AppError('إعداد إيقاف التسجيل غير صالح.');
        if (
          body.maxPerPhone !== undefined &&
          (!Number.isInteger(body.maxPerPhone) ||
            Number(body.maxPerPhone) < 1 ||
            Number(body.maxPerPhone) > 20)
        )
          throw new AppError('الحد الأقصى للتسجيلات لكل جوال يجب أن يكون من 1 إلى 20.');
        const eligibility: Eligibility | undefined =
          body.eligibility === undefined ? c.eligibility : validateEligibility(body.eligibility);
        if (
          body.scheduled &&
          (!c.frozenAt || !opensAt || !closesAt || effectiveState(c, this.now()) !== 'DRAFT')
        )
          throw new AppError('الجدولة تتطلب نسخة معتمدة ومواعيد لمسابقة مسودة.', 409);
        c = {
          ...c,
          title: String(body.title || c.title).slice(0, 160),
          feedbackMode: 'educational',
          leaderboardMode: body.leaderboardMode as Competition['leaderboardMode'],
          closingPolicy: body.closingPolicy as Competition['closingPolicy'],
          graceMinutes: Number(body.graceMinutes),
          opensAt,
          closesAt,
          state: body.scheduled ? 'SCHEDULED' : c.state,
          ...(eligibility ? { eligibility } : {}),
          ...(body.registrationPaused !== undefined
            ? { registrationPaused: body.registrationPaused as boolean }
            : {}),
          ...(body.maxPerPhone !== undefined ? { maxPerPhone: Number(body.maxPerPhone) } : {}),
          ...(body.questionOrder !== undefined
            ? { questionOrder: body.questionOrder as QuestionOrder }
            : {}),
        };
      } else throw new AppError('إجراء غير صالح.');
      c.version++;
      await tx.query('UPDATE competitions SET body=$1 WHERE id=$2', [JSON.stringify(c), c.id]);
      await audit(tx, s, `إدارة المسابقة: ${body.action}`, { before, after: c });
    });
    return this.admin(s);
  }
  async verifyBook(b: BookVersion) {
    if (!/^\/books\/[a-f0-9]{64}\.pdf$/.test(b.url))
      throw new AppError('مسار نسخة الكتاب غير صالح.', 409);
    // Uploaded books live in the database; the bundled book is a checksum-named public file.
    const bytes = b.parts
      ? await new BookStore(this.db).whole(b.sha256)
      : await readFile(path.join(process.cwd(), 'public', b.url)).catch(() => null);
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== b.sha256)
      throw new AppError('ملف نسخة الكتاب مفقود أو تغير. شغّل تجهيز الأصول.', 409);
  }
  async approveQuestions(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    if (
      body.reviewed !== true ||
      !Array.isArray(body.questions) ||
      !body.questions.length ||
      body.questions.length > 75
    )
      throw new AppError('راجع نصوص الأسئلة وإجاباتها ومصادرها، ثم أكد المراجعة قبل الاعتماد.');
    const requests = body.questions as { id: string; version: number }[];
    if (
      requests.some((q) => !q || typeof q.id !== 'string' || !Number.isInteger(q.version)) ||
      new Set(requests.map((q) => q.id)).size !== requests.length
    )
      throw new AppError('قائمة الاعتماد غير صالحة.');
    await this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM settings WHERE id='current_competition' FOR UPDATE");
      const c = await this.current(tx);
      const book = await this.book(c, tx);
      await this.verifyBook(book);
      const prepared: CompetitionQuestion[] = [];
      for (const request of requests) {
        const old = (
          await tx.query<{ body: CompetitionQuestion }>(
            'SELECT body FROM questions WHERE id=$1 FOR UPDATE',
            [request.id],
          )
        ).rows[0]?.body;
        if (!old || old.bookVersionId !== book.id || !old.active)
          throw new AppError(`${request.id}: السؤال غير متاح للاعتماد.`, 409);
        if (old.version !== request.version)
          throw new AppError(
            `${request.id}: يوجد إصدار أحدث. حدّث بنك الأسئلة وراجع الإصدار الحالي.`,
            409,
          );
        const next = {
          ...old,
          sourceVerified: true,
          approved: true,
          version: old.sourceVerified === true ? old.version : old.version + 1,
        };
        validateQuestion(next, book, true);
        if (next.fixture && !isLocalMode())
          throw new AppError('الأسئلة الاصطناعية غير قابلة للاعتماد.');
        prepared.push(next);
      }
      for (const q of prepared) {
        await tx.query('UPDATE questions SET body=$1 WHERE id=$2', [JSON.stringify(q), q.id]);
        await tx.query(
          'INSERT INTO question_versions(question_id,version,body,actor) VALUES($1,$2,$3,$4) ON CONFLICT(question_id,version) DO UPDATE SET body=excluded.body,actor=excluded.actor',
          [q.id, q.version, JSON.stringify(q), actor(s)],
        );
      }
      await audit(tx, s, 'مراجعة مصادر واعتماد مجموعة أسئلة', {
        competitionId: c.id,
        questions: prepared.map((q) => ({ id: q.id, version: q.version })),
        reviewed: true,
      });
    });
  }
  async saveQuestion(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin', 'editor']);
    await this.db.transaction(async (tx) => {
      // Serialize bank changes with approval/import and prevent lost versions on first insert.
      await tx.query("SELECT id FROM settings WHERE id='current_competition' FOR UPDATE");
      const c = await this.current(tx);
      const book = await this.book(c, tx);
      const old = (
        await tx.query<{ body: CompetitionQuestion }>(
          'SELECT body FROM questions WHERE id=$1 FOR UPDATE',
          [body.id],
        )
      ).rows[0]?.body;
      if (old && old.version !== body.version) throw new AppError('نسخة أحدث من السؤال.', 409);
      if (old && body.active === false && s.role !== 'admin')
        throw new AppError('تعطيل السؤال متاح للمشرف فقط.', 403);
      let next: CompetitionQuestion;
      if (body.approve === true) {
        requireRole(s, ['admin']);
        if (!old) throw new AppError('السؤال غير موجود.', 404);
        next = { ...old, approved: true };
      } else {
        next = {
          id: String(body.id),
          title: String(body.title ?? '').trim(),
          options: Array.isArray(body.options) ? (body.options as string[]) : [],
          correct: Number(
            body.correctAnswers && Array.isArray(body.correctAnswers)
              ? body.correctAnswers[0]
              : body.correct,
          ),
          correctAnswers: Array.isArray(body.correctAnswers)
            ? (body.correctAnswers as number[])
            : [Number(body.correct)],
          source: String(body.source ?? ''),
          stage: body.stage as Stage,
          type: body.type as CompetitionQuestion['type'],
          pdfPage: body.pdfPage === null ? null : Number(body.pdfPage),
          ...(body.pdfPageEnd !== undefined ? { pdfPageEnd: Number(body.pdfPageEnd) } : {}),
          printedPage: body.printedPage === null ? null : Number(body.printedPage),
          hintPdfPageStart: body.hintPdfPageStart === null ? null : Number(body.hintPdfPageStart),
          hintPdfPageEnd: body.hintPdfPageEnd === null ? null : Number(body.hintPdfPageEnd),
          ...(body.printedPageEnd !== undefined
            ? { printedPageEnd: Number(body.printedPageEnd) }
            : {}),
          ...(body.sourceKind !== undefined
            ? { sourceKind: body.sourceKind as CompetitionQuestion['sourceKind'] }
            : {}),
          ...(body.sourceUrl !== undefined ? { sourceUrl: String(body.sourceUrl) } : {}),
          ...(body.sourceRow !== undefined ? { sourceRow: String(body.sourceRow) } : {}),
          ...(body.sourceVerified !== undefined
            ? { sourceVerified: body.sourceVerified as boolean }
            : {}),
          ...(body.preserveOptionOrder !== undefined
            ? { preserveOptionOrder: body.preserveOptionOrder as boolean }
            : {}),
          answerExplanation: String(body.answerExplanation ?? ''),
          topic: String(body.topic ?? ''),
          difficulty: body.difficulty as CompetitionQuestion['difficulty'],
          bookVersionId: book.id,
          sourceExcerpt: String(body.sourceExcerpt ?? ''),
          active: body.active !== false,
          fixture: old?.fixture === true,
          version: (old?.version ?? 0) + 1,
          approved: false,
        };
      }
      validateQuestion(next, book, next.approved);
      if (next.approved && next.fixture && !isLocalMode())
        throw new AppError('لا يمكن اعتماد سؤال تجريبي في الإنتاج.', 409);
      await tx.query(
        'INSERT INTO questions VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
        [next.id, JSON.stringify(next)],
      );
      await tx.query(
        'INSERT INTO question_versions(question_id,version,body,actor) VALUES($1,$2,$3,$4) ON CONFLICT(question_id,version) DO UPDATE SET body=excluded.body,actor=excluded.actor',
        [next.id, next.version, JSON.stringify(next), actor(s)],
      );
      await audit(tx, s, next.approved ? 'اعتماد سؤال' : 'إصدار سؤال', {
        questionId: next.id,
        version: next.version,
        approved: next.approved,
      });
    });
  }
  async recover(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    const reason = String(body.reason ?? '').trim();
    const minutes = Number(body.minutes);
    if (
      reason.length < 15 ||
      reason.length > 1000 ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 1440
    )
      throw new AppError('يلزم سبب موثق ومهلة من 1 إلى 1440 دقيقة.');
    await this.db.transaction(async (tx) => {
      const initial = (
        await tx.query<AttemptRow>('SELECT * FROM attempts WHERE id=$1', [body.attemptId])
      ).rows[0];
      if (!initial) throw new AppError('المشاركة غير موجودة.', 404);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [
        initial.competition_id,
      ]);
      const a = (
        await tx.query<AttemptRow>('SELECT * FROM attempts WHERE id=$1 FOR UPDATE', [
          body.attemptId,
        ])
      ).rows[0];
      if (!a || a.submitted_at)
        throw new AppError(
          'المعالجة متاحة للمشاركة غير المكتملة فقط. الإجابات المثبتة تبقى محفوظة.',
          409,
        );
      const c = await this.current(tx, a.competition_id);
      if (c.state === 'RESULTS_PUBLISHED')
        throw new AppError('اسحب النشر قبل معالجة عطل تقني.', 409);
      const until = new Date(this.now() + minutes * 60000).toISOString();
      const before = {
        revision: a.revision,
        submittedAt: a.submitted_at,
        recoveryUntil: a.recovery_until ?? null,
      };
      const after = { ...before, recoveryUntil: until };
      await tx.query('UPDATE attempts SET recovery_until=$1 WHERE id=$2', [until, a.id]);
      await tx.query(
        'INSERT INTO attempt_recoveries(attempt_id,actor,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5)',
        [a.id, actor(s), reason, JSON.stringify(before), JSON.stringify(after)],
      );
      await audit(tx, s, 'معالجة عطل تقني', { attemptId: a.id, reason, before, after });
    });
  }
  async creditInvalidQuestion(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 15 || reason.length > 1000)
      throw new AppError('يلزم سبب موثق لقرار اللجنة.');
    await this.db.transaction(async (tx) => {
      let c = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c.id]);
      c = await this.current(tx, c.id);
      if (c.state === 'RESULTS_PUBLISHED') throw new AppError('اسحب النشر قبل تصحيح النتائج.', 409);
      if (await this.isPublished(tx, c.id))
        throw new AppError('اسحب نشر الفائزين قبل تصحيح النتائج.', 409);
      const sets = (
        await tx.query<{ questions: CompetitionQuestion[] }>(
          'SELECT questions FROM competition_question_sets WHERE competition_id=$1',
          [c.id],
        )
      ).rows.flatMap((r) => r.questions);
      if (!sets.some((q) => q.id === body.questionId))
        throw new AppError('السؤال غير موجود في النسخة المعتمدة.', 404);
      if (
        (
          await tx.query(
            'SELECT question_id FROM competition_corrections WHERE competition_id=$1 AND question_id=$2',
            [c.id, body.questionId],
          )
        ).rows.length
      )
        throw new AppError('السؤال حصل على التعويض بالفعل.', 409);
      await tx.query(
        "INSERT INTO competition_corrections VALUES($1,$2,'award_credit',$3,$4,now())",
        [c.id, body.questionId, reason, actor(s)],
      );
      const credited = (
        await tx.query<{ question_id: string }>(
          'SELECT question_id FROM competition_corrections WHERE competition_id=$1',
          [c.id],
        )
      ).rows.map((r) => r.question_id);
      const rows = (
        await tx.query<AttemptRow & { participant_id: string }>(
          'SELECT * FROM attempts WHERE competition_id=$1 ORDER BY id FOR UPDATE',
          [c.id],
        )
      ).rows;
      const changes = [];
      for (const row of rows.filter((a) => a.submitted_at)) {
        const a = (await this.readAttempt(tx, row.participant_id, c))!;
        const result = applyEvent(
          a.questions,
          a.answers,
          a.revision,
          {
            kind: 'SUBMIT',
            attemptId: a.id,
            revision: a.revision,
            clientEventId: 'committee-credit',
          },
          new Date(this.now()).toISOString(),
          credited,
        );
        await tx.query('UPDATE attempts SET score=$1,percentage=$2 WHERE id=$3', [
          result.score,
          result.percentage,
          a.id,
        ]);
        changes.push({
          attemptId: a.id,
          before: { score: a.score, percentage: a.percentage },
          after: { score: result.score, percentage: result.percentage },
        });
      }
      await audit(tx, s, 'تعويض سؤال غير صالح', {
        competitionId: c.id,
        questionId: body.questionId,
        policy: 'award_credit',
        reason,
        changes,
      });
    });
  }
  // ---- Winners: committee decisions, then an explicit public announcement ----
  private async prizeSettings(tx: Queryable): Promise<PrizeSettings> {
    const row = (
      await tx.query<{ value: PrizeSettings }>("SELECT value FROM settings WHERE id='prizes'")
    ).rows[0];
    return row?.value ?? defaultPrizes;
  }
  // Winners are chosen only after scores can no longer change, like result publication.
  // The prize draw applies the same rule.
  async assertFinal(tx: Queryable, c: Competition) {
    const state = effectiveState(c, this.now());
    if (state !== 'CLOSED' && state !== 'RESULTS_PUBLISHED')
      throw new AppError('أغلق المسابقة قبل اختيار الفائزين.', 409);
    const close = c.closedAt ?? c.closesAt;
    if (
      c.closingPolicy === 'grace' &&
      close &&
      this.now() < Date.parse(close) + c.graceMinutes * 60000
    )
      throw new AppError('انتظر انتهاء مهلة المزامنة قبل اختيار الفائزين.', 409);
    if (
      (
        await tx.query('SELECT id FROM attempts WHERE competition_id=$1 AND recovery_until > $2', [
          c.id,
          new Date(this.now()),
        ])
      ).rows.length
    )
      throw new AppError('انتظر انتهاء مهلة المعالجة التقنية.', 409);
  }
  private async isPublished(tx: Queryable, competitionId: string) {
    return !!(
      await tx.query('SELECT 1 FROM competition_winner_publications WHERE competition_id=$1', [
        competitionId,
      ])
    ).rows.length;
  }
  async winners(s: Session) {
    requireRole(s, ['admin']);
    const c = await this.current();
    const prizes = await this.prizeSettings(this.db);
    let blocker = '';
    try {
      await this.assertFinal(this.db, c);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      blocker = e.message;
    }
    const awards = (
      await this.db.query<{
        award_key: string;
        stage: Stage | null;
        place: number;
        attempt_id: string | null;
        label: string | null;
        reason: string | null;
        decided_by: string;
        decided_at: string;
      }>('SELECT * FROM competition_awards WHERE competition_id=$1 ORDER BY stage,place', [c.id])
    ).rows;
    const publication = (
      await this.db.query<{ published_at: string; published_by: string; show_names: boolean }>(
        'SELECT published_at,published_by,show_names FROM competition_winner_publications WHERE competition_id=$1',
        [c.id],
      )
    ).rows[0];
    const select =
      'SELECT a.id AS "attemptId",a.participant_number AS "participantNumber",p.name,p.institution,a.stage,a.score,a.max_score AS "maxScore",a.percentage FROM attempts a JOIN participants p ON p.id=a.participant_id';
    const stages = [];
    for (const stage of stageKeys) {
      const own = awards.filter((a) => a.stage === stage);
      const top = (
        await this.db.query<Candidate>(
          `${select} WHERE a.competition_id=$1 AND a.stage=$2 AND a.submitted_at IS NOT NULL ORDER BY a.percentage DESC,a.participant_number LIMIT 60`,
          [c.id, stage],
        )
      ).rows;
      const missing = own
        .map((a) => a.attempt_id!)
        .filter((id) => !top.some((t) => t.attemptId === id));
      if (missing.length)
        top.push(
          ...(await this.db.query<Candidate>(`${select} WHERE a.id = ANY($1::text[])`, [missing]))
            .rows,
        );
      const submitted = Number(
        (
          await this.db.query<{ n: string }>(
            'SELECT count(*) AS n FROM attempts WHERE competition_id=$1 AND stage=$2 AND submitted_at IS NOT NULL',
            [c.id, stage],
          )
        ).rows[0].n,
      );
      stages.push({
        stage,
        submitted,
        candidates: top.map((t) => ({
          ...t,
          score: Number(t.score),
          maxScore: Number(t.maxScore),
          percentage: Number(t.percentage),
        })),
        places: Array.from({ length: PLACES }, (_, i) => ({
          place: i + 1,
          attemptId: own.find((a) => a.place === i + 1)?.attempt_id ?? null,
          amount: awardAmount(prizes, stage, i + 1),
        })),
        reason: own[0]?.reason ?? '',
        decidedBy: own[0]?.decided_by ?? null,
        decidedAt: own[0]?.decided_at ?? null,
      });
    }
    const media = awards.find((a) => a.award_key === 'media');
    return {
      competition: { id: c.id, title: c.title, state: effectiveState(c, this.now()) },
      blocker,
      stages,
      media: {
        label: media?.label ?? '',
        amount: prizes.mediaPrize,
        decidedBy: media?.decided_by ?? null,
        decidedAt: media?.decided_at ?? null,
      },
      publication: publication
        ? {
            publishedAt: publication.published_at,
            publishedBy: publication.published_by,
            showNames: publication.show_names,
          }
        : null,
    };
  }
  async saveWinners(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    const stage = body.stage as Stage;
    if (!stageKeys.includes(stage)) throw new AppError('مرحلة غير صالحة.');
    if (!Array.isArray(body.places) || body.places.length !== PLACES)
      throw new AppError(`يلزم ${PLACES} مراكز.`);
    const places = body.places.map((p) => (typeof p === 'string' && p ? p : null));
    const reason = String(body.reason ?? '').trim();
    await this.db.transaction(async (tx) => {
      const c0 = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c0.id]);
      const c = await this.current(tx, c0.id);
      await this.assertFinal(tx, c);
      if (await this.isPublished(tx, c.id))
        throw new AppError('اسحب نشر الفائزين قبل تعديل القرار.', 409);
      const rows = (
        await tx.query<{ attemptId: string; percentage: number }>(
          'SELECT id AS "attemptId",percentage FROM attempts WHERE competition_id=$1 AND stage=$2 AND submitted_at IS NOT NULL',
          [c.id, stage],
        )
      ).rows.map((r) => ({ attemptId: r.attemptId, percentage: Number(r.percentage) }));
      const evaluation = evaluateStage(rows, places);
      if (evaluation.errors.length) throw new AppError(evaluation.errors[0]);
      const problem = reasonProblem(evaluation, reason);
      if (problem) throw new AppError(problem);
      const before = (
        await tx.query<{ place: number; attempt_id: string }>(
          'SELECT place,attempt_id FROM competition_awards WHERE competition_id=$1 AND stage=$2 ORDER BY place',
          [c.id, stage],
        )
      ).rows;
      await tx.query('DELETE FROM competition_awards WHERE competition_id=$1 AND stage=$2', [
        c.id,
        stage,
      ]);
      for (const [i, attemptId] of places.entries())
        if (attemptId)
          await tx.query(
            'INSERT INTO competition_awards(competition_id,award_key,stage,place,attempt_id,reason,decided_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [c.id, awardKey(stage, i + 1), stage, i + 1, attemptId, reason || null, actor(s)],
          );
      const { errors: _errors, ...flags } = evaluation;
      await audit(tx, s, 'اختيار فائزي المرحلة', {
        competitionId: c.id,
        stage,
        before,
        after: places,
        reason,
        flags,
      });
    });
    return this.winners(s);
  }
  async saveMediaWinner(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    const label = String(body.label ?? '').trim();
    if (label.length > 160) throw new AppError('اسم الفائز بجائزة الإعلام طويل جدًا.');
    await this.db.transaction(async (tx) => {
      const c0 = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c0.id]);
      const c = await this.current(tx, c0.id);
      if (await this.isPublished(tx, c.id))
        throw new AppError('اسحب نشر الفائزين قبل تعديل القرار.', 409);
      await tx.query(
        "DELETE FROM competition_awards WHERE competition_id=$1 AND award_key='media'",
        [c.id],
      );
      if (label)
        await tx.query(
          "INSERT INTO competition_awards(competition_id,award_key,stage,place,label,decided_by) VALUES($1,'media',NULL,1,$2,$3)",
          [c.id, label, actor(s)],
        );
      await audit(tx, s, 'اختيار فائز الإعلام', { competitionId: c.id, label });
    });
    return this.winners(s);
  }
  async publishWinners(s: Session, body: Record<string, unknown>) {
    requireRole(s, ['admin']);
    if (typeof body.showNames !== 'boolean') throw new AppError('حدد طريقة عرض الفائزين.');
    const showNames = body.showNames;
    await this.db.transaction(async (tx) => {
      const c0 = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c0.id]);
      const c = await this.current(tx, c0.id);
      await this.assertFinal(tx, c);
      const prizes = await this.prizeSettings(tx);
      const rows = (
        await tx.query<{
          stage: Stage;
          place: number;
          participant_number: string;
          score: number;
          max_score: number;
          name: string;
          institution: string | null;
        }>(
          'SELECT aw.stage,aw.place,a.participant_number,a.score,a.max_score,p.name,p.institution FROM competition_awards aw JOIN attempts a ON a.id=aw.attempt_id JOIN participants p ON p.id=a.participant_id WHERE aw.competition_id=$1 AND aw.stage IS NOT NULL ORDER BY aw.place',
          [c.id],
        )
      ).rows;
      const stages: WinnersAnnouncement['stages'] = [];
      for (const stage of stageKeys) {
        const own = rows.filter((r) => r.stage === stage);
        const submitted = Number(
          (
            await tx.query<{ n: string }>(
              'SELECT count(*) AS n FROM attempts WHERE competition_id=$1 AND stage=$2 AND submitted_at IS NOT NULL',
              [c.id, stage],
            )
          ).rows[0].n,
        );
        if (submitted > 0 && !own.length)
          throw new AppError(`حدد فائزي ${stageNames[stage]} قبل النشر.`, 409);
        stages.push({
          stage,
          awards: own.map((r) => ({
            place: r.place,
            amount: awardAmount(prizes, stage, r.place),
            participantNumber: r.participant_number,
            score: Number(r.score),
            maxScore: Number(r.max_score),
            ...(showNames ? { name: r.name, institution: r.institution } : {}),
          })),
        });
      }
      const media = (
        await tx.query<{ label: string }>(
          "SELECT label FROM competition_awards WHERE competition_id=$1 AND award_key='media'",
          [c.id],
        )
      ).rows[0];
      const snapshot: WinnersAnnouncement = {
        competitionId: c.id,
        title: c.title,
        publishedAt: new Date(this.now()).toISOString(),
        showNames,
        stages,
        media: media ? { label: media.label, amount: prizes.mediaPrize } : null,
      };
      await tx.query(
        'INSERT INTO competition_winner_publications(competition_id,published_at,published_by,show_names,snapshot) VALUES($1,$2,$3,$4,$5) ON CONFLICT(competition_id) DO UPDATE SET published_at=excluded.published_at,published_by=excluded.published_by,show_names=excluded.show_names,snapshot=excluded.snapshot',
        [c.id, snapshot.publishedAt, actor(s), showNames, JSON.stringify(snapshot)],
      );
      await audit(tx, s, 'نشر إعلان الفائزين', { competitionId: c.id, showNames });
    });
    return this.winners(s);
  }
  async withdrawWinners(s: Session) {
    requireRole(s, ['admin']);
    await this.db.transaction(async (tx) => {
      const c = await this.current(tx);
      await tx.query('SELECT id FROM competitions WHERE id=$1 FOR UPDATE', [c.id]);
      const removed = await tx.query(
        'DELETE FROM competition_winner_publications WHERE competition_id=$1 RETURNING competition_id',
        [c.id],
      );
      if (!removed.rows.length) throw new AppError('إعلان الفائزين غير منشور.', 409);
      await audit(tx, s, 'سحب إعلان الفائزين', { competitionId: c.id });
    });
    return this.winners(s);
  }
  // Public: only the frozen snapshot the committee published, never live awards.
  async publicWinners(id?: string): Promise<WinnersAnnouncement | null> {
    const c = await this.current(this.db, id);
    return (
      (
        await this.db.query<{ snapshot: WinnersAnnouncement }>(
          'SELECT snapshot FROM competition_winner_publications WHERE competition_id=$1',
          [c.id],
        )
      ).rows[0]?.snapshot ?? null
    );
  }
}

export async function initializeCompetition(db: Database) {
  const fixtures =
    isLocalMode() && db.kind === 'pglite'
      ? (await import('./competition-fixtures')).fixturesForCampaign(newCompetition('local'))
      : null;
  await db.transaction(async (tx) => {
    await tx.query('INSERT INTO book_versions(id,body) VALUES($1,$2) ON CONFLICT DO NOTHING', [
      officialBook.id,
      JSON.stringify(officialBook),
    ]);
    const c = newCompetition('nbc-1448-2026');
    await tx.query('INSERT INTO competitions(id,body) VALUES($1,$2) ON CONFLICT DO NOTHING', [
      c.id,
      JSON.stringify(c),
    ]);
    await tx.query(
      "INSERT INTO settings(id,value) VALUES('current_competition',$1) ON CONFLICT DO NOTHING",
      [JSON.stringify(c.id)],
    );
    if (
      fixtures &&
      !(await tx.query("SELECT id FROM settings WHERE id='competition_fixtures_initialized'")).rows
        .length
    ) {
      for (const q of fixtures) {
        await tx.query('INSERT INTO questions VALUES($1,$2) ON CONFLICT DO NOTHING', [
          q.id,
          JSON.stringify(q),
        ]);
        await tx.query(
          "INSERT INTO question_versions(question_id,version,body,actor) VALUES($1,1,$2,'local-fixture') ON CONFLICT DO NOTHING",
          [q.id, JSON.stringify(q)],
        );
      }
      await tx.query('UPDATE competitions SET body=$1 WHERE id=$2', [
        JSON.stringify({ ...c, fixture: true }),
        c.id,
      ]);
      await tx.query('UPDATE book_versions SET body=$1 WHERE id=$2', [
        JSON.stringify({ ...officialBook, approved: true }),
        officialBook.id,
      ]);
      await tx.query("INSERT INTO settings VALUES('competition_fixtures_initialized','true')");
    }
  });
}
