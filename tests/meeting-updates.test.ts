import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import { disposableDatabase } from './database-fixture';
import { migrate, migrations, migrationChecksum } from '../src/lib/migrations';
import {
  CompetitionService,
  initializeCompetition,
  newCompetition,
  officialBook,
} from '../src/lib/competition-service';
import { fixturesForCampaign } from '../src/lib/competition-fixtures';
import {
  stageKeys,
  stageNames,
  meetingQuestionCounts,
  questionCount,
  validateQuestion,
  hintEligible,
  hintTarget,
  type CompetitionQuestion,
  type CompetitionState,
  type WriteEvent,
} from '../src/lib/competition-domain';
import { DurableCompetitionSession } from '../src/lib/competition-offline';
import { easternCities } from '../src/lib/content';
import { preconditions } from '../src/lib/admin-launch';
const admin = { role: 'admin' as const, participant_id: null, actor: 'meeting-test' };
const event = (
  s: CompetitionState,
  kind: WriteEvent['kind'],
  questionId?: string,
  selected?: number[],
): WriteEvent => ({
  clientEventId: randomUUID(),
  attemptId: s.attempt!.id,
  revision: s.attempt!.revision,
  kind,
  questionId,
  selected,
});
async function fixture() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  const service = new CompetitionService(db);
  const c = await service.current();
  const questions = fixturesForCampaign(c).map((q) => ({
    ...q,
    approved: true,
    preserveOptionOrder: true,
  }));
  for (const q of questions)
    await db.query(
      'INSERT INTO questions VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
      [q.id, JSON.stringify(q)],
    );
  await db.query("UPDATE competitions SET body=jsonb_set(body,'{fixture}','true') WHERE id=$1", [
    c.id,
  ]);
  await db.query("UPDATE book_versions SET body=jsonb_set(body,'{approved}','true')");
  for (const stage of stageKeys)
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [stage, `DEMO-${stage}`, 'synthetic', 'masked', stageNames[stage], 'الشرقية', 'الدمام'],
    );
  await service.configure(admin, { action: 'freeze', version: (await service.current()).version });
  await service.configure(admin, { action: 'open', version: (await service.current()).version });
  return { db, service, questions };
}
test('75 supplied drafts retain keys, row references, source types, ranges and approval gate', async () => {
  const drafts: CompetitionQuestion[] = JSON.parse(
    await readFile('docs/question-bank/2026-10-11/official-drafts.json', 'utf8'),
  );
  const review = JSON.parse(
    await readFile('docs/question-bank/2026-10-11/source-review.json', 'utf8'),
  );
  assert.equal(drafts.length, 75);
  assert.equal(new Set(drafts.map((q) => q.id)).size, 75);
  for (const stage of stageKeys) {
    const bank = drafts.filter((q) => q.stage === stage);
    assert.equal(bank.length, meetingQuestionCounts[stage]);
    assert.ok(
      bank
        .slice(-3)
        .every(
          (q) =>
            q.sourceKind === 'official' &&
            q.pdfPage === null &&
            q.printedPage === null &&
            q.hintPdfPageStart === null,
        ),
    );
    assert.equal(
      preconditions({ ...officialBook, approved: true }, bank, newCompetition('test')).stages.find(
        (s) => s.stage === stage,
      )!.expected,
      bank.length,
    );
  }
  for (const q of drafts) {
    const original = review.records.find((r: { id: string }) => r.id === q.id);
    assert.deepEqual(q.options, original.normalizedOptions);
    assert.equal(q.title, original.normalizedTitle);
    assert.equal(
      q.correctAnswers[0],
      ['أ', 'ب', 'ج'].indexOf(original.originalAnswerKey.replace('ـ', '')),
    );
    assert.ok(q.sourceRow && q.preserveOptionOrder && !q.approved && !q.fixture);
    validateQuestion(q, officialBook);
    assert.throws(
      () => validateQuestion({ ...q, approved: true }, officialBook, true),
      /راجع مصدر/,
    );
    validateQuestion({ ...q, sourceVerified: true }, officialBook, true);
  }
  const range = drafts.find((q) => q.printedPageEnd)!;
  assert.deepEqual(hintTarget(range), [range.pdfPage, range.pdfPageEnd]);
  assert.equal(hintEligible(range.pdfPageEnd!, range, 66), false);
  assert.equal(hintEligible(range.pdfPageEnd! + 1, range, 66), true);
  assert.equal(hintTarget(drafts.find((q) => q.sourceKind === 'official')!), null);
  assert.equal(drafts[0].printedPage, null);
  assert.equal(drafts[0].pdfPage, 1);
  assert.deepEqual(easternCities, [
    'الدمام',
    'الأحساء',
    'الجبيل',
    'القطيف',
    'الخبر',
    'الخفجي',
    'رأس تنورة',
    'بقيق',
    'النعيرية',
    'قرية العليا',
    'البيضاء',
    'حفر الباطن',
  ]);
});
test('20/25/30 server journeys edit, reload, reject incomplete/stale/concurrent writes, submit atomically and remain immutable', async () => {
  const { db, service, questions } = await fixture();
  try {
    for (const stage of stageKeys) {
      const student = { role: 'participant' as const, participant_id: stage };
      let state = await service.start(student);
      assert.equal(state.attempt!.questions.length, meetingQuestionCounts[stage]);
      assert.equal(state.attempt!.maxScore, meetingQuestionCounts[stage]);
      assert.deepEqual(state.attempt!.feedback, {});
      const first = state.attempt!.questions[0];
      assert.deepEqual(first.options, questions.find((q) => q.id === first.id)!.options);
      await assert.rejects(service.write(student, event(state, 'CHECK', first.id, [0])), {
        code: 'FINAL_SUBMISSION_REQUIRED',
      });
      await assert.rejects(service.write(student, event(state, 'SUBMIT')), { code: 'INCOMPLETE' });
      const race = await Promise.allSettled([
        service.write(student, event(state, 'SELECT', first.id, [0])),
        service.write(student, event(state, 'SELECT', first.id, [1])),
      ]);
      assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
      state = await service.state(student);
      assert.equal(state.attempt!.answers[first.id].locked, false);
      assert.deepEqual(state.attempt!.feedback, {});
      const stale = event(state, 'SUBMIT');
      for (const q of state.attempt!.questions) {
        const answer = questions.find((original) => original.id === q.id)!.correctAnswers;
        state = await service.write(student, event(state, 'SELECT', q.id, answer));
        assert.deepEqual(state.attempt!.feedback, {});
      }
      const revised = state.attempt!.revision;
      state = await service.state(student);
      assert.equal(state.attempt!.revision, revised);
      await assert.rejects(service.write(student, stale), { code: 'REVISION_CONFLICT' });
      assert.ok(Object.values(state.attempt!.answers).every((a) => !a.locked));
      const submit = event(state, 'SUBMIT');
      const submitted = await Promise.all([
        service.write(student, submit),
        service.write(student, submit),
      ]);
      state = submitted[0];
      assert.equal(submitted[1].attempt!.receipt, state.attempt!.receipt);
      assert.equal(state.attempt!.score, meetingQuestionCounts[stage]);
      assert.equal(state.attempt!.percentage, 100);
      // Submitted participants still never receive correct answers or explanations.
      assert.deepEqual(state.attempt!.feedback, {});
      assert.deepEqual(state.attempt!.answers, {});
      assert.deepEqual(state.attempt!.questions, []);
      assert.equal(
        (await service.write(student, event(state, 'SUBMIT'))).attempt!.revision,
        state.attempt!.revision,
      );
      await assert.rejects(service.write(student, event(state, 'SELECT', first.id, [1])), {
        code: 'SUBMITTED',
      });
      const changedAnswer = JSON.stringify([
        (questions.find((q) => q.id === first.id)!.correctAnswers[0] + 1) % first.options.length,
      ]);
      await assert.rejects(
        db.query('UPDATE attempt_answers SET selected=$1 WHERE attempt_id=$2 AND question_id=$3', [
          changedAnswer,
          state.attempt!.id,
          first.id,
        ]),
        /immutable/i,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int AS n FROM attempt_answers WHERE attempt_id=$1 AND checked_at IS NOT NULL',
            [state.attempt!.id],
          )
        ).rows[0].n,
        meetingQuestionCounts[stage],
      );
    }
  } finally {
    await db.close();
  }
});
test('migration upgrades only a current empty draft and preserves legacy campaigns, freeze snapshots and participant cities', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await initializeCompetition(db);
    // Recreate the pre-meeting boundary in a disposable database only.
    await db.query(
      "DELETE FROM schema_migrations WHERE id IN ('011_meeting_rules','012_meeting_saved_copy')",
    );
    await db.query(
      'UPDATE competitions SET body=(body-\'questionCounts\'-\'answerMode\') || \'{"frozenAt":"old","eligibility":{"regions":["الشرقية"],"cities":{"الشرقية":["الهفوف"]}}}\'::jsonb WHERE id=\'nbc-1448-2026\'',
    );
    const legacy = {
      ...newCompetition('started'),
      answerMode: undefined,
      questionCounts: undefined,
      state: 'OPEN',
      frozenAt: 'legacy',
    };
    await db.query('INSERT INTO competitions(id,body) VALUES($1,$2)', [
      legacy.id,
      JSON.stringify(legacy),
    ]);
    await db.query(
      "INSERT INTO competition_question_sets VALUES('nbc-1448-2026','middle','[]'),('started','middle','[]')",
    );
    await db.query(
      "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES('existing','DEMO-existing','synthetic','masked','stage','الشرقية','الهفوف')",
    );
    await db.query(
      'INSERT INTO settings VALUES(\'site_content\',\'{"version":3,"heroIntro":"معرفة تُلهمنا. وانتماء يجمعنا."}\')',
    );
    await migrate(db);
    const service = new CompetitionService(db),
      c = await service.current();
    assert.deepEqual(c.questionCounts, meetingQuestionCounts);
    assert.equal(c.answerMode, 'final_submission');
    assert.equal(c.frozenAt, null);
    assert.deepEqual(c.eligibility!.cities['الشرقية'], easternCities);
    assert.equal(
      (await db.query('SELECT competition_id FROM competition_question_sets')).rows.length,
      1,
    );
    const kept = await service.current(db, 'started');
    assert.equal(kept.answerMode, undefined);
    assert.equal(questionCount(kept, 'university'), 20);
    assert.equal(kept.frozenAt, 'legacy');
    assert.equal(
      (await db.query<{ locality: string }>('SELECT locality FROM participants')).rows[0].locality,
      'الهفوف',
    );
    assert.match(
      JSON.stringify(
        (await db.query('SELECT value FROM settings WHERE id=$1', ['site_content'])).rows[0],
      ),
      /معرفة تُلهمنا، وانتماء يجمعنا/,
    );
    assert.ok(migrations.slice(0, 10).every((m) => migrationChecksum(m.sql).length === 64));
  } finally {
    await db.close();
  }
});
test('final-mode durable offline queue replays saved choices before submission, never reveals feedback early, and recovers from conflicts', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  const { db, service, questions } = await fixture();
  try {
    const student = { role: 'participant' as const, participant_id: 'university' },
      state = await service.start(student);
    const transport = {
      state: () => service.state(student),
      write: (e: WriteEvent) => service.write(student, e),
    };
    let display = state;
    const session = new DurableCompetitionSession('meeting-offline', transport, (r) => {
      display = r.state;
    });
    await session.init(state);
    for (const q of state.attempt!.questions)
      await session.enqueue(
        event(state, 'SELECT', q.id, questions.find((v) => v.id === q.id)!.correctAnswers),
      );
    await session.sync(true);
    assert.equal(session.record.events.length, 30);
    assert.deepEqual(display.attempt!.feedback, {});
    const restored = new DurableCompetitionSession('meeting-offline', transport, () => {});
    await restored.init(state);
    await restored.enqueue(event(state, 'SUBMIT'));
    await restored.sync();
    assert.equal(restored.record.events.length, 0);
    assert.equal(restored.record.state.attempt!.score, 30);
    assert.deepEqual(restored.record.state.attempt!.feedback, {});
    const otherStudent = { role: 'participant' as const, participant_id: 'middle' },
      other = await service.start(otherStudent),
      q = other.attempt!.questions[0];
    let conflictStatus = '';
    const conflicting = new DurableCompetitionSession(
      'meeting-conflict',
      { state: () => service.state(otherStudent), write: (e) => service.write(otherStudent, e) },
      (_record, status) => {
        conflictStatus = status;
      },
    );
    await conflicting.init(other);
    await conflicting.enqueue(event(other, 'SELECT', q.id, [0]));
    await service.write(otherStudent, event(other, 'SELECT', q.id, [1]));
    await conflicting.sync();
    assert.equal(conflicting.record.events.length, 0);
    assert.equal(conflicting.record.conflicts.length, 1);
    assert.deepEqual(conflicting.record.state.attempt!.answers[q.id].selected, [1]);
    assert.deepEqual(conflicting.record.state.attempt!.feedback, {});
    assert.equal(conflictStatus, 'error');
    await conflicting.enqueue(event(conflicting.record.state, 'SELECT', q.id, [0]));
    await conflicting.sync();
    assert.equal(conflictStatus, 'saved');
    assert.equal(conflicting.record.conflicts.length, 1);
    assert.deepEqual(conflicting.record.state.attempt!.answers[q.id].selected, [0]);
  } finally {
    await db.close();
  }
});
