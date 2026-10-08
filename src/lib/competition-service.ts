import { randomInt, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database, Queryable } from './database';
import { AppError } from './domain';
import type { Session } from './service';
import { isLocalMode } from './runtime';
import {
  applyEvent,
  assertWindow,
  effectiveState,
  feedbackFor,
  rankResults,
  registeredStage,
  safeQuestions,
  sanitizeReading,
  stageKeys,
  validateBank,
  validateQuestion,
  type AnswerMap,
  type BookVersion,
  type Competition,
  type CompetitionQuestion,
  type CompetitionState,
  type Stage,
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
  recovery_until?: string | null;
  config?: Competition;
};
function shuffled<T>(items: T[]): T[] {
  const next = structuredClone(items);
  for (let i = next.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
export function snapshotQuestions(questions: CompetitionQuestion[]) {
  return shuffled(questions).map((q) => {
    const order = shuffled(q.options.map((_, i) => i));
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
  async book(c: Competition, tx: Queryable = this.db) {
    const book = (
      await tx.query<{ body: BookVersion }>('SELECT body FROM book_versions WHERE id=$1', [
        c.bookVersionId,
      ])
    ).rows[0]?.body;
    if (!book) throw new AppError('نسخة الكتاب غير موجودة.', 409);
    return book;
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
      competition: { ...c, feedbackMode: 'educational', state: effectiveState(c, this.now()) },
      book,
      published: effectiveState(c, this.now()) === 'RESULTS_PUBLISHED',
      testRun,
      attempt: a
        ? {
            id: a.id,
            questions: safeQuestions(a.questions),
            answers: a.answers,
            feedback: feedbackFor(c, a.questions, a.answers),
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
  async state(s: Session, id?: string, within?: Queryable) {
    requireRole(s, ['participant']);
    const read = async (tx: Queryable) => {
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
    };
    // A caller that already holds a transaction reads inside it, so one request needs one commit.
    return within ? read(within) : this.db.transaction(read);
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
      if (!bank || bank.length !== 20) throw new AppError('بنك المرحلة غير مكتمل.', 409);
      const questions = snapshotQuestions(bank);
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
        'INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score) VALUES($1,$2,$3,$4,$5,$6,20)',
        [id, s.participant_id, c.id, stage, number, JSON.stringify(questions)],
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
  async write(s: Session, e: WriteEvent, test = false) {
    requireRole(s, test ? ['admin'] : ['participant']);
    if (
      !e ||
      typeof e.clientEventId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(e.clientEventId) ||
      typeof e.attemptId !== 'string' ||
      !Number.isInteger(e.revision)
    )
      throw new AppError('حدث المزامنة غير صالح.');
    const reading = e.kind === 'CHECK' ? sanitizeReading(e.reading) : undefined;
    const payload = JSON.stringify({
      kind: e.kind,
      questionId: e.questionId,
      selected: e.selected,
      ...(reading ? { reading } : {}),
    });
    let competitionId = '';
    let fresh: CompetitionState | undefined;
    await this.db.transaction(async (tx) => {
      let a: AttemptRow;
      let c: Competition;
      if (test) {
        const run = (
          await tx.query<AttemptRow>(
            'SELECT * FROM admin_test_runs WHERE id=$1 AND actor=$2 FOR UPDATE',
            [e.attemptId, actor(s)],
          )
        ).rows[0];
        if (!run) throw new AppError('التجربة غير موجودة.', 404);
        if ((run as AttemptRow & { invalidated_at?: string }).invalidated_at)
          throw new AppError('أُعيدت هذه التجربة. افتح الجلسة الجديدة.', 409, 'TEST_RESET');
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
      const eventTable = test ? 'admin_test_events' : 'attempt_events';
      const ownerColumn = test ? 'run_id' : 'attempt_id';
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
      assertWindow(c, true, this.now(), a.recovery_until);
      const result = applyEvent(
        a.questions,
        a.answers,
        a.revision,
        e,
        new Date(this.now()).toISOString(),
        (
          await tx.query<{ question_id: string }>(
            'SELECT question_id FROM competition_corrections WHERE competition_id=$1 AND $2=false',
            [c.id, test],
          )
        ).rows.map((r) => r.question_id),
      );
      if (test) {
        await tx.query(
          'UPDATE admin_test_runs SET answers=$1,revision=revision+1,submitted_at=$2,score=$3,percentage=$4 WHERE id=$5',
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
      fresh = test ? await this.testState(s, e.attemptId, tx) : await this.state(s, c.id, tx);
    });
    return fresh ?? (test ? this.testState(s, e.attemptId) : this.state(s, competitionId));
  }
  async leaderboard(id: string | undefined, stage: Stage) {
    if (!stageKeys.includes(stage)) throw new AppError('مرحلة غير صالحة.');
    const c = await this.current(this.db, id);
    if (!(
      c.leaderboardMode === 'public_live' ||
      (c.leaderboardMode === 'publish_after_close' &&
        effectiveState(c, this.now()) === 'RESULTS_PUBLISHED')
    ))
      throw new AppError('قائمة الترتيب غير منشورة.', 403);
    const rows = (
      await this.db.query<{
        participant_number: string;
        score: number;
        max_score: number;
        percentage: number;
      }>(
        'SELECT participant_number,score,max_score,percentage FROM attempts WHERE competition_id=$1 AND stage=$2 AND submitted_at IS NOT NULL',
        [c.id, stage],
      )
    ).rows;
    return {
      stage,
      entries: rankResults(
        rows.map((r) => ({
          participantNumber: r.participant_number,
          score: r.score,
          maxScore: r.max_score,
          percentage: r.percentage,
        })),
      ),
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
          "SELECT body FROM questions WHERE body->>'stage'=$1 AND body->>'active'='true' ORDER BY id",
          [stage],
        )
      ).rows.map((q) => q.body);
    // Synthetic content exists only inside owned test snapshots, never in the
    // question bank, participant attempts, or a frozen production competition.
    if (questions.length !== 20 && body.synthetic === true) {
      const { competitionFixtures } = await import('./competition-fixtures');
      questions = competitionFixtures
        .filter((q) => q.stage === stage)
        .map((q) => ({ ...q, bookVersionId: c.bookVersionId, approved: false }));
    }
    if (questions.length !== 20)
      throw new AppError(
        'أضف 20 سؤالًا للمرحلة قبل التجربة. يمكن تجربة المسودات دون اعتمادها.',
        409,
      );
    const book = await this.book(c, tx);
    questions.forEach((q) => validateQuestion(q, book));
    const config = {
      ...c,
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
        JSON.stringify(snapshotQuestions(questions)),
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
          synthetic: true,
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
          maxScore: 20,
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
      if (body.action === 'freeze') {
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
        validateBank(bank, book, isLocalMode() && c.fixture === true);
        for (const stage of stageKeys)
          await tx.query(
            'INSERT INTO competition_question_sets VALUES($1,$2,$3) ON CONFLICT(competition_id,stage) DO UPDATE SET questions=excluded.questions',
            [c.id, stage, JSON.stringify(bank.filter((q) => q.stage === stage))],
          );
        c.frozenAt = new Date(this.now()).toISOString();
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
    const bytes = await readFile(path.join(process.cwd(), 'public', b.url)).catch(() => null);
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== b.sha256)
      throw new AppError('ملف نسخة الكتاب مفقود أو تغير. شغّل تجهيز الأصول.', 409);
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
          pdfPage: Number(body.pdfPage),
          printedPage: Number(body.printedPage),
          hintPdfPageStart: Number(body.hintPdfPageStart),
          hintPdfPageEnd: Number(body.hintPdfPageEnd),
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
      validateQuestion(next, book);
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
}

export async function initializeCompetition(db: Database) {
  const fixtures =
    isLocalMode() && db.kind === 'pglite'
      ? (await import('./competition-fixtures')).competitionFixtures
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
