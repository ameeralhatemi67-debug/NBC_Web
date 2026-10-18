import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { initializeCompetition } from '../src/lib/competition-service';
import { AnalyticsService } from '../src/lib/analytics-service';
import { stageNames } from '../src/lib/competition-domain';
import type { AnalyticsParticipant } from '../src/lib/analytics';
import {
  biggestLoss,
  cityPerformance,
  cleanSource,
  dropOff,
  itemVerdict,
  joinInsights,
  participationFunnel,
  pearson,
  pointBiserial,
  registrationHeat,
  reviewSignals,
  sourceAttribution,
  stageCityMatrix,
  type InsightRow,
} from '../src/lib/analytics-insights';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };
const editor = { role: 'editor' as const, participant_id: null, actor: 'editor-1' };
let n = 0;
function person(over: Partial<AnalyticsParticipant> = {}): AnalyticsParticipant {
  n++;
  return {
    id: `p${n}`,
    name: `مشارك ${n}`,
    stage: 'المرحلة المتوسطة',
    institution: null,
    gender: null,
    region: 'الشرقية',
    locality: 'الدمام',
    score: null,
    max_score: 20,
    submitted_at: null,
    attempt_id: null,
    created_at: '2026-10-11T18:30:00Z',
    ...over,
  };
}
const done = (score: number, over: Partial<AnalyticsParticipant> = {}) =>
  person({
    attempt_id: `a${n + 1}`,
    score,
    submitted_at: '2026-10-12T10:00:00Z',
    attempt_started_at: '2026-10-12T09:30:00Z',
    ...over,
  });
const insight = (
  id: string,
  attempt: Partial<NonNullable<InsightRow['attempt']>> | null,
  over: Partial<InsightRow> = {},
): InsightRow => ({
  id,
  source: null,
  sharedPhone: false,
  attempt: attempt && {
    readSeconds: 0,
    readEvents: 0,
    answered: 0,
    furthest: 0,
    questionCount: 20,
    recovered: false,
    ...attempt,
  },
  ...over,
});

test('link codes are normalised and anything unsafe is dropped', () => {
  assert.equal(cleanSource(' X-Launch_1 '), 'x-launch_1');
  for (const bad of ['', '-x', 'a b', '<script>', 'x'.repeat(41), 7, null])
    assert.equal(cleanSource(bad), null);
});

test('funnel, drop-off and biggest loss follow the attempts', () => {
  const people = [
    person(),
    person(),
    person({ attempt_id: 'x1' }),
    person({ attempt_id: 'x2' }),
    done(18),
    done(10),
  ];
  const rows = joinInsights(people, [
    insight(people[2].id, { readEvents: 3, answered: 0, furthest: 0 }),
    insight(people[3].id, { readEvents: 2, answered: 7, furthest: 9 }),
    insight(people[4].id, { readEvents: 9, answered: 20, furthest: 20 }),
    insight(people[5].id, { readEvents: 1, answered: 20, furthest: 20 }),
  ]);
  const funnel = participationFunnel(rows);
  assert.deepEqual(
    funnel.map((s) => s.count),
    [6, 4, 4, 3, 2],
  );
  assert.equal(funnel[1].fromPrevious, (4 / 6) * 100);
  assert.deepEqual(biggestLoss(funnel), { from: 'سجّلوا', to: 'بدأوا المحاولة', lost: 2 });
  const drop = dropOff(rows, 'المرحلة المتوسطة');
  assert.equal(drop.total, 2);
  assert.equal(drop.bins[0].count, 1, 'one stopped before answering');
  assert.equal(drop.bins[9].count, 1);
  assert.equal(drop.peak, 9);
});

test('registration heat uses Riyadh weekday and hour', () => {
  // 2026-10-11 is a Sunday; 18:30 UTC is 21:30 in Riyadh.
  const heat = registrationHeat([
    person(),
    person(),
    person({ created_at: '2026-10-16T05:00:00Z' }),
  ]);
  assert.equal(heat.grid[0][21], 2);
  assert.equal(heat.grid[5][8], 1, 'Friday 08:00 Riyadh');
  assert.deepEqual(heat.peak, { day: 0, hour: 21, count: 2 });
});

test('groups under five never get a rate', () => {
  const people = [
    ...Array.from({ length: 6 }, (_, i) => (i < 3 ? done(16) : person())),
    done(20, { locality: 'الخفجي' }),
    person({ locality: 'الخفجي', stage: 'المرحلة الثانوية' }),
  ];
  const cities = cityPerformance(people);
  assert.equal(cities[0].city, 'الدمام');
  assert.equal(cities[0].completion, 50);
  assert.equal(cities[0].average, 80);
  assert.equal(cities[1].small, true);
  assert.equal(cities[1].completion, null);
  const matrix = stageCityMatrix(people, ['المرحلة المتوسطة', 'المرحلة الثانوية']);
  assert.equal(matrix.cells[0][0].rate, 50);
  assert.equal(matrix.cells[1][0].small, true);
  assert.equal(matrix.cells[1][0].rate, null);
  assert.equal(matrix.cells[0][1].total, 0);
  const sources = sourceAttribution(
    joinInsights(
      people,
      people.map((p, i) => insight(p.id, null, { source: i < 5 ? 'x-launch' : null })),
    ),
  );
  assert.equal(sources[0].source, 'x-launch');
  assert.equal(sources[0].completion, 60);
  assert.equal(sources[1].source, '', 'direct arrivals come last');
  assert.equal(sources[1].small, true);
});

test('statistics: pearson, point-biserial and question verdicts', () => {
  assert.equal(
    pearson([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]),
    1,
  );
  assert.equal(
    pearson([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]),
    null,
  );
  assert.equal(pointBiserial(80, 40, 20, 0.5), 1);
  assert.equal(pointBiserial(80, null, 20, 1), null);
  const item = {
    questionId: 'q',
    title: '',
    topic: '',
    n: 30,
    correct: 15,
    difficulty: 50,
    discrimination: 0.1,
  };
  assert.equal(itemVerdict(item), 'review');
  assert.equal(itemVerdict({ ...item, discrimination: 0.4 }), 'ok');
  assert.equal(itemVerdict({ ...item, discrimination: 0.4, difficulty: 98 }), 'easy');
  assert.equal(itemVerdict({ ...item, n: 3 }), 'small');
});

test('review signals count each concern within the selected group', () => {
  const quick = done(19, {
    attempt_started_at: '2026-10-12T09:58:00Z',
    reading_flags: ['rapid_answers'],
  });
  const people = [
    done(10),
    done(12),
    done(14),
    quick,
    person({ attempt_id: 'z', reading_flags: ['page_jump'] }),
  ];
  const rows = joinInsights(people, [
    insight(people[0].id, { readSeconds: 600 }, { sharedPhone: true }),
    insight(people[1].id, { readSeconds: 900, recovered: true }),
    insight(people[2].id, { readSeconds: 700 }),
    insight(quick.id, { readSeconds: 20 }),
  ]);
  const signals = Object.fromEntries(reviewSignals(rows).map((s) => [s.key, s.count]));
  assert.deepEqual(signals, { reading: 1, rapid: 1, fast: 1, unread: 1, phone: 1, recovered: 1 });
});

test('the analytics service reports reading, progress, question health and code delivery', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await initializeCompetition(db);
    const questions = Array.from({ length: 4 }, (_, i) => ({
      id: `q${i}`,
      title: `سؤال ${i}`,
      topic: 't',
      correctAnswers: [i % 2],
    }));
    async function attempt(
      i: number,
      answers: (number | null)[],
      submitted: boolean,
      phone = `+96650000${String(i).padStart(4, '0')}`,
    ) {
      const pid = randomUUID();
      await db.query(
        "INSERT INTO participants(id,identity,name,phone,stage,region,locality,source) VALUES($1,$2,$3,$4,$5,'الشرقية','الدمام',$6)",
        [pid, `DEMO-${pid}`, `مشارك ${i}`, phone, stageNames.middle, i % 2 ? 'x-launch' : null],
      );
      const correct = answers.filter((a, q) => a === questions[q].correctAnswers[0]).length;
      await db.query(
        `INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score,score,percentage,submitted_at,receipt) VALUES($1,$2,'nbc-1448-2026','middle',$3,$4,4,$5,$6,$7,$8)`,
        [
          `att${i}`,
          pid,
          String(700000 + i),
          JSON.stringify(questions),
          submitted ? correct : null,
          submitted ? correct * 25 : null,
          submitted ? new Date() : null,
          submitted ? `R${i}` : null,
        ],
      );
      for (const [q, question] of questions.entries()) {
        await db.query(
          'INSERT INTO attempt_questions(attempt_id,question_id,ordinal,snapshot) VALUES($1,$2,$3,$4)',
          [`att${i}`, question.id, q, JSON.stringify(question)],
        );
        if (answers[q] !== null)
          await db.query(
            'INSERT INTO attempt_answers(attempt_id,question_id,selected) VALUES($1,$2,$3)',
            [`att${i}`, question.id, JSON.stringify([answers[q]])],
          );
      }
      await db.query(
        'INSERT INTO attempt_events(attempt_id,client_event_id,payload) VALUES($1,$2,$3)',
        [`att${i}`, `r${i}`, JSON.stringify({ kind: 'READ', page: 1, creditedSeconds: 30 * i })],
      );
      return pid;
    }
    // q0 follows the total score; only a weaker attempt answers q3 right.
    const pids = [
      await attempt(1, [0, 1, 0, 0], true, '+966500000005'),
      await attempt(2, [0, 1, 0, 0], true),
      await attempt(3, [0, 1, 1, 0], true),
      await attempt(4, [1, 0, 1, 0], true),
      await attempt(5, [1, 0, 1, 1], true),
      await attempt(6, [0, 1, null, null], false),
    ];
    await db.query(
      "INSERT INTO otp_challenges(id,purpose,phone_e164,phone_hash,provider,expires_at,request_ip_hash,state,config_fingerprint) VALUES('c1','REGISTER','+966','h','mock',now(),'i','FAILED','f'),('c2','LOGIN','+966','h','mock',now(),'i','SENT','f'),('c3','ADMIN_TEST','+966','h','mock',now(),'i','FAILED','f')",
    );
    await assert.rejects(new AnalyticsService(db).insights(editor), /صلاحية/);
    const data = await new AnalyticsService(db).insights(admin);
    const row = (id: string) => data.rows.find((r) => r.id === id)!;
    assert.equal(row(pids[0]).source, 'x-launch');
    assert.equal(row(pids[0]).sharedPhone, true, 'participants 1 and 5 share a phone');
    assert.equal(row(pids[1]).sharedPhone, false);
    assert.deepEqual(row(pids[5]).attempt, {
      readSeconds: 180,
      readEvents: 1,
      answered: 2,
      furthest: 2,
      questionCount: 4,
      recovered: false,
    });
    const middle = data.items.middle;
    assert.equal(middle.submitted, 5);
    const q = Object.fromEntries(middle.items.map((i) => [i.questionId, i]));
    assert.equal(q.q0.correct, 3);
    assert.equal(q.q0.difficulty, 60);
    // Totals are 75, 75, 50, 0 and 25: q0 separates strong from weak, q3 runs backwards.
    assert.ok(q.q0.discrimination! > 0.8, 'q0 separates strong from weak');
    assert.ok(q.q3.discrimination! < 0, 'only the weaker attempt answered q3 right');
    assert.equal(middle.items[0].questionId, 'q3', 'weakest question is listed first');
    assert.deepEqual(
      data.otp.hours.map((h) => [h.sent, h.failed]),
      [[2, 1]],
      'admin tests are not counted',
    );
  } finally {
    await db.close();
  }
});
