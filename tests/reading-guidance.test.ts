import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import {
  CompetitionService,
  initializeCompetition,
  snapshotQuestions,
} from '../src/lib/competition-service';
import { AnalyticsService } from '../src/lib/analytics-service';
import { summarizeGuidance } from '../src/lib/analytics-insights';
import { competitionFixtures } from '../src/lib/competition-fixtures';
import { orderByPage, type CompetitionState, type WriteEvent } from '../src/lib/competition-domain';
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

test('book order sorts by source page, puts organizer questions last and still shuffles options', () => {
  const bank = competitionFixtures.filter((q) => q.stage === 'middle');
  const withOfficial = [
    { ...bank[0], id: 'official-1', pdfPage: null, pdfPageEnd: undefined },
    ...bank.slice(1),
  ];
  const pages = (list: { pdfPage: number | null }[]) =>
    list.map((q) => (q.pdfPage === null ? Infinity : q.pdfPage));
  const sorted = orderByPage(withOfficial);
  assert.deepEqual(
    pages(sorted),
    [...pages(withOfficial)].sort((a, b) => a - b),
  );
  assert.equal(sorted.at(-1)!.id, 'official-1');
  for (let i = 0; i < 5; i++) {
    const snap = snapshotQuestions(bank, 'page');
    assert.deepEqual(
      pages(snap),
      [...pages(bank)].sort((a, b) => a - b),
    );
    for (const q of snap) {
      const original = bank.find((b) => b.id === q.id)!;
      assert.deepEqual(
        q.correctAnswers.map((i) => q.options[i]).sort(),
        original.correctAnswers.map((i) => original.options[i]).sort(),
      );
    }
  }
});

test('question order is a campaign setting, locked once open, and selectable per rehearsal', async () => {
  const { db, service } = await fixture();
  try {
    let c = await service.current();
    const settings = (questionOrder: unknown) =>
      service.configure(admin, {
        ...c,
        action: 'settings',
        version: c.version,
        questionOrder,
      });
    await assert.rejects(settings('alphabetical'), /ترتيب الأسئلة/);
    await settings('page');
    c = await service.current();
    assert.equal(c.questionOrder, 'page');
    assert.equal((await service.publicStatus()).questionOrder, 'page');
    const pages = (state: CompetitionState) =>
      state.attempt!.questions.map((q) => (q.pdfPage === null ? Infinity : q.pdfPage));
    const inOrder = (list: number[]) => list.every((p, i) => !i || list[i - 1] <= p);
    const byCampaign = await service.startTest(admin, { stage: 'middle' });
    assert.equal(byCampaign.competition.questionOrder, 'page');
    assert.ok(inOrder(pages(byCampaign)));
    const reset = await service.resetTest(admin, byCampaign.attempt!.id);
    assert.equal(reset.competition.questionOrder, 'page');
    const random = await service.startTest(admin, { stage: 'middle', order: 'random' });
    assert.equal(random.competition.questionOrder, 'random');
    await service.configure(admin, { action: 'freeze', version: c.version });
    c = await service.current();
    await service.configure(admin, { action: 'open', version: c.version });
    c = await service.current();
    await assert.rejects(settings('random'), /بعد فتح المسابقة/);
    await settings('page');
  } finally {
    await db.close();
  }
});

test('guidance events are recorded per attempt and summarized for the committee', async () => {
  const { db, service } = await fixture();
  try {
    const state = await service.startTest(admin, { stage: 'middle', city: 'الخبر' });
    const [first, second] = state.attempt!.questions;
    const guide = (questionId: string, gap: string, clientEventId = randomUUID()) =>
      service.recordGuide(
        admin,
        { attemptId: state.attempt!.id, clientEventId, questionId, gap },
        true,
      );
    const repeated = randomUUID();
    await guide(first.id, 'unreached', repeated);
    await guide(first.id, 'unreached', repeated); // A retried request is counted once.
    await guide(first.id, 'too-fast');
    await guide(second.id, 'skipped');
    await assert.rejects(guide('not-a-question', 'unreached'), /غير موجود/);
    await assert.rejects(guide(first.id, 'bored'), /غير صالح/);
    await assert.rejects(
      service.recordGuide(
        { ...admin, actor: 'someone-else' },
        {
          attemptId: state.attempt!.id,
          clientEventId: randomUUID(),
          questionId: first.id,
          gap: 'unreached',
        },
        true,
      ),
      /غير متاحة/,
    );
    const data = await new AnalyticsService(db).insights(admin);
    const tests = summarizeGuidance(data.guidance?.tests, 'middle');
    assert.equal(tests.events, 3);
    assert.equal(tests.guided, 1);
    assert.equal(tests.started.valueOf(), 1);
    assert.deepEqual(tests.questions[0], {
      questionId: first.id,
      title: first.title,
      events: 2,
      attempts: 1,
      gaps: { unreached: 1, 'too-fast': 1 },
    });
    assert.equal(tests.people[0].city, 'الخبر');
    assert.equal(tests.people[0].questions, 2);
    assert.equal(summarizeGuidance(data.guidance?.participants, 'middle').events, 0);
  } finally {
    await db.close();
  }
});
