import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import type { CompetitionQuestion, CompetitionState } from '../src/lib/competition-domain';
import { readingVisit, sourceReadingReady } from '../src/lib/reading-progress';

const admin = { role: 'admin' as const, participant_id: null, actor: 'reading-review-test' };
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
  let now = Date.now();
  const service = new CompetitionService(db, () => now);
  return {
    db,
    service,
    bank,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const choice = (s: CompetitionState, id: string) => ({
  attemptId: s.attempt!.id,
  revision: s.attempt!.revision,
  clientEventId: randomUUID(),
  kind: 'SELECT' as const,
  questionId: id,
  selected: [0],
});

test('reading credits server heartbeat intervals only, with exact source ranges and official exemptions', () => {
  const first = readingVisit(undefined, 1, true, 1000);
  assert.equal(first.creditedSeconds, 0);
  assert.equal(readingVisit(first, 1, true, 3000).creditedSeconds, 2);
  assert.equal(readingVisit(first, 1, true, 6000).creditedSeconds, 3);
  assert.equal(readingVisit(first, 1, true, 10000).creditedSeconds, 0);
  assert.equal(readingVisit(first, 1, false, 3000).creditedSeconds, 0);
  const jump = readingVisit(first, 66, true, 1100);
  assert.equal(jump.creditedSeconds, 0);
  assert.deepEqual(jump.flags, ['page_jump', 'rapid_page_turn']);
  const q = { pdfPage: 10, pdfPageEnd: 11 } as CompetitionQuestion;
  assert.equal(sourceReadingReady({ pageSeconds: { 66: 100, 10: 5 } }, q), false);
  assert.equal(sourceReadingReady({ pageSeconds: { 10: 5, 11: 5 } }, q), true);
  assert.equal(sourceReadingReady(undefined, { pdfPage: null } as CompetitionQuestion), true);
});

test('real bank rejects unread choices and submission, preserves reading across reload, and isolates reset/owners', async () => {
  const { db, service, bank, advance } = await fixture();
  try {
    let state = await service.startTest(admin, { stage: 'middle' });
    const q = state.attempt!.questions.find(
      (q) => q.pdfPage !== null && q.pdfPageEnd === undefined,
    )!;
    const runId = state.attempt!.id;
    const beat = (page: number, active = true, id = randomUUID()) =>
      service.recordReading(admin, { attemptId: runId, clientEventId: id, page, active }, true);
    assert.equal(state.competition.readingRequired, true);
    await assert.rejects(service.write(admin, choice(state, q.id), true), {
      code: 'READING_REQUIRED',
    });
    const eventId = randomUUID();
    await beat(1, true, eventId);
    advance(2000);
    assert.equal((await beat(1, true, eventId)).pageSeconds[1], 0);
    await assert.rejects(beat(2, true, eventId), { code: 'EVENT_REUSED' });
    advance(100);
    await beat(66);
    for (let i = 0; i < 3; i++) {
      advance(2000);
      await beat(66);
    }
    await assert.rejects(service.write(admin, choice(state, q.id), true), {
      code: 'READING_REQUIRED',
    });
    await assert.rejects(beat(67), /خارج/);
    await assert.rejects(
      service.recordReading(
        { ...admin, actor: 'other' },
        { attemptId: runId, clientEventId: randomUUID(), page: 1, active: true },
        true,
      ),
      /غير متاحة/,
    );
    advance(2000);
    await beat(q.pdfPage!);
    advance(60000); // Offline batches cannot claim the intervening minute.
    await beat(q.pdfPage!);
    await assert.rejects(service.write(admin, choice(state, q.id), true), {
      code: 'READING_REQUIRED',
    });
    for (let i = 0; i < 3; i++) {
      advance(2000);
      await beat(q.pdfPage!);
    }
    state = await service.testState(admin, runId);
    assert.equal(state.attempt!.revision, 0);
    assert.ok(state.attempt!.reading!.pageSeconds[q.pdfPage!] >= 5);
    state = await service.write(admin, choice(state, q.id), true);
    assert.equal(state.attempt!.revision, 1);
    await assert.rejects(
      service.write(
        admin,
        { attemptId: runId, clientEventId: randomUUID(), revision: 1, kind: 'SUBMIT' },
        true,
      ),
      { code: 'READING_REQUIRED' },
    );
    const official = state.attempt!.questions.find((q) => q.pdfPage === null)!;
    state = await service.write(admin, choice(state, official.id), true);
    assert.equal(state.attempt!.answers[official.id].selected.length, 1);
    const logs = (await db.query<{ detail: unknown }>('SELECT detail FROM audit')).rows;
    assert.ok(JSON.stringify(logs).includes('page_jump'));
    assert.ok(JSON.stringify(logs).includes('rapid_answers'));
    const reset = await service.resetTest(admin, runId);
    assert.deepEqual(reset.attempt!.reading, { pageSeconds: {} });
    await assert.rejects(
      service.recordReading(
        admin,
        { attemptId: runId, clientEventId: randomUUID(), page: 1, active: true },
        true,
      ),
      /غير متاحة/,
    );
    assert.equal(bank.length, 75);
  } finally {
    await db.close();
  }
});

test('reviewed bulk approval validates the whole batch before writing, versions sources and keeps launch closed', async () => {
  const { db, service, bank } = await fixture();
  try {
    const questions = bank
      .filter((q) => q.stage === 'middle')
      .map(({ id, version }) => ({ id, version }));
    await assert.rejects(service.approveQuestions(admin, { questions, reviewed: false }), /أكد/);
    await assert.rejects(
      service.approveQuestions({ ...admin, role: 'editor' }, { questions, reviewed: true }),
      /صلاحية/,
    );
    await assert.rejects(
      service.approveQuestions(admin, {
        reviewed: true,
        questions: [questions[0], { ...questions[1], version: 99 }],
      }),
      /إصدار أحدث/,
    );
    let rows = (await db.query<{ body: CompetitionQuestion }>('SELECT body FROM questions')).rows;
    assert.equal(rows.filter((r) => r.body.approved).length, 0);
    await service.approveQuestions(admin, { questions, reviewed: true });
    rows = (await db.query<{ body: CompetitionQuestion }>('SELECT body FROM questions')).rows;
    assert.equal(
      rows.filter((r) => r.body.approved && r.body.sourceVerified && r.body.version === 2).length,
      20,
    );
    assert.equal((await db.query('SELECT * FROM question_versions')).rows.length, 20);
    assert.equal((await service.current()).state, 'DRAFT');
    assert.equal((await service.current()).frozenAt, null);
    await assert.rejects(
      service.approveQuestions(admin, { questions: [null], reviewed: true }),
      /قائمة/,
    );
  } finally {
    await db.close();
  }
});
