import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import { PrizeDrawService } from '../src/lib/prize-draw-service';
import { stageNames, type Stage } from '../src/lib/competition-domain';
import {
  assignResults,
  drawOrder,
  groupPool,
  poolFingerprint,
  poolText,
  prizeHolders,
  sha256Hex,
  verifyDraw,
  type HolderEntry,
} from '../src/lib/prize-draw';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };
const editor = { role: 'editor' as const, participant_id: null, actor: 'editor-1' };
const pool = (n: number) =>
  groupPool(Array.from({ length: n }, (_, i) => ({ number: String(100100 + i), key: `k${i}` })));

test('the pool text and fingerprint do not depend on input order', async () => {
  const a = pool(5);
  const b = [...a].reverse();
  assert.equal(poolText(a), poolText(b));
  assert.equal(await poolFingerprint(a), await poolFingerprint(b));
  assert.equal(poolText(a).split('\n')[0], '100100 100100');
});
test('numbers sharing a phone share a group named after the lowest number, and win once', async () => {
  const grouped = groupPool([
    { number: '300', key: 'x' },
    { number: '100', key: 'x' },
    { number: '200', key: 'y' },
  ]);
  assert.deepEqual(grouped, [
    { number: '100', group: '100' },
    { number: '200', group: '200' },
    { number: '300', group: '100' },
  ]);
  const seed = 'ab'.repeat(32);
  for (let i = 0; i < 20; i++) {
    const order = await drawOrder(grouped, seed + i, 'fp', 3);
    assert.equal(order.length, 2, 'only two phones, so only two prizes');
    assert.notEqual(order[0].group, order[1].group);
  }
});
test('the same pool and seed always give the same order; another seed gives another', async () => {
  const p = pool(40);
  const fp = await poolFingerprint(p);
  const one = await drawOrder(p, 'seed-a', fp, 9);
  const again = await drawOrder([...p].reverse(), 'seed-a', fp, 9);
  assert.deepEqual(one, again);
  assert.equal(new Set(one.map((e) => e.number)).size, 9);
  assert.notDeepEqual(await drawOrder(p, 'seed-b', fp, 9), one);
});
test('every position is roughly equally likely to win', async () => {
  const p = pool(5);
  const fp = await poolFingerprint(p);
  const wins = new Map<string, number>();
  const runs = 2500;
  for (let i = 0; i < runs; i++) {
    const [w] = await drawOrder(p, `s${i}`, fp, 1);
    wins.set(w.number, (wins.get(w.number) ?? 0) + 1);
  }
  const expected = runs / p.length;
  const chi = [...wins.values()].reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0);
  assert.equal(wins.size, 5);
  assert.ok(chi < 18.47, `chi-square ${chi.toFixed(2)} is above the 0.1% critical value for 4 df`);
});
test('a failed winner passes the prize to the next alternate, and a promotion never moves', () => {
  const entries: HolderEntry[] = assignResults(
    pool(6).map((e) => e),
    2,
  ).map((r) => ({ ...r, status: 'pending', decidedAt: null }));
  assert.deepEqual(prizeHolders(2, entries), [1, 2]);
  const set = (position: number, status: HolderEntry['status'], at: string) => {
    const e = entries.find((x) => x.position === position)!;
    e.status = status;
    e.decidedAt = at;
  };
  set(2, 'unreachable', '2026-10-06T10:00:00Z');
  assert.deepEqual(prizeHolders(2, entries), [1, 3], 'prize 2 goes to the first alternate');
  set(1, 'ineligible', '2026-10-06T11:00:00Z');
  assert.deepEqual(prizeHolders(2, entries), [4, 3], 'prize 1 takes the next one; prize 2 keeps 3');
  set(3, 'confirmed', '2026-10-06T12:00:00Z');
  set(4, 'unreachable', '2026-10-06T13:00:00Z');
  set(5, 'unreachable', '2026-10-06T14:00:00Z');
  set(6, 'unreachable', '2026-10-06T15:00:00Z');
  assert.deepEqual(prizeHolders(2, entries), [null, 3], 'alternates can run out');
});

async function closedCompetition() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  await db.query(
    `UPDATE competitions SET body = body || '{"state":"CLOSED","closedAt":"2026-10-01T00:00:00.000Z","closingPolicy":"immediate","graceMinutes":0}'::jsonb WHERE id='nbc-1448-2026'`,
  );
  const now = Date.parse('2026-10-05T10:00:00Z');
  const competitions = new CompetitionService(db, () => now);
  const draws = new PrizeDrawService(db, () => now);
  let n = 0;
  async function attempt(
    stage: Stage,
    score: number,
    options: { phone?: string; locality?: string; name?: string } = {},
  ) {
    const id = randomUUID();
    const number = String(400000 + ++n);
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality,institution) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        id,
        `DEMO-${id}`,
        options.name ?? `مشارك ${n} الاسم`,
        options.phone ?? `+96650000${String(n).padStart(4, '0')}`,
        stageNames[stage],
        'الشرقية',
        options.locality ?? 'الدمام',
        'مدرسة',
      ],
    );
    await db.query(
      `INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score,score,percentage,submitted_at,receipt) VALUES($1,$2,'nbc-1448-2026',$3,$4,'[]',20,$5,$6,now(),$7)`,
      [`att-${number}`, id, stage, number, score, (score / 20) * 100, `NBC-${number}`],
    );
    return { attemptId: `att-${number}`, number, participantId: id };
  }
  return { db, competitions, draws, attempt };
}

test('a draw freezes an eligible pool, commits a seed, draws verifiably and hands prizes to alternates', async () => {
  const { db, competitions, draws, attempt } = await closedCompetition();
  try {
    const top = await attempt('middle', 20);
    const people = [];
    for (let i = 0; i < 8; i++) people.push(await attempt('middle', 10 + i));
    const twin = await attempt('middle', 9, { phone: '+966500000002' }); // shares people[0]'s phone
    const outside = await attempt('middle', 12, { locality: 'الرياض' });
    const university = await attempt('university', 15);
    await assert.rejects(draws.state(editor), /صلاحية/);

    await assert.rejects(
      draws.freeze(admin, {
        stage: 'middle',
        prizes: ['جهاز لوحي'],
        alternates: 2,
        excludeRanked: true,
        excludeFlags: false,
      }),
      /احفظ قرار فائزي/,
      'ranked places must be decided before they can be excluded',
    );
    await competitions.saveWinners(admin, {
      stage: 'middle',
      places: [top.attemptId, null, null, null, null, null],
    });
    const preview = await draws.state(admin, { stage: 'middle', excludeRanked: true });
    assert.equal(preview.stats.submitted, 11);
    assert.equal(preview.stats.ranked, 1);
    assert.equal(preview.stats.outsideCities, 1);
    assert.equal(preview.stats.sharedPhones, 2);
    assert.equal(preview.stats.eligible, 9, 'minus the ranked winner and the outside city');

    const frozen = await draws.freeze(admin, {
      stage: 'middle',
      prizes: ['جهاز لوحي', 'قسيمة كتب'],
      alternates: 2,
      excludeRanked: true,
      excludeFlags: false,
    });
    const id = frozen.draw!.id;
    assert.equal(frozen.draw!.poolSize, 9);
    assert.equal(frozen.draw!.seedCommitment, null);
    const stored = (
      await db.query<{ pool: { number: string; group: string }[] }>('SELECT pool FROM prize_draws')
    ).rows[0].pool;
    assert.equal(
      stored.some(
        (e) =>
          e.number === top.number || e.number === outside.number || e.number === university.number,
      ),
      false,
    );
    assert.equal(JSON.stringify(stored).includes('+966'), false, 'no phone numbers in the pool');
    assert.equal(stored.find((e) => e.number === twin.number)!.group, people[0].number);
    await assert.rejects(
      draws.freeze(admin, {
        stage: 'all',
        prizes: ['x'],
        alternates: 0,
        excludeRanked: false,
        excludeFlags: false,
      }),
      /سحب قائم/,
    );
    await assert.rejects(draws.draw(admin, { id }), /ثبّت البذرة/);

    const committed = await draws.commit(admin, { id });
    assert.match(committed.draw!.seedCommitment!, /^[0-9a-f]{64}$/);
    assert.equal(committed.draw!.seed, null, 'the seed stays secret before the draw');
    await assert.rejects(draws.commit(admin, { id }), /من قبل/);
    await assert.rejects(draws.verificationFile(admin, id), /بعد إجراء السحب/);

    const drawn = await draws.draw(admin, { id });
    const view = drawn.draw!;
    assert.equal(view.entries.length, 6);
    assert.equal(await sha256Hex(view.seed!), view.seedCommitment);
    assert.deepEqual(view.holders, [1, 2]);
    assert.equal(view.entries[0].record.stage, 'middle');
    assert.ok(view.entries[0].record.phone?.startsWith('+966'));
    await assert.rejects(draws.draw(admin, { id }), /من قبل/);
    await assert.rejects(
      draws.cancel(admin, { id, reason: 'سبب إلغاء موثق من اللجنة' }),
      /لا يمكن إلغاء/,
    );

    const file = await draws.verificationFile(admin, id);
    assert.deepEqual(await verifyDraw(file), {
      poolMatches: true,
      seedMatches: true,
      resultsMatch: true,
    });
    assert.deepEqual(await verifyDraw({ ...file, results: [...file.results].reverse() }), {
      poolMatches: true,
      seedMatches: true,
      resultsMatch: false,
    });
    // The standalone witness script agrees, without the website's code.
    const dir = await mkdtemp(path.join(tmpdir(), 'nbc-draw-'));
    const proof = path.join(dir, 'draw.json');
    await writeFile(proof, JSON.stringify(file));
    assert.match(
      execFileSync(process.execPath, ['scripts/verify-draw.mjs', proof], { encoding: 'utf8' }),
      /PASS {2}Winners/,
    );
    await writeFile(proof, JSON.stringify({ ...file, seed: '00'.repeat(32) }));
    assert.throws(() =>
      execFileSync(process.execPath, ['scripts/verify-draw.mjs', proof], { stdio: 'pipe' }),
    );
    await rm(dir, { recursive: true, force: true });

    // Only the current holder's outcome can be recorded; a failure passes to the next alternate.
    await assert.rejects(
      draws.setStatus(admin, { id, position: 3, status: 'confirmed' }),
      /صاحب الجائزة الحالي/,
    );
    await assert.rejects(
      draws.setStatus(admin, { id, position: 1, status: 'ineligible', note: 'قصير' }),
      /15/,
    );
    let next = await draws.setStatus(admin, {
      id,
      position: 1,
      status: 'unreachable',
      note: 'ثلاث محاولات',
    });
    assert.deepEqual(next.draw!.holders, [3, 2]);
    await assert.rejects(
      draws.setStatus(admin, { id, position: 1, status: 'confirmed' }),
      /صاحب الجائزة الحالي/,
    );
    next = await draws.setStatus(admin, { id, position: 3, status: 'confirmed' });
    assert.equal(next.draw!.entries[2].status, 'confirmed');

    const screen = await draws.screen(admin);
    assert.equal(screen.phase, 'drawn');
    assert.equal(screen.winners.length, 2);
    assert.equal(
      JSON.stringify(screen).includes('+966'),
      false,
      'the projector never gets a phone',
    );
    assert.equal(screen.winners[0].firstName, 'مشارك');

    // The records are append-only.
    await assert.rejects(db.query('DELETE FROM prize_draw_entries'), /append-only/);
    await assert.rejects(db.query('DELETE FROM prize_draws'), /append-only/);
    await assert.rejects(db.query("UPDATE prize_draws SET seed='x'"), /once and in order/);
    await assert.rejects(db.query("UPDATE prize_draws SET pool='[]'"), /immutable/);
    await assert.rejects(
      db.query("UPDATE prize_draw_entries SET status='pending' WHERE position=3"),
      /once/,
    );

    // A second draw leaves out everyone holding a prize from the first, and their phones.
    const second = await draws.freeze(admin, {
      stage: 'middle',
      prizes: ['جائزة إضافية'],
      alternates: 0,
      excludeRanked: true,
      excludeFlags: false,
    });
    const holders = next.draw!.holders.map(
      (p) => next.draw!.entries.find((e) => e.position === p)!.participantNumber,
    );
    const secondPool = (
      await db.query<{ pool: { number: string }[] }>('SELECT pool FROM prize_draws WHERE id=$1', [
        second.draw!.id,
      ])
    ).rows[0].pool;
    assert.equal(
      secondPool.some((e) => holders.includes(e.number)),
      false,
    );
    assert.equal(second.stats.previousPrize >= 2, true);
    const cancelled = await draws.cancel(admin, {
      id: second.draw!.id,
      reason: 'تجربة إلغاء قبل تثبيت البذرة',
    });
    assert.equal(cancelled.draws.find((d) => d.id === second.draw!.id)!.cancelledAt !== null, true);
    await assert.rejects(draws.commit(admin, { id: second.draw!.id }), /أُلغي/);

    const actions = (await db.query<{ action: string }>('SELECT action FROM audit')).rows.map(
      (r) => r.action,
    );
    for (const action of [
      'تجميد قائمة السحب',
      'تثبيت بذرة السحب',
      'إجراء سحب الجوائز',
      'تحديث حالة فائز السحب',
      'إلغاء سحب الجوائز',
    ])
      assert.ok(actions.includes(action), action);
  } finally {
    await db.close();
  }
});
test('the draw waits for the competition to close', async () => {
  const { db, draws } = await closedCompetition();
  try {
    await db.query(
      `UPDATE competitions SET body = body || '{"state":"OPEN","closedAt":null,"closesAt":null}'::jsonb WHERE id='nbc-1448-2026'`,
    );
    const view = await draws.state(admin);
    assert.match(view.blocker, /أغلق المسابقة/);
    await assert.rejects(
      draws.freeze(admin, {
        stage: 'all',
        prizes: ['x'],
        alternates: 0,
        excludeRanked: false,
        excludeFlags: false,
      }),
      /أغلق المسابقة/,
    );
  } finally {
    await db.close();
  }
});
