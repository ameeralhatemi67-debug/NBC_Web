import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import {
  CompetitionService,
  initializeCompetition,
  officialBook,
} from '../src/lib/competition-service';
import { competitionFixtures } from '../src/lib/competition-fixtures';
import {
  applyEvent,
  assertWindow,
  feedbackFor,
  hintEligible,
  hintTarget,
  rankResults,
  readingSupported,
  sanitizeReading,
  sourceReadSeconds,
  safeQuestions,
  stageKeys,
  stageNames,
  validateBank,
  validateQuestion,
  type Competition,
  type CompetitionState,
  type WriteEvent,
} from '../src/lib/competition-domain';
import {
  DurableCompetitionSession,
  localRead,
  overlayPending,
  type LocalCompetition,
} from '../src/lib/competition-offline';
const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };
const editor = { role: 'editor' as const, participant_id: null, actor: 'editor-1' };
async function fixture() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  if (db.kind === 'postgres') {
    for (const q of competitionFixtures) {
      await db.query('INSERT INTO questions VALUES($1,$2)', [q.id, JSON.stringify(q)]);
      await db.query(
        "INSERT INTO question_versions(question_id,version,body,actor) VALUES($1,1,$2,'fixture')",
        [q.id, JSON.stringify(q)],
      );
    }
    await db.query(
      "UPDATE competitions SET body=jsonb_set(body,'{fixture}','true') WHERE id='nbc-1448-2026'",
    );
    await db.query("UPDATE book_versions SET body=jsonb_set(body,'{approved}','true')");
  }
  let now = Date.parse('2026-10-04T10:00:00Z');
  const service = new CompetitionService(db, () => now);
  for (const stage of stageKeys)
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [stage, `DEMO-${stage}`, 'synthetic', 'masked', stageNames[stage], 'test', 'test'],
    );
  return {
    db,
    service,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}
const student = (stage = 'middle') => ({ role: 'participant' as const, participant_id: stage });
const event = (
  state: CompetitionState,
  kind: WriteEvent['kind'],
  questionId?: string,
  selected?: number[],
): WriteEvent => ({
  clientEventId: randomUUID(),
  attemptId: state.attempt!.id,
  revision: state.attempt!.revision,
  kind,
  questionId,
  selected,
});
async function action(s: CompetitionService, action: string, extra: Record<string, unknown> = {}) {
  const c = await s.current();
  return s.configure(admin, { action, version: c.version, ...extra });
}
async function open(s: CompetitionService) {
  await action(s, 'freeze');
  await action(s, 'open');
}

test('freeze validates all stages, book identity, page mapping, answer keys, duplicates and production fixture exclusion', () => {
  const book = { ...officialBook, approved: true };
  validateBank(competitionFixtures, book, true);
  assert.throws(() => validateBank(competitionFixtures, book), /تجريبية/);
  assert.throws(() => validateBank(competitionFixtures.slice(1), book, true), /20/);
  for (const patch of [
    { pdfPage: 67 },
    { hintPdfPageEnd: 70 },
    { hintPdfPageStart: 10, hintPdfPageEnd: 13 },
    { stage: 'forged' },
    { correctAnswers: [] },
    { options: ['same', 'same'] },
    { bookVersionId: 'other' },
  ])
    assert.throws(() =>
      validateQuestion(
        { ...competitionFixtures[0], ...patch } as (typeof competitionFixtures)[0],
        book,
      ),
    );
  const duplicate = structuredClone(competitionFixtures);
  duplicate[1].title = duplicate[0].title;
  assert.throws(() => validateBank(duplicate, book, true), /متطابقة/);
  assert.equal(hintEligible(29, { pdfPage: 29 }), false);
  assert.equal(hintEligible(30, { pdfPage: 29 }), true);
  assert.deepEqual(hintTarget({ pdfPage: 29 }), [28, 29]);
  assert.deepEqual(hintTarget({ pdfPage: 1 }), [1, 1]);
});
test('selection may change, first check locks, multi-select scores exact sets, and feedback appears only after lock', () => {
  const q = competitionFixtures[0];
  let answers = applyEvent(
    [q],
    {},
    0,
    {
      clientEventId: 'event-1',
      attemptId: 'a',
      revision: 0,
      kind: 'SELECT',
      questionId: q.id,
      selected: [1],
    },
    'now',
  ).answers;
  answers = applyEvent(
    [q],
    answers,
    1,
    {
      clientEventId: 'event-2',
      attemptId: 'a',
      revision: 1,
      kind: 'SELECT',
      questionId: q.id,
      selected: [0],
    },
    'now',
  ).answers;
  const c = { feedbackMode: 'educational' } as Competition;
  assert.deepEqual(feedbackFor(c, [q], answers), {});
  answers = applyEvent(
    [q],
    answers,
    2,
    {
      clientEventId: 'event-3',
      attemptId: 'a',
      revision: 2,
      kind: 'CHECK',
      questionId: q.id,
      selected: [0],
    },
    'now',
  ).answers;
  assert.throws(
    () =>
      applyEvent(
        [q],
        answers,
        3,
        {
          clientEventId: 'event-4',
          attemptId: 'a',
          revision: 3,
          kind: 'SELECT',
          questionId: q.id,
          selected: [1],
        },
        'now',
      ),
    /الأولى/,
  );
  assert.equal(feedbackFor(c, [q], answers)[q.id].isCorrect, true);
  assert.equal(
    feedbackFor({ feedbackMode: 'formal' } as Competition, [q], answers)[q.id].isCorrect,
    true,
  );
  assert.equal(JSON.stringify(safeQuestions([q])).includes('correct'), false);
  const multi = { ...q, type: 'multi_select' as const, correctAnswers: [0, 2] };
  const locked = { [q.id]: { selected: [2, 0], locked: true, checkedAt: 'now' } };
  assert.equal(
    applyEvent(
      [multi],
      locked,
      0,
      { clientEventId: 'submit-1', attemptId: 'a', revision: 0, kind: 'SUBMIT' },
      'now',
    ).score,
    1,
  );
});
test('lifecycle, stage snapshots, concurrent starts, locking, idempotency, scoring, campaign uniqueness and stage leaderboards', async () => {
  const { db, service, advance } = await fixture();
  try {
    await assert.rejects(service.start(student()), /غير متاحة/);
    await open(service);
    const starts = await Promise.all([service.start(student()), service.start(student())]);
    assert.equal(starts[0].attempt!.id, starts[1].attempt!.id);
    assert.deepEqual(starts[0].attempt!.questions, starts[1].attempt!.questions);
    for (const stage of stageKeys) {
      const state = await service.start(student(stage));
      assert.equal(state.attempt!.questions.length, 20);
      assert.ok(state.attempt!.questions.every((q) => q.stage === stage));
    }
    let state = starts[0];
    const first = state.attempt!.questions[0];
    const q = competitionFixtures.find((q) => q.id === first.id)!;
    await service.saveQuestion(editor, { ...q, title: 'نسخة جديدة لا تغير المحاولة القائمة' });
    assert.equal(
      (await service.state(student())).attempt!.questions.find((q) => q.id === first.id)!.version,
      1,
    );
    await assert.rejects(
      service.saveQuestion(editor, { id: q.id, version: 2, approve: true }),
      /صلاحية/,
    );
    const select = event(state, 'SELECT', first.id, [0]);
    state = await service.write(student(), select);
    const stale = event(starts[0], 'SELECT', state.attempt!.questions[1].id, [0]);
    await assert.rejects(service.write(student(), stale), /أحدث/);
    const check = event(state, 'CHECK', first.id, [0]);
    state = await service.write(student(), check);
    const revision = state.attempt!.revision;
    assert.equal((await service.write(student(), check)).attempt!.revision, revision);
    await assert.rejects(service.write(student(), { ...check, selected: [1] }), /مستخدم/);
    await assert.rejects(service.write(student(), event(state, 'CHECK', first.id, [1])), /الأولى/);
    assert.ok(state.attempt!.feedback[first.id]);
    await assert.rejects(service.write(student(), event(state, 'SUBMIT')), /كل الإجابات/);
    // Select keys from the private immutable snapshots, accounting for option shuffling.
    const privateQuestions = (
      await db.query<{ questions: typeof competitionFixtures }>(
        'SELECT questions FROM attempts WHERE id=$1',
        [state.attempt!.id],
      )
    ).rows[0].questions;
    for (const item of privateQuestions.slice(1))
      state = await service.write(student(), event(state, 'CHECK', item.id, item.correctAnswers));
    const submit = event(state, 'SUBMIT');
    state = await service.write(student(), submit);
    const expected = 19 + Number(privateQuestions[0].correctAnswers[0] === 0);
    assert.equal(state.attempt!.score, expected);
    assert.equal(state.attempt!.percentage, (expected / 20) * 100);
    await assert.rejects(
      service.creditInvalidQuestion(editor, {
        questionId: first.id,
        reason: 'Invalid source mapping confirmed by committee',
      }),
      /صلاحية/,
    );
    await service.creditInvalidQuestion(admin, {
      questionId: first.id,
      reason: 'Invalid source mapping confirmed by committee',
    });
    assert.equal((await service.state(student())).attempt!.score, 20);
    assert.deepEqual((await service.state(student())).attempt!.questions, state.attempt!.questions);
    await assert.rejects(
      service.creditInvalidQuestion(admin, {
        questionId: first.id,
        reason: 'Invalid source mapping confirmed by committee',
      }),
      /بالفعل/,
    );
    assert.match(state.attempt!.participantNumber, /^\d{6,8}$/);
    assert.equal(
      (await service.write(student(), submit)).attempt!.participantNumber,
      state.attempt!.participantNumber,
    );
    assert.equal((await service.start(student())).attempt!.id, state.attempt!.id);
    await assert.rejects(service.leaderboard(undefined, 'middle'), /غير منشورة/);
    await action(service, 'close');
    await assert.rejects(action(service, 'publish'), /مهلة/);
    advance(61 * 60000);
    await action(service, 'publish');
    assert.equal((await service.leaderboard(undefined, 'middle')).entries.length, 1);
    assert.equal((await service.leaderboard(undefined, 'highschool')).entries.length, 0);
    await assert.rejects(
      service.start({ role: 'participant', participant_id: 'new' }),
      /غير موجود/,
    );
    await service.saveQuestion(admin, { id: q.id, version: 2, approve: true });
    await action(service, 'create');
    await open(service);
    const next = await service.start(student());
    assert.notEqual(next.attempt!.id, state.attempt!.id);
    assert.equal(
      (await db.query('SELECT id FROM attempts WHERE participant_id=$1', ['middle'])).rows.length,
      2,
    );
  } finally {
    await db.close();
  }
});
test('scheduled windows, immediate close and grace, audited recovery preserve locked data', async () => {
  const { db, service, advance, now } = await fixture();
  try {
    await action(service, 'freeze');
    const c = await service.current();
    await action(service, 'settings', {
      ...c,
      opensAt: new Date(now() + 60000).toISOString(),
      closesAt: new Date(now() + 120000).toISOString(),
      scheduled: true,
    });
    await assert.rejects(service.start(student()), /غير متاحة/);
    advance(61000);
    let state = await service.start(student());
    state = await service.write(
      student(),
      event(state, 'CHECK', state.attempt!.questions[0].id, [0]),
    );
    advance(60000);
    await assert.rejects(service.start(student('university')), /غير متاحة/);
    await action(service, 'settings', {
      ...(await service.current()),
      closesAt: new Date(now() + 60000).toISOString(),
    });
    await assert.rejects(service.start(student('university')), /غير متاحة/);
    state = await service.write(
      student(),
      event(state, 'CHECK', state.attempt!.questions[1].id, [0]),
    );
    advance(61 * 60000);
    await assert.rejects(
      service.write(student(), event(state, 'CHECK', state.attempt!.questions[2].id, [0])),
      /غير متاحة/,
    );
    await assert.rejects(
      service.recover(editor, {
        attemptId: state.attempt!.id,
        reason: 'confirmed outage',
        minutes: 60,
      }),
      /صلاحية/,
    );
    await assert.rejects(
      service.recover(admin, { attemptId: state.attempt!.id, reason: 'short', minutes: 60 }),
      /سبب/,
    );
    await service.recover(admin, {
      attemptId: state.attempt!.id,
      reason: 'Confirmed network outage documented by support',
      minutes: 60,
    });
    const recovered = await service.write(
      student(),
      event(state, 'CHECK', state.attempt!.questions[2].id, [0]),
    );
    assert.equal(recovered.attempt!.answers[state.attempt!.questions[0].id].locked, true);
    assert.equal((await db.query('SELECT id FROM attempt_recoveries')).rows.length, 1);
    assert.throws(
      () =>
        assertWindow(
          {
            ...c,
            state: 'CLOSED',
            closedAt: new Date(now()).toISOString(),
            closingPolicy: 'immediate',
          },
          false,
          now(),
        ),
      /غير متاحة/,
    );
  } finally {
    await db.close();
  }
});
test('admin test runs use core engine, repeat/reset, actor isolation, simulated close and have no production side effects', async () => {
  const { db, service } = await fixture();
  try {
    const before = (await db.query('SELECT count(*) AS count FROM attempts')).rows[0];
    const config = await service.current();
    await assert.rejects(service.startTest(editor, { stage: 'middle' }), /صلاحية/);
    await assert.rejects(service.startTest(student(), { stage: 'middle' }), /صلاحية/);
    let run = await service.startTest(admin, { stage: 'highschool', reveal: true });
    assert.equal(run.attempt!.questions.length, 20);
    assert.ok(run.attempt!.questions.every((q) => q.stage === 'highschool'));
    const qs = (
      await db.query<{ questions: typeof competitionFixtures }>(
        'SELECT questions FROM admin_test_runs WHERE id=$1',
        [run.attempt!.id],
      )
    ).rows[0].questions;
    assert.deepEqual(run.attempt!.feedback, {});
    for (const q of qs)
      run = await service.write(admin, event(run, 'CHECK', q.id, q.correctAnswers), true);
    assert.equal(run.attempt!.feedback[qs[0].id].isCorrect, true);
    run = await service.write(admin, event(run, 'SUBMIT'), true);
    assert.equal(run.attempt!.score, 20);
    assert.equal(run.attempt!.percentage, 100);
    assert.equal(
      (await service.testLeaderboard(admin, run.attempt!.id)).entries[0].participantNumber,
      run.attempt!.participantNumber,
    );
    const reset = await service.resetTest(admin, run.attempt!.id);
    assert.notEqual(reset.attempt!.id, run.attempt!.id);
    assert.deepEqual(reset.attempt!.answers, {});
    await assert.rejects(
      service.testState({ ...admin, actor: 'other' }, run.attempt!.id),
      /غير موجودة/,
    );
    const closed = await service.startTest(admin, { stage: 'middle', closed: true });
    await assert.rejects(
      service.write(admin, event(closed, 'CHECK', closed.attempt!.questions[0].id, [0]), true),
      /غير متاحة/,
    );
    assert.deepEqual((await db.query('SELECT count(*) AS count FROM attempts')).rows[0], before);
    assert.deepEqual(await service.current(), config);
    await assert.rejects(service.testState(admin, run.attempt!.id), /غير موجودة/);
    await assert.rejects(
      service.write(admin, event(run, 'CHECK', qs[0].id, qs[0].correctAnswers), true),
      (e: unknown) => (e as { code: string }).code === 'TEST_RESET',
    );
    assert.equal((await service.testLeaderboard(admin, reset.attempt!.id)).entries.length, 0);
    assert.equal(
      (await db.query('SELECT id FROM admin_test_runs WHERE id=$1', [run.attempt!.id])).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
test('offline queue persists across reload, retries ambiguous accepted writes exactly once and reconciles server locks', async () => {
  const { db, service } = await fixture();
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  try {
    await open(service);
    const state = await service.start(student());
    const q = state.attempt!.questions[0];
    let ambiguous = true;
    const transport = {
      state: () => service.state(student()),
      write: async (e: WriteEvent) => {
        const s = await service.write(student(), e);
        if (ambiguous) {
          ambiguous = false;
          throw new Error('connection lost after commit');
        }
        return s;
      },
    };
    const key = 'participant:offline';
    let displayed = state;
    let local = new DurableCompetitionSession(key, transport, (r) => {
      displayed = overlayPending(r.state, r.events);
    });
    await local.init({
      ...state,
      participant: { ...state.participant, name: 'First PrivateName', phone: 'private' },
    } as CompetitionState);
    const cached = (await localRead<LocalCompetition>(key))!;
    assert.deepEqual(cached.state.participant, { name: 'First', stage: state.participant.stage });
    await local.enqueue(event(state, 'CHECK', q.id, [0]));
    await local.sync();
    assert.equal(displayed.attempt!.answers[q.id].locked, true);
    assert.equal((await localRead<LocalCompetition>(key))!.events.length, 1);
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
    await local.sync();
    assert.equal(local.record.events.length, 1);
    const accepted = await service.state(student());
    assert.equal(accepted.attempt!.revision, 1);
    local = new DurableCompetitionSession(key, transport, (r) => {
      displayed = overlayPending(r.state, r.events);
    });
    await local.init(accepted);
    await local.sync();
    assert.equal(local.record.events.length, 0);
    assert.equal((await service.state(student())).attempt!.revision, 1);
    await local.enqueue(event(accepted, 'CHECK', q.id, [1]));
    await local.sync();
    assert.equal(local.record.conflicts.length, 1);
    assert.deepEqual(displayed.attempt!.answers[q.id].selected, [0]);
  } finally {
    await db.close();
  }
});
test('leaderboards share ranks for ties, use percentage and never use time', () => {
  const rows = [
    { participantNumber: '999', score: 20, maxScore: 20, percentage: 100 },
    { participantNumber: '100', score: 20, maxScore: 20, percentage: 100 },
    { participantNumber: '200', score: 19, maxScore: 20, percentage: 95 },
  ];
  assert.deepEqual(
    rankResults(rows).map((r) => r.rank),
    [1, 1, 3],
  );
});
test('empty official bank allows owned synthetic admin snapshots for all stages while launch and participant storage remain gated', async () => {
  const { db, service } = await fixture();
  try {
    await db.query('DELETE FROM question_versions');
    await db.query('DELETE FROM questions');
    const participants = (await db.query('SELECT count(*) AS n FROM participants')).rows[0];
    for (const stage of stageKeys) {
      await assert.rejects(service.startTest(admin, { stage }), /20/);
      const run = await service.startTest(admin, { stage, synthetic: true });
      assert.equal(run.attempt!.questions.length, 20);
      assert.ok(run.attempt!.questions.every((q) => q.stage === stage));
      const stored = (
        await db.query<{ questions: typeof competitionFixtures }>(
          'SELECT questions FROM admin_test_runs WHERE id=$1',
          [run.attempt!.id],
        )
      ).rows[0];
      assert.ok(stored.questions.every((q) => q.fixture === true && q.approved === false));
      await assert.rejects(service.testState(editor, run.attempt!.id), /صلاحية/);
      await assert.rejects(
        service.write(
          { ...admin, actor: 'other' },
          event(run, 'CHECK', run.attempt!.questions[0].id, [0]),
          true,
        ),
        /غير موجودة/,
      );
    }
    assert.deepEqual(
      (await db.query('SELECT count(*) AS n FROM participants')).rows[0],
      participants,
    );
    assert.equal((await db.query('SELECT id FROM attempts')).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM questions')).rows.length, 0);
    assert.equal((await service.current()).state, 'DRAFT');
    await assert.rejects(action(service, 'freeze'), /20/);
    await assert.rejects(service.start(student()), /غير متاحة/);
  } finally {
    await db.close();
  }
});
test('database rejects snapshot tampering, changing the first check, and reopening submitted attempts', async () => {
  const { db, service } = await fixture();
  try {
    await open(service);
    let state = await service.start(student());
    const q = state.attempt!.questions[0];
    state = await service.write(student(), event(state, 'CHECK', q.id, [0]));
    await assert.rejects(
      db.query("UPDATE attempts SET questions='[]' WHERE id=$1", [state.attempt!.id]),
      /immutable/,
    );
    await assert.rejects(
      db.query("UPDATE attempt_answers SET selected='[1]' WHERE attempt_id=$1 AND question_id=$2", [
        state.attempt!.id,
        q.id,
      ]),
      /immutable/,
    );
    await assert.rejects(
      db.query('DELETE FROM attempt_answers WHERE attempt_id=$1 AND question_id=$2', [
        state.attempt!.id,
        q.id,
      ]),
      /immutable/,
    );
    await assert.rejects(
      db.query("UPDATE attempt_questions SET snapshot='{}' WHERE attempt_id=$1", [
        state.attempt!.id,
      ]),
      /immutable/,
    );
    for (const next of state.attempt!.questions.slice(1))
      state = await service.write(student(), event(state, 'CHECK', next.id, [0]));
    state = await service.write(student(), event(state, 'SUBMIT'));
    await assert.rejects(
      db.query('UPDATE attempts SET submitted_at=NULL WHERE id=$1', [state.attempt!.id]),
      /reopened/,
    );
    assert.ok((await service.state(student())).attempt!.submittedAt);
  } finally {
    await db.close();
  }
});

test('reading evidence ties a lock to the source page and its neighbours without forcing an order', () => {
  const q = { pdfPage: 10 };
  assert.equal(sourceReadSeconds({ 9: 2, 10: 1, 11: 3, 40: 99 }, q, 66), 6);
  assert.equal(sourceReadSeconds({ 6: 50 }, q, 66), 0);
  assert.equal(sourceReadSeconds({ 66: 4, 67: 100 }, { pdfPage: 66 }, 66), 4);
  assert.equal(readingSupported(4), false);
  assert.equal(readingSupported(5), true);
  assert.equal(sanitizeReading(null), undefined);
  assert.deepEqual(
    sanitizeReading({ sourceSeconds: -5, totalSeconds: 'x', maxPage: 7.6, questionSeconds: 1e9 }),
    {
      sourceSeconds: 0,
      totalSeconds: 0,
      maxPage: 8,
      questionSeconds: 36000,
    },
  );
});

test('a lock stores its reading evidence and the same response already carries the revealed answer', async () => {
  const { db, service } = await fixture();
  try {
    await open(service);
    let state = await service.start(student());
    const q = state.attempt!.questions[0];
    const reading = { sourceSeconds: 2, totalSeconds: 30, maxPage: 6, questionSeconds: 9 };
    state = await service.write(student(), { ...event(state, 'CHECK', q.id, [0]), reading });
    assert.ok(state.attempt!.feedback[q.id], 'feedback is returned by the write itself');
    const rows = (
      await db.query<{ payload: { reading?: unknown } }>(
        "SELECT payload FROM attempt_events WHERE attempt_id=$1 AND payload->>'kind'='CHECK'",
        [state.attempt!.id],
      )
    ).rows;
    assert.deepEqual(rows[0].payload.reading, reading);
  } finally {
    await db.close();
  }
});

test('sync writes without a state fetch, drops superseded selections and retries a stale revision once', async () => {
  const { db, service } = await fixture();
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  try {
    await open(service);
    const state = await service.start(student());
    const [a, b, c] = state.attempt!.questions;
    const calls: string[] = [];
    let stale = true;
    const transport = {
      state: async () => {
        calls.push('state');
        return service.state(student());
      },
      write: async (e: WriteEvent) => {
        calls.push(`${e.kind}:${e.questionId === a.id ? 'a' : 'b'}`);
        if (stale && e.kind === 'SELECT') {
          stale = false;
          const bump = await service.state(student());
          await service.write(student(), event(bump, 'SELECT', c.id, [1]));
        }
        return service.write(student(), e);
      },
    };
    const local = new DurableCompetitionSession('participant:fast', transport, () => {});
    await local.init(state);
    await local.enqueue(event(state, 'SELECT', a.id, [0]));
    await local.enqueue(event(state, 'CHECK', a.id, [0]));
    await local.sync();
    assert.deepEqual(calls, ['CHECK:a'], 'no state fetch and the superseded select is not sent');
    calls.length = 0;
    await local.enqueue(event(local.record.state, 'SELECT', b.id, [0]));
    await local.sync();
    assert.deepEqual(calls, ['SELECT:b', 'state', 'SELECT:b'], 'a stale revision refreshes once');
    assert.equal(local.record.events.length, 0);
  } finally {
    await db.close();
  }
});
