import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import { ParticipantAdmin } from '../src/lib/participant-admin';
import { SimulationService } from '../src/lib/simulation-service';
import { simulationParticipants } from '../src/lib/simulation-fixtures';
import {
  playbackPosition,
  restorePlayback,
  PRACTICE_ENTRY_MS,
  PRACTICE_FINISH_MS,
} from '../src/lib/simulation-domain';
import {
  stageKeys,
  stageNames,
  type CompetitionQuestion,
  type CompetitionState,
  type WriteEvent,
} from '../src/lib/competition-domain';
import { localRead, localWrite, DurableCompetitionSession } from '../src/lib/competition-offline';
import { summarize } from '../src/lib/analytics';

const admin = { role: 'admin' as const, participant_id: null, actor: 'simulation-admin' };
const editor = { ...admin, role: 'editor' as const };
const participant = (id: string) => ({ role: 'participant' as const, participant_id: id });
async function fixture() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  await db.query('DELETE FROM question_versions');
  await db.query('DELETE FROM questions');
  const bank: CompetitionQuestion[] = JSON.parse(
    await readFile('docs/question-bank/2026-10-11/official-drafts.json', 'utf8'),
  );
  for (const q of bank)
    await db.query('INSERT INTO questions VALUES($1,$2)', [q.id, JSON.stringify(q)]);
  for (const id of [...stageKeys, 'late', 'too-late']) {
    const stage = stageKeys.includes(id as (typeof stageKeys)[number])
      ? (id as (typeof stageKeys)[number])
      : 'middle';
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        `SIM-IDENTITY-${id}`,
        'مشارك اختبار',
        `masked-${id}`,
        stageNames[stage],
        'الشرقية',
        'الدمام',
      ],
    );
  }
  let now = Date.parse('2026-10-14T09:00:00Z');
  return {
    db,
    bank,
    service: new SimulationService(db, () => now),
    engine: new CompetitionService(db, () => now),
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    setNow: (time: number) => {
      now = time;
    },
  };
}
function event(s: CompetitionState, q: string, selected: number[]): WriteEvent {
  return {
    attemptId: s.attempt!.id,
    revision: s.attempt!.revision,
    clientEventId: randomUUID(),
    kind: 'SELECT',
    questionId: q,
    selected,
  };
}
test('dashboard seeks are deterministic, internally consistent, and pause/restore cannot change practice deadlines', () => {
  const date = '2026-10-14T06:00:00Z';
  assert.deepEqual(simulationParticipants(3, 0, date), []);
  for (const t of [1, 150, 299, 300]) {
    const rows = simulationParticipants(3, t, date);
    assert.deepEqual(rows, simulationParticipants(3, t, date));
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
    for (const r of rows) {
      assert.equal(r.score !== null, r.submitted_at !== null);
      if (r.score !== null) {
        assert.ok(r.attempt_id);
        assert.ok(r.score <= r.max_score!);
        assert.ok(Date.parse(r.submitted_at!) > Date.parse(r.attempt_started_at!));
      }
    }
    assert.equal(summarize(rows).total, rows.length);
  }
  const earlier = simulationParticipants(3, 150, date);
  simulationParticipants(3, 300, date);
  assert.deepEqual(simulationParticipants(3, 150, date), earlier);
  assert.equal(simulationParticipants(3, 300, date).length, 240);
  const p = {
    id: 'test',
    seed: 3,
    referenceDate: date,
    position: 12,
    anchor: 1000,
    playing: false,
  };
  assert.equal(playbackPosition(p, 999000), 12);
  assert.equal(playbackPosition({ ...p, playing: true }, 400000), 300);
  assert.deepEqual(restorePlayback(p), p);
  assert.equal(restorePlayback({ ...p, position: -1 }), null);
  assert.equal(restorePlayback({ ...p, referenceDate: 'invalid' }), null);
});
test('practice uses real bank snapshots, stage ownership, reading gates and aggregate-only scores, without official attempts', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.service.open(editor), { status: 403 });
    const before = await f.engine.current();
    const opened = await f.service.open(admin);
    const id = opened.run!.id;
    assert.equal(Date.parse(opened.run!.entryClosesAt) - f.now(), PRACTICE_ENTRY_MS);
    assert.equal(
      Date.parse(opened.run!.finishUntil) - Date.parse(opened.run!.entryClosesAt),
      PRACTICE_FINISH_MS,
    );
    const publicStatus = JSON.stringify(await f.service.status());
    assert.ok(!publicStatus.includes('questions') && !publicStatus.includes('correctAnswers'));
    await assert.rejects(f.service.open(admin), { code: 'PRACTICE_ACTIVE' });
    const states: CompetitionState[] = [];
    for (const stage of stageKeys) {
      const starts = await Promise.all([
        f.service.start(participant(stage), id),
        f.service.start(participant(stage), id),
      ]);
      assert.equal(starts[0].attempt!.id, starts[1].attempt!.id);
      assert.equal(
        starts[0].attempt!.questions.length,
        stage === 'middle' ? 20 : stage === 'highschool' ? 25 : 30,
      );
      assert.deepEqual(
        (await f.engine.practiceState(participant(stage), id)).attempt!.questions,
        starts[0].attempt!.questions,
      );
      assert.ok(!JSON.stringify(starts[0]).includes('correctAnswers'));
      states.push(starts[0]);
    }
    await assert.rejects(f.engine.configure(admin, { action: 'create', title: 'Another' }), {
      code: 'PRACTICE_ACTIVE',
    });
    await f.db.query(
      "UPDATE questions SET body=jsonb_set(body,'{title}','\"edited after opening\"') WHERE id=$1",
      [f.bank[0].id],
    );
    assert.ok(
      !JSON.stringify(await f.engine.practiceState(participant('middle'), id)).includes(
        'edited after opening',
      ),
    );
    for (let i = 0; i < stageKeys.length; i++) {
      const s = participant(stageKeys[i]);
      let state = states[i];
      const unread = state.attempt!.questions.find((q) => q.pdfPage !== null)!;
      await assert.rejects(f.engine.write(s, event(state, unread.id, [0]), 'simulation'), {
        code: 'READING_REQUIRED',
      });
      const wrong = participant(stageKeys[(i + 1) % 3]);
      await assert.rejects(f.engine.write(wrong, event(state, unread.id, [0]), 'simulation'), {
        status: 404,
      });
      await assert.rejects(
        f.engine.recordReading(
          wrong,
          { attemptId: state.attempt!.id, clientEventId: randomUUID(), page: 1, active: true },
          'simulation',
        ),
        { status: 404 },
      );
      await assert.rejects(f.engine.write(s, event(state, unread.id, [0])), { status: 404 });
      const snapshot = (
        await f.db.query<{ questions: CompetitionQuestion[] }>(
          'SELECT questions FROM simulation_attempts WHERE id=$1',
          [state.attempt!.id],
        )
      ).rows[0].questions;
      for (const q of snapshot) {
        if (q.pdfPage !== null) {
          for (let page = q.pdfPage; page <= (q.pdfPageEnd ?? q.pdfPage); page++) {
            for (let heartbeat = 0; heartbeat < 4; heartbeat++) {
              f.advance(heartbeat ? 2000 : 1);
              await f.engine.recordReading(
                s,
                { attemptId: state.attempt!.id, clientEventId: randomUUID(), page, active: true },
                'simulation',
              );
            }
          }
        }
        assert.ok(
          q.pdfPage === null ||
            (await f.engine.practiceState(s, id)).attempt!.reading!.pageSeconds[q.pdfPage!] >= 5,
          `reading missing for ${q.id} page ${q.pdfPage}: ${JSON.stringify((await f.engine.practiceState(s, id)).attempt!.reading)}`,
        );
        state = await f.engine.write(s, event(state, q.id, q.correctAnswers), 'simulation');
      }
      const submit: WriteEvent = {
        attemptId: state.attempt!.id,
        revision: state.attempt!.revision,
        clientEventId: randomUUID(),
        kind: 'SUBMIT',
      };
      state = await f.engine.write(s, submit, 'simulation');
      assert.equal(state.attempt!.percentage, 100);
      assert.deepEqual(state.attempt!.questions, []);
      assert.deepEqual(state.attempt!.answers, {});
      assert.deepEqual(state.attempt!.feedback, {});
      assert.equal(
        (await f.engine.write(s, submit, 'simulation')).attempt!.revision,
        state.attempt!.revision,
      );
      await assert.rejects(
        f.db.query('UPDATE simulation_attempts SET questions=$1 WHERE id=$2', [
          '[]',
          state.attempt!.id,
        ]),
        /immutable/,
      );
      await assert.rejects(
        f.db.query('UPDATE simulation_attempts SET score=0 WHERE id=$1', [state.attempt!.id]),
        /cannot be changed/,
      );
    }
    assert.equal(
      (await f.service.admin(admin)).participants.filter((p) => p.submitted_at).length,
      3,
    );
    assert.equal((await f.db.query('SELECT id FROM attempts')).rows.length, 0);
    assert.equal((await f.db.query('SELECT attempt_id FROM attempt_events')).rows.length, 0);
    assert.deepEqual(await f.engine.current(), before);
    assert.equal((await f.db.query('SELECT id FROM admin_test_runs')).rows.length, 0);
    await assert.rejects(f.db.query('DELETE FROM simulation_events'), /immutable/);
    const erased = await new ParticipantAdmin(f.db).erase(admin, {
      id: 'middle',
      reason: 'An isolated practice privacy erasure check',
    });
    assert.equal(erased.mode, 'anonymized');
    assert.equal(
      (await f.db.query('SELECT id FROM simulation_attempts WHERE participant_id=$1', ['middle']))
        .rows.length,
      1,
    );
  } finally {
    await f.db.close();
  }
});
test('five-minute admission and fifteen-minute completion use server time, with early close, expiry, replay and fresh windows', async () => {
  const f = await fixture();
  try {
    let report = await f.service.open(admin);
    const run = report.run!;
    f.setNow(Date.parse(run.entryClosesAt) - 1);
    let state = await f.service.start(participant('late'), run.id);
    f.advance(1);
    await assert.rejects(f.service.start(participant('too-late'), run.id), {
      code: 'PRACTICE_ENTRY_CLOSED',
    });
    const q = state.attempt!.questions.find((q) => q.pdfPage === null)!;
    const write = event(state, q.id, [0]);
    state = await f.engine.write(participant('late'), write, 'simulation');
    f.setNow(Date.parse(run.finishUntil));
    await assert.rejects(
      f.engine.write(participant('late'), event(state, q.id, [1]), 'simulation'),
      { code: 'PRACTICE_EXPIRED' },
    );
    assert.equal(
      (await f.engine.write(participant('late'), write, 'simulation')).attempt!.revision,
      state.attempt!.revision,
    );
    await assert.rejects(
      f.engine.write(participant('late'), { ...write, selected: [1] }, 'simulation'),
      { code: 'EVENT_REUSED' },
    );
    report = await f.service.open(admin);
    assert.notEqual(report.run!.id, run.id);
    const fresh = await f.service.start(participant('late'), report.run!.id);
    assert.notEqual(fresh.attempt!.id, state.attempt!.id);
    f.advance(20_000);
    await assert.rejects(f.service.close(admin, report.run!.id, 999), { status: 409 });
    let clockTicks = 0;
    const tickingClock = new SimulationService(f.db, () => f.now() + clockTicks++);
    const closed = await tickingClock.close(admin, report.run!.id, report.run!.version);
    assert.equal(Date.parse(closed.run!.entryClosesAt), f.now());
    assert.equal(Date.parse(closed.run!.finishUntil) - f.now(), PRACTICE_FINISH_MS);
    assert.equal(
      (await f.service.close(admin, closed.run!.id, closed.run!.version - 1)).run!.version,
      closed.run!.version,
    );
    await assert.rejects(
      f.db.query(
        "UPDATE simulation_runs SET finish_until=finish_until+interval '1 minute' WHERE id=$1",
        [closed.run!.id],
      ),
      /cannot be extended/,
    );
    await f.db.query(
      "UPDATE competitions SET body=jsonb_set(body,'{state}','\"OPEN\"') WHERE id=$1",
      [f.engine ? (await f.engine.current()).id : ''],
    );
    const official = fresh.attempt!.questions.find((q) => q.pdfPage === null)!;
    await assert.rejects(
      f.engine.write(participant('late'), event(fresh, official.id, [0]), 'simulation'),
      { code: 'PRACTICE_EXPIRED' },
    );
    assert.equal((await f.service.status()).run!.canFinish, false);
  } finally {
    await f.db.close();
  }
});
test('incomplete bank blocks public practice while generated dashboard remains usable', async () => {
  const f = await fixture();
  try {
    await f.db.query('DELETE FROM questions WHERE id=$1', [f.bank[0].id]);
    assert.ok((await f.service.admin(admin)).blocker.includes('سؤال'));
    await assert.rejects(f.service.open(admin), { status: 409 });
    assert.equal((await f.db.query('SELECT id FROM simulation_runs')).rows.length, 0);
    assert.equal(simulationParticipants(1, 300, new Date(f.now()).toISOString()).length, 240);
  } finally {
    await f.db.close();
  }
});
test('public practice refuses production fixtures and retains its captured stage after a profile edit', async () => {
  const f = await fixture();
  const previousMode = process.env.NBC_RUNTIME_MODE;
  try {
    await f.db.query("UPDATE questions SET body=jsonb_set(body,'{fixture}','true') WHERE id=$1", [
      f.bank[0].id,
    ]);
    process.env.NBC_RUNTIME_MODE = 'production';
    await assert.rejects(f.service.open(admin), { status: 409 });
    assert.equal((await f.db.query('SELECT id FROM simulation_runs')).rows.length, 0);
    await f.db.query("UPDATE questions SET body=body-'fixture' WHERE id=$1", [f.bank[0].id]);
    const run = (await f.service.open(admin)).run!;
    const state = await f.service.start(participant('middle'), run.id);
    await f.db.query('UPDATE participants SET stage=$1 WHERE id=$2', [
      stageNames.university,
      'middle',
    ]);
    assert.equal(
      (await f.engine.practiceState(participant('middle'), run.id)).participant.stage,
      stageNames.middle,
    );
    assert.equal((await f.service.admin(admin)).participants[0].stage, stageNames.middle);
    assert.equal(state.attempt!.questions.length, 20);
  } finally {
    if (previousMode === undefined) delete process.env.NBC_RUNTIME_MODE;
    else process.env.NBC_RUNTIME_MODE = previousMode;
    await f.db.close();
  }
});
test('practice durable queue and active pointer remain separate from official and admin queues', async () => {
  const f = await fixture();
  const oldIndexedDB = globalThis.indexedDB;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  globalThis.indexedDB = new IDBFactory();
  try {
    const run = (await f.service.open(admin)).run!;
    const state = await f.service.start(participant('middle'), run.id);
    await localWrite('participant-active', 'official-pointer');
    const key = `simulation:${run.id}:${state.attempt!.id}`;
    await localWrite(`simulation-active:${run.id}`, key);
    let lostResponse = true;
    const transport = {
      state: () => f.engine.practiceState(participant('middle'), run.id),
      write: async (e: WriteEvent) => {
        const accepted = await f.engine.write(participant('middle'), e, 'simulation');
        if (lostResponse) {
          lostResponse = false;
          throw new Error('response lost');
        }
        return accepted;
      },
    };
    const session = new DurableCompetitionSession(key, transport, () => {});
    await session.init(state);
    const q = state.attempt!.questions.find((q) => q.pdfPage === null)!;
    await session.enqueue(event(state, q.id, [0]));
    await session.sync();
    const resumed = new DurableCompetitionSession(key, transport, () => {});
    await resumed.init(await f.engine.practiceState(participant('middle'), run.id));
    await resumed.sync();
    assert.equal(resumed.record.events.length, 0);
    assert.equal(
      (await f.engine.practiceState(participant('middle'), run.id)).attempt!.revision,
      1,
    );
    assert.equal(await localRead('participant-active'), 'official-pointer');
    assert.equal(await localRead(`simulation-active:${run.id}`), key);
  } finally {
    globalThis.indexedDB = oldIndexedDB;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    await f.db.close();
  }
});
