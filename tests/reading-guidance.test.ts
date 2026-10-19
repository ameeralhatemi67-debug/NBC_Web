import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import { competitionFixtures } from '../src/lib/competition-fixtures';
import type { CompetitionState, WriteEvent } from '../src/lib/competition-domain';
import {
  furthestPageRead,
  nextUnreadSourcePage,
  readingGap,
  sourceReadingShare,
} from '../src/lib/reading-progress';

const admin = { role: 'admin' as const, participant_id: null, actor: 'guidance-test' };

test('reading guidance names the broken rule and measures the source-page credit', () => {
  const q = { pdfPage: 10, pdfPageEnd: undefined };
  assert.equal(readingGap({ pageSeconds: {} }, q, 1), 'unreached');
  assert.equal(readingGap({ pageSeconds: { 3: 4 } }, q, 3), 'unreached');
  // Flicked past the source page: it was seen but earned too little reading time.
  assert.equal(readingGap({ pageSeconds: { 9: 0, 10: 1, 11: 0 } }, q, 11), 'too-fast');
  // Jumped to the end without ever showing the source page.
  assert.equal(readingGap({ pageSeconds: { 1: 0, 66: 30 } }, q, 66), 'skipped');
  assert.equal(readingGap({ pageSeconds: {} }, q, 40), 'skipped');
  assert.equal(readingGap({ pageSeconds: { 10: 5 } }, q, 10), null);
  assert.equal(readingGap(undefined, { pdfPage: null }), null);
  const range = { pdfPage: 10, pdfPageEnd: 11 };
  assert.equal(sourceReadingShare({ pageSeconds: { 10: 5, 11: 2.5 } }, range), 0.75);
  assert.equal(nextUnreadSourcePage({ pageSeconds: { 10: 5, 11: 2.5 } }, range), 11);
  assert.equal(nextUnreadSourcePage({ pageSeconds: { 10: 5, 11: 5 } }, range), null);
  assert.equal(nextUnreadSourcePage(undefined, range), 10);
  assert.equal(sourceReadingShare({ pageSeconds: { 10: 9, 11: 9 } }, range), 1);
  assert.equal(sourceReadingShare(undefined, { pdfPage: null }), 1);
  assert.equal(furthestPageRead({ pageSeconds: { 3: 1, 27: 0 } }), 27);
  assert.equal(furthestPageRead(undefined), 0);
});

async function fixture() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  await db.query(
    'UPDATE competitions SET body=(body - \'questionCounts\') || \'{"answerMode":"final_submission","leaderboardMode":"publish_after_close"}\'::jsonb WHERE id=\'nbc-1448-2026\'',
  );
  if (db.kind === 'pglite')
    await db.query(
      "UPDATE questions SET body=jsonb_set(body,'{active}','false') WHERE id ~ '-demo(2[1-9]|30)$'",
    );
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
  const service = new CompetitionService(db, () => Date.parse('2026-10-04T10:00:00Z'));
  return { db, service };
}
const event = (
  state: CompetitionState,
  kind: WriteEvent['kind'],
  questionId?: string,
  selected?: number[],
) => ({
  clientEventId: randomUUID(),
  attemptId: state.attempt!.id,
  revision: state.attempt!.revision,
  kind,
  questionId,
  selected,
});

test('a submitted participant sees only their own stage and city rank, never other entries', async () => {
  const { db, service } = await fixture();
  try {
    const people = [
      { id: 'p-dammam-1', city: 'الدمام', right: 20 },
      { id: 'p-dammam-2', city: 'الدمام', right: 10 },
      { id: 'p-khobar-1', city: 'الخبر', right: 15 },
    ];
    for (const p of people)
      await db.query(
        "INSERT INTO participants(id,identity,name,phone,stage,region,locality) VALUES($1,$2,'synthetic','masked','middle','الشرقية',$3)",
        [p.id, `ID-${p.id}`, p.city],
      );
    const c = await service.current();
    await service.configure(admin, { action: 'freeze', version: c.version });
    await service.configure(admin, { action: 'open', version: c.version + 1 });
    const student = (id: string) => ({ role: 'participant' as const, participant_id: id });
    await assert.rejects(service.standing(student('p-dammam-1')), /لم تُرسل/);
    for (const p of people) {
      let state = await service.start(student(p.id));
      const keys = (
        await db.query<{ questions: typeof competitionFixtures }>(
          'SELECT questions FROM attempts WHERE id=$1',
          [state.attempt!.id],
        )
      ).rows[0].questions;
      for (const [i, q] of keys.entries()) {
        const wrong = q.options.findIndex((_, n) => !q.correctAnswers.includes(n));
        state = await service.write(
          student(p.id),
          event(state, 'SELECT', q.id, i < p.right ? q.correctAnswers : [wrong]),
        );
      }
      state = await service.write(student(p.id), event(state, 'SUBMIT'));
      assert.deepEqual(state.attempt!.feedback, {});
      assert.deepEqual(state.attempt!.questions, []);
    }
    const second = await service.standing(student('p-dammam-2'));
    assert.deepEqual(second, {
      stage: 'middle',
      overall: { rank: 3, total: 3 },
      city: { name: 'الدمام', rank: 2, total: 2 },
    });
    const khobar = await service.standing(student('p-khobar-1'));
    assert.deepEqual(khobar?.overall, { rank: 2, total: 3 });
    assert.deepEqual(khobar?.city, { name: 'الخبر', rank: 1, total: 1 });
    await db.query(
      "UPDATE competitions SET body=jsonb_set(body,'{leaderboardMode}','\"hidden\"') WHERE id='nbc-1448-2026'",
    );
    assert.equal(await service.standing(student('p-khobar-1')), null);
  } finally {
    await db.close();
  }
});

test('rehearsal standing ranks the administrator runs by chosen test city', async () => {
  const { db, service } = await fixture();
  try {
    const run = async (city: string, right: number) => {
      let state = await service.startTest(admin, { stage: 'middle', city });
      const keys = (
        await db.query<{ questions: typeof competitionFixtures }>(
          'SELECT questions FROM admin_test_runs WHERE id=$1',
          [state.attempt!.id],
        )
      ).rows[0].questions;
      for (const [i, q] of keys.entries()) {
        const wrong = q.options.findIndex((_, n) => !q.correctAnswers.includes(n));
        state = await service.write(
          admin,
          event(state, 'SELECT', q.id, i < right ? q.correctAnswers : [wrong]),
          true,
        );
      }
      await service.write(admin, event(state, 'SUBMIT'), true);
      return state.attempt!.id;
    };
    const top = await run('الدمام', 18);
    const low = await run('الخبر', 5);
    await assert.rejects(
      service.testStanding(
        admin,
        (await service.startTest(admin, { stage: 'middle' })).attempt!.id,
      ),
      /لم تُرسل/,
    );
    assert.deepEqual(await service.testStanding(admin, low), {
      stage: 'middle',
      overall: { rank: 2, total: 2 },
      city: { name: 'الخبر', rank: 1, total: 1 },
    });
    assert.equal((await service.testStanding(admin, top)).overall.rank, 1);
    await assert.rejects(
      service.testStanding({ ...admin, actor: 'someone-else' }, top),
      /غير موجودة/,
    );
  } finally {
    await db.close();
  }
});
