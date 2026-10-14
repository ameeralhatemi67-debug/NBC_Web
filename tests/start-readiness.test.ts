import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import {
  CompetitionService,
  initializeCompetition,
  newCompetition,
  officialBook,
} from '../src/lib/competition-service';
import {
  hintEligible,
  hintTarget,
  meetingQuestionCounts,
  stageKeys,
  type CompetitionQuestion,
} from '../src/lib/competition-domain';
import { preconditions } from '../src/lib/admin-launch';

const admin = { role: 'admin' as const, participant_id: null, actor: 'supplied-bank-test' };
const drafts = async (): Promise<CompetitionQuestion[]> =>
  JSON.parse(await readFile('docs/question-bank/2026-10-11/official-drafts.json', 'utf8'));

async function setup() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  await db.query('DELETE FROM question_versions');
  await db.query('DELETE FROM questions');
  return { db, service: new CompetitionService(db) };
}

test('production rehearsals require the current book bank and reject synthetic fallback and old sessions', async () => {
  const previousMode = process.env.NBC_RUNTIME_MODE;
  const { db, service } = await setup();
  try {
    const old = await service.startTest(admin, { stage: 'middle', synthetic: true });
    process.env.NBC_RUNTIME_MODE = 'production';
    for (const stage of stageKeys) {
      await assert.rejects(service.startTest(admin, { stage, synthetic: true }), /أضف/);
    }
    await assert.rejects(service.testState(admin, old.attempt!.id), { code: 'TEST_BANK_REPLACED' });
    await assert.rejects(
      service.write(
        admin,
        {
          attemptId: old.attempt!.id,
          clientEventId: randomUUID(),
          revision: 0,
          kind: 'SELECT',
          questionId: old.attempt!.questions[0].id,
          selected: [0],
        },
        true,
      ),
      { code: 'TEST_BANK_REPLACED' },
    );
    await assert.rejects(service.resetTest(admin, old.attempt!.id), { code: 'TEST_BANK_REPLACED' });
    assert.equal(
      (await db.query('SELECT revision FROM admin_test_runs WHERE id=$1', [old.attempt!.id]))
        .rows[0].revision,
      0,
    );
    const bank = await drafts();
    for (const q of bank)
      await db.query('INSERT INTO questions VALUES($1,$2)', [
        q.id,
        JSON.stringify({ ...q, bookVersionId: 'another-book' }),
      ]);
    await assert.rejects(service.startTest(admin, { stage: 'middle' }), /أضف/);
  } finally {
    await db.close();
    if (previousMode === undefined) delete process.env.NBC_RUNTIME_MODE;
    else process.env.NBC_RUNTIME_MODE = previousMode;
  }
});

test('all 75 supplied drafts run and score through the production rehearsal engine without opening the campaign', async () => {
  const previousMode = process.env.NBC_RUNTIME_MODE;
  const { db } = await setup();
  let now = Date.now();
  const service = new CompetitionService(db, () => now);
  try {
    const bank = await drafts();
    for (const q of bank)
      await db.query('INSERT INTO questions VALUES($1,$2)', [q.id, JSON.stringify(q)]);
    process.env.NBC_RUNTIME_MODE = 'production';
    for (const stage of stageKeys) {
      let state = await service.startTest(admin, { stage, synthetic: true });
      assert.equal(state.testQuestionSource, 'bank');
      assert.equal(state.attempt!.questions.length, meetingQuestionCounts[stage]);
      assert.deepEqual(
        new Set(state.attempt!.questions.map((q) => q.id)),
        new Set(bank.filter((q) => q.stage === stage).map((q) => q.id)),
      );
      assert.deepEqual(state.attempt!.feedback, {});
      const firstId = state.attempt!.questions[0].id;
      const pages = new Set<number>();
      for (const q of state.attempt!.questions)
        if (q.pdfPage !== null)
          for (let page = q.pdfPage; page <= (q.pdfPageEnd ?? q.pdfPage); page++) pages.add(page);
      for (const page of pages)
        for (let beat = 0; beat < 4; beat++) {
          now += 2000;
          await service.recordReading(
            admin,
            { attemptId: state.attempt!.id, clientEventId: randomUUID(), page, active: true },
            true,
          );
        }
      for (const q of state.attempt!.questions) {
        assert.ok(
          !('correctAnswers' in q) && !('sourceExcerpt' in q) && !('answerExplanation' in q),
        );
        const original = bank.find((item) => item.id === q.id)!;
        assert.deepEqual(q.options, original.options);
        state = await service.write(
          admin,
          {
            attemptId: state.attempt!.id,
            clientEventId: randomUUID(),
            revision: state.attempt!.revision,
            kind: 'SELECT',
            questionId: q.id,
            selected: original.correctAnswers,
          },
          true,
        );
        assert.deepEqual(state.attempt!.feedback, {});
      }
      state = await service.write(
        admin,
        {
          attemptId: state.attempt!.id,
          clientEventId: randomUUID(),
          revision: state.attempt!.revision,
          kind: 'SUBMIT',
        },
        true,
      );
      assert.equal(state.attempt!.score, meetingQuestionCounts[stage]);
      assert.equal(state.attempt!.percentage, 100);
      assert.deepEqual(state.attempt!.questions, []);
      assert.deepEqual(state.attempt!.answers, {});
      assert.deepEqual(state.attempt!.feedback, {});
      await assert.rejects(
        service.write(
          admin,
          {
            attemptId: state.attempt!.id,
            clientEventId: randomUUID(),
            revision: state.attempt!.revision,
            kind: 'SELECT',
            questionId: firstId,
            selected: [0],
          },
          true,
        ),
        { code: 'SUBMITTED' },
      );
      const reset = await service.resetTest(admin, state.attempt!.id);
      assert.equal(reset.testQuestionSource, 'bank');
      assert.notEqual(reset.attempt!.id, state.attempt!.id);
      await assert.rejects(service.testState(admin, state.attempt!.id), /غير موجودة/);
    }
    assert.equal((await db.query('SELECT id FROM attempts')).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM participants')).rows.length, 0);
    assert.equal((await service.current()).state, 'DRAFT');
    assert.equal((await service.current()).frozenAt, null);
  } finally {
    await db.close();
    if (previousMode === undefined) delete process.env.NBC_RUNTIME_MODE;
    else process.env.NBC_RUNTIME_MODE = previousMode;
  }
});

test('supplied hints match PDF pagination, cover and ranges, while official-source questions have no book hint', async () => {
  const bank = await drafts();
  const ready = preconditions(
    { ...officialBook, approved: true },
    bank,
    newCompetition('hint-readiness'),
  );
  assert.equal(ready.canFreeze, false);
  assert.deepEqual(
    ready.stages.map((s) => [s.active, s.approved, s.expected]),
    [
      [20, 0, 20],
      [25, 0, 25],
      [30, 0, 30],
    ],
  );
  assert.equal(
    preconditions(
      { ...officialBook, approved: true },
      [],
      newCompetition('hint-readiness'),
    ).stages.every((s) => s.active === 0 && !s.ok),
    true,
  );
  for (const q of bank) {
    if (q.sourceKind === 'official') {
      assert.equal(hintTarget(q), null);
      assert.equal(hintEligible(66, q, 66), false);
      continue;
    }
    assert.equal(q.pdfPage, q.printedPage === null ? 1 : q.printedPage + 2);
    if (q.printedPageEnd !== undefined) assert.equal(q.pdfPageEnd, q.printedPageEnd + 2);
    assert.deepEqual(hintTarget(q), [q.hintPdfPageStart, q.hintPdfPageEnd]);
    const end = q.pdfPageEnd ?? q.pdfPage!;
    assert.equal(hintEligible(end, q, 66), false);
    assert.equal(hintEligible(end + 1, q, 66), true);
    assert.ok(q.hintPdfPageStart! >= 1 && q.hintPdfPageEnd! <= 66);
  }
});
