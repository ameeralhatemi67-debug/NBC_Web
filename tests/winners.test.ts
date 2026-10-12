import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import { stageNames, type Stage } from '../src/lib/competition-domain';
import { defaultPrizes } from '../src/lib/prizes';
import { awardAmount, evaluateStage, reasonProblem } from '../src/lib/winners';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };
const editor = { role: 'editor' as const, participant_id: null, actor: 'editor-1' };
const rows = (...scores: number[]) =>
  scores.map((percentage, i) => ({ attemptId: `a${i + 1}`, percentage }));
const pad = (...ids: (string | null)[]) => [...ids, ...Array(6 - ids.length).fill(null)];

test('score order needs no reason; ties, skipped scores and reordering do', () => {
  const data = rows(100, 90, 90, 80, 70, 60, 50, 50);
  assert.equal(
    evaluateStage(data, pad('a1', 'a2')).needsReason,
    true,
    'a3 ties a2 at the boundary',
  );
  const clean = evaluateStage(
    rows(100, 90, 80, 70, 60, 50, 40),
    pad('a1', 'a2', 'a3', 'a4', 'a5', 'a6'),
  );
  assert.equal(clean.needsReason, false);
  assert.deepEqual(clean.errors, []);
  const tied = evaluateStage(data, pad('a1', 'a2', 'a3', 'a4', 'a5', 'a6'));
  assert.equal(tied.tieAmongWinners, true);
  assert.equal(tied.tieAtBoundary, false, 'the unplaced 50s are below the sixth place');
  const boundaryTie = evaluateStage(
    rows(100, 90, 80, 70, 60, 50, 50),
    pad('a1', 'a2', 'a3', 'a4', 'a5', 'a6'),
  );
  assert.equal(boundaryTie.tieAtBoundary, true, 'a7 ties the sixth place');
});
test('each tie, boundary tie, skipped higher score and reversed order is detected separately', () => {
  const data = rows(100, 90, 90, 80);
  const swapped = evaluateStage(data, pad('a2', 'a3', 'a1'));
  assert.equal(swapped.orderViolation, true);
  const skipped = evaluateStage(data, pad('a1', 'a4'));
  assert.equal(skipped.skippedHigher, true);
  const boundary = evaluateStage(data, pad('a1', 'a2'));
  assert.equal(boundary.tieAtBoundary, true);
  assert.equal(boundary.tieAmongWinners, false);
  const winnersTie = evaluateStage(data, pad('a1', 'a2', 'a3', 'a4'));
  assert.equal(winnersTie.tieAmongWinners, true);
  assert.equal(winnersTie.needsReason, true);
  assert.match(reasonProblem(winnersTie, 'قصير'), /15/);
  assert.equal(reasonProblem(winnersTie, 'قررت اللجنة الترتيب بعد المراجعة اليدوية'), '');
  assert.equal(reasonProblem(evaluateStage(rows(100, 90), pad('a1', 'a2')), ''), '');
});
test('invalid selections are rejected: duplicates, unknown attempts, gaps and wrong length', () => {
  const data = rows(100, 90, 80);
  assert.ok(evaluateStage(data, pad('a1', 'a1')).errors.length);
  assert.ok(evaluateStage(data, pad('a1', 'unknown')).errors.length);
  assert.ok(evaluateStage(data, pad('a1', null, 'a2')).errors.length);
  assert.ok(evaluateStage(data, ['a1']).errors.length);
  assert.deepEqual(evaluateStage(data, pad(null)).errors, []);
});
test('prize amounts come from the committee prize table', () => {
  assert.equal(awardAmount(defaultPrizes, 'middle', 1), 4000);
  assert.equal(awardAmount(defaultPrizes, 'university', 6), 2000);
  assert.equal(awardAmount(defaultPrizes, 'highschool', 7), 0);
});

async function closedCompetition() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  await db.query(
    `UPDATE competitions SET body = body || '{"state":"CLOSED","closedAt":"2026-10-01T00:00:00.000Z","closingPolicy":"immediate","graceMinutes":0}'::jsonb WHERE id='nbc-1448-2026'`,
  );
  let now = Date.parse('2026-10-05T10:00:00Z');
  const service = new CompetitionService(db, () => now);
  async function attempt(stage: Stage, name: string, score: number, number: string) {
    const id = randomUUID();
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality,institution) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, `DEMO-${id}`, name, 'masked', stageNames[stage], 'الشرقية', 'الدمام', `مدرسة ${name}`],
    );
    await db.query(
      `INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score,score,percentage,submitted_at,receipt) VALUES($1,$2,'nbc-1448-2026',$3,$4,'[]',20,$5,$6,now(),$7)`,
      [`att-${number}`, id, stage, number, score, (score / 20) * 100, `NBC-${number}`],
    );
    return `att-${number}`;
  }
  return { db, service, attempt, setNow: (t: number) => (now = t) };
}

test('committee selects winners per stage with documented tie decisions, then publishes a frozen announcement', async () => {
  const { db, service, attempt } = await closedCompetition();
  try {
    const a1 = await attempt('middle', 'أول', 20, '100001');
    const a2 = await attempt('middle', 'ثاني', 18, '100002');
    const a3 = await attempt('middle', 'ثالث', 18, '100003');
    const a4 = await attempt('middle', 'رابع', 15, '100004');
    const u1 = await attempt('university', 'جامعي', 19, '200001');
    const view = await service.winners(admin);
    assert.equal(view.blocker, '');
    assert.deepEqual(
      view.stages.map((s) => s.submitted),
      [4, 0, 1],
    );
    assert.equal(view.stages[0].candidates[0].attemptId, a1);
    assert.equal(view.stages[0].places[0].amount, 4000);
    await assert.rejects(service.winners(editor), /صلاحية/);

    // 18 and 18 tie for second: placing one of them needs a documented decision.
    await assert.rejects(
      service.saveWinners(admin, { stage: 'middle', places: [a1, a2, a4, null, null, null] }),
      /سبب/,
    );
    await assert.rejects(
      service.saveWinners(admin, { stage: 'middle', places: [a1, a1, null, null, null, null] }),
      /أكثر من مركز/,
    );
    await assert.rejects(
      service.saveWinners(admin, { stage: 'middle', places: [a1, u1, null, null, null, null] }),
      /غير موجود|غير مكتمل/,
      'an attempt from another stage is refused',
    );
    const saved = await service.saveWinners(admin, {
      stage: 'middle',
      places: [a1, a3, a2, a4, null, null],
      reason: 'تعادل في المركز الثاني حُسم بقرار اللجنة بعد المراجعة',
    });
    assert.deepEqual(
      saved.stages[0].places.map((p) => p.attemptId),
      [a1, a3, a2, a4, null, null],
    );
    assert.match(saved.stages[0].reason, /تعادل/);
    await assert.rejects(service.publishWinners(admin, { showNames: false }), /حدد فائزي/);
    await service.saveWinners(admin, {
      stage: 'university',
      places: [u1, null, null, null, null, null],
    });
    await service.saveMediaWinner(admin, { label: 'حساب إعلامي مميز' });
    // No highschool attempts exist, so that stage needs no winners.
    const quiet = await service.publishWinners(admin, { showNames: false });
    assert.ok(quiet.publication);
    const announcement = (await service.publicWinners())!;
    assert.equal(announcement.showNames, false);
    assert.equal(JSON.stringify(announcement).includes('ثاني'), false, 'names stay private');
    assert.equal(JSON.stringify(announcement).includes('مدرسة'), false);
    assert.deepEqual(
      announcement.stages[0].awards.map((a) => [a.place, a.amount, a.participantNumber]),
      [
        [1, 4000, '100001'],
        [2, 3000, '100003'],
        [3, 2000, '100002'],
        [4, 1000, '100004'],
      ],
    );
    assert.deepEqual(announcement.media, { label: 'حساب إعلامي مميز', amount: 2500 });

    // Locked while published; withdrawing reopens decisions; names can be shown on republish.
    await assert.rejects(
      service.saveWinners(admin, { stage: 'middle', places: [a1, null, null, null, null, null] }),
      /اسحب نشر/,
    );
    await assert.rejects(service.saveMediaWinner(admin, { label: 'آخر' }), /اسحب نشر/);
    await assert.rejects(
      service.creditInvalidQuestion(admin, { questionId: 'q', reason: 'سبب موثق من اللجنة' }),
      /اسحب نشر/,
    );
    await service.publishWinners(admin, { showNames: true });
    const named = (await service.publicWinners())!;
    assert.equal(named.stages[0].awards[1].name, 'ثالث');
    await service.withdrawWinners(admin);
    assert.equal(await service.publicWinners(), null);
    await assert.rejects(service.withdrawWinners(admin), /غير منشور/);
    await service.saveMediaWinner(admin, { label: '' });
    assert.equal((await service.winners(admin)).media.label, '');
    const audit = (await db.query<{ action: string }>('SELECT action FROM audit')).rows.map(
      (r) => r.action,
    );
    for (const action of ['اختيار فائزي المرحلة', 'نشر إعلان الفائزين', 'سحب إعلان الفائزين'])
      assert.ok(audit.includes(action), action);
  } finally {
    await db.close();
  }
});
test('winners cannot be chosen before the competition closes or while synchronization grace runs', async () => {
  const { db, service, attempt, setNow } = await closedCompetition();
  try {
    const a1 = await attempt('middle', 'أول', 20, '100001');
    await db.query(
      `UPDATE competitions SET body = body || '{"closingPolicy":"grace","graceMinutes":60,"closedAt":"2026-10-05T09:30:00.000Z"}'::jsonb WHERE id='nbc-1448-2026'`,
    );
    const waiting = await service.winners(admin);
    assert.match(waiting.blocker, /مهلة المزامنة/);
    await assert.rejects(
      service.saveWinners(admin, { stage: 'middle', places: pad(a1) }),
      /مهلة المزامنة/,
    );
    setNow(Date.parse('2026-10-05T10:31:00Z'));
    assert.equal((await service.winners(admin)).blocker, '');
    await db.query(
      `UPDATE competitions SET body = body || '{"state":"OPEN","closedAt":null,"closesAt":null}'::jsonb WHERE id='nbc-1448-2026'`,
    );
    await assert.rejects(service.saveWinners(admin, { stage: 'middle', places: pad(a1) }), /أغلق/);
  } finally {
    await db.close();
  }
});
