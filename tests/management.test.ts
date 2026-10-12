import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import {
  registrationState,
  stageNames,
  type Competition,
  type Stage,
} from '../src/lib/competition-domain';
import { ParticipantAdmin } from '../src/lib/participant-admin';
import { CampaignHistory } from '../src/lib/campaigns';
import { BOOK_CHUNK_BYTES, BookStore } from '../src/lib/book-store';
import { defaultSiteContent, validateSiteContent } from '../src/lib/site-content';
import { identityLookup, normalizePhone } from '../src/lib/otp-crypto';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };
const editor = { role: 'editor' as const, participant_id: null, actor: 'editor-1' };
const reason = 'تصحيح موثق بطلب من المشارك بعد التحقق من هويته';

async function closed() {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  await migrate(db);
  await initializeCompetition(db);
  await db.query(
    `UPDATE competitions SET body = body || '{"state":"CLOSED","closedAt":"2026-10-01T00:00:00.000Z","closingPolicy":"immediate","graceMinutes":0,"leaderboardMode":"public_live"}'::jsonb WHERE id='nbc-1448-2026'`,
  );
  const service = new CompetitionService(db, () => Date.parse('2026-10-05T10:00:00Z'));
  let n = 100000;
  async function participant(name: string, stage: Stage, phone: string, identity: string) {
    const id = randomUUID();
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality,institution,gender) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        identityLookup(identity),
        name,
        normalizePhone(phone),
        stageNames[stage],
        'الشرقية',
        'الدمام',
        `مدرسة ${name}`,
        'ذكر',
      ],
    );
    return id;
  }
  async function attempt(participantId: string, stage: Stage, score: number, submitted = true) {
    n++;
    await db.query(
      `INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score,score,percentage,submitted_at,receipt) VALUES($1,$2,'nbc-1448-2026',$3,$4,'[]',20,$5,$6,$7,$8)`,
      [
        `att-${n}`,
        participantId,
        stage,
        String(n),
        submitted ? score : null,
        submitted ? (score / 20) * 100 : null,
        submitted ? new Date() : null,
        submitted ? `NBC-${n}` : null,
      ],
    );
    return `att-${n}`;
  }
  return { db, service, participant, attempt };
}

test('registration closes with the competition and can be paused; the per-phone limit has a default', () => {
  const base = { state: 'OPEN', closesAt: null, opensAt: null } as unknown as Competition;
  assert.deepEqual(registrationState(base), { open: true, reason: null, maxPerPhone: 3 });
  assert.equal(registrationState({ ...base, registrationPaused: true }).reason, 'paused');
  assert.equal(registrationState({ ...base, state: 'CLOSED' }).reason, 'closed');
  assert.equal(registrationState({ ...base, state: 'RESULTS_PUBLISHED' }).open, false);
  assert.equal(registrationState({ ...base, maxPerPhone: 1 }).maxPerPhone, 1);
  const past = { ...base, closesAt: '2026-01-01T00:00:00Z' };
  assert.equal(registrationState(past, Date.parse('2026-02-01T00:00:00Z')).reason, 'closed');
});

test('participants: search by name, phone and identity; edits need a reason and are audited without personal values', async () => {
  const { db, participant, attempt } = await closed();
  try {
    const admin_ = new ParticipantAdmin(db);
    const a = await participant('نورة أحمد العتيبي', 'middle', '0500000001', '1000000001');
    const b = await participant('خالد سعد القحطاني', 'highschool', '0500000002', '1000000002');
    await attempt(b, 'highschool', 12);
    assert.equal((await admin_.list(admin, {})).total, 2);
    assert.deepEqual(
      (await admin_.list(admin, { q: 'نورة' })).rows.map((r) => r.id),
      [a],
    );
    assert.deepEqual(
      (await admin_.list(admin, { q: '0500000002' })).rows.map((r) => r.id),
      [b],
    );
    assert.deepEqual(
      (await admin_.list(admin, { q: '1000000001' })).rows.map((r) => r.id),
      [a],
    );
    assert.equal((await admin_.list(admin, { q: '%' })).total, 0, 'wildcards are literal');
    assert.deepEqual(
      (await admin_.list(admin, { status: 'completed' })).rows.map((r) => r.id),
      [b],
    );
    assert.equal(
      (await admin_.list(admin, { q: 'نورة' })).rows[0].maskedPhone.includes('0000'),
      false,
    );
    await assert.rejects(admin_.list(editor, {}), /صلاحية/);

    await assert.rejects(
      admin_.update(admin, { id: a, changes: { name: 'اسم جديد كامل' } }),
      /سببًا/,
    );
    await assert.rejects(admin_.update(admin, { id: a, changes: {}, reason }), /تغييرات/);
    await assert.rejects(
      admin_.update(admin, { id: a, changes: { role: 'admin' }, reason }),
      /غير مسموح/,
    );
    await db.query(
      "INSERT INTO sessions(token,participant_id,role,expires_at,auth_source) VALUES('t',$1,'participant',now()+interval '1 hour','otp')",
      [a],
    );
    await admin_.update(admin, {
      id: a,
      reason,
      changes: { name: 'نورة بنت أحمد العتيبي', phone: '0555555555', identity: '1000000003' },
    });
    const row = (
      await db.query<{ name: string; phone: string; identity: string }>(
        'SELECT name,phone,identity FROM participants WHERE id=$1',
        [a],
      )
    ).rows[0];
    assert.equal(row.phone, '+966555555555');
    assert.equal(row.identity, identityLookup('1000000003'));
    assert.equal(
      (await db.query('SELECT 1 FROM sessions WHERE participant_id=$1', [a])).rows.length,
      0,
    );
    await assert.rejects(
      admin_.update(admin, { id: a, reason, changes: { identity: '1000000002' } }),
      /مشارك آخر/,
    );
    await assert.rejects(
      admin_.update(admin, { id: b, reason, changes: { stage: stageNames.middle } }),
      /المرحلة/,
    );
    const audit = (
      await db.query<{ detail: string }>(
        "SELECT detail FROM audit WHERE action='تعديل بيانات مشارك'",
      )
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].detail.includes('0555555555'), false);
    assert.equal(audit[0].detail.includes('1000000003'), false);
  } finally {
    await db.close();
  }
});

test('erasure deletes participants who never took part and anonymises those who did', async () => {
  const { db, participant, attempt } = await closed();
  try {
    const admin_ = new ParticipantAdmin(db);
    const empty = await participant('مشارك بلا محاولة', 'middle', '0500000011', '1000000011');
    const taken = await participant('مشارك لديه محاولة', 'middle', '0500000012', '1000000012');
    await attempt(taken, 'middle', 15);
    await assert.rejects(admin_.erase(admin, { id: empty }), /سببًا/);
    assert.deepEqual(await admin_.erase(admin, { id: empty, reason }), {
      ok: true,
      mode: 'deleted',
    });
    assert.equal(
      (await db.query('SELECT 1 FROM participants WHERE id=$1', [empty])).rows.length,
      0,
    );
    assert.deepEqual(await admin_.erase(admin, { id: taken, reason }), {
      ok: true,
      mode: 'anonymized',
    });
    const left = (
      await db.query<{
        name: string;
        phone: string;
        institution: string | null;
        erased_at: string;
      }>('SELECT name,phone,institution,erased_at FROM participants WHERE id=$1', [taken])
    ).rows[0];
    assert.equal(left.name, 'مشارك محذوف');
    assert.equal(left.institution, null);
    assert.ok(left.erased_at);
    assert.equal(
      (
        await db.query<{ score: number }>('SELECT score FROM attempts WHERE participant_id=$1', [
          taken,
        ])
      ).rows[0].score,
      15,
    );
    await assert.rejects(admin_.erase(admin, { id: taken, reason }), /بالفعل/);
    await assert.rejects(
      admin_.update(admin, { id: taken, reason, changes: { name: 'اسم جديد كامل' } }),
      /محذوفة/,
    );
    const audit = JSON.stringify((await db.query('SELECT detail FROM audit')).rows);
    assert.equal(audit.includes('مشارك لديه محاولة'), false);
  } finally {
    await db.close();
  }
});
test('erasure is refused while the winners announcement shows that participant by name', async () => {
  const { db, service, participant, attempt } = await closed();
  try {
    const id = await participant('فائز ظاهر الاسم', 'middle', '0500000021', '1000000021');
    const att = await attempt(id, 'middle', 20);
    await service.saveWinners(admin, {
      stage: 'middle',
      places: [att, null, null, null, null, null],
    });
    await service.publishWinners(admin, { showNames: true });
    await assert.rejects(new ParticipantAdmin(db).erase(admin, { id, reason }), /اسحب/);
    await service.withdrawWinners(admin);
    assert.equal((await new ParticipantAdmin(db).erase(admin, { id, reason })).mode, 'anonymized');
  } finally {
    await db.close();
  }
});

test('leaderboard is paged and ranked in SQL, with the participant own rank', async () => {
  const { db, service, participant, attempt } = await closed();
  try {
    const scores = [20, 18, 18, 15, 12];
    const numbers: string[] = [];
    for (const [i, score] of scores.entries()) {
      const id = await participant(`م${i}`, 'middle', `05000001${i}0`, `10000010${i}0`);
      numbers.push((await attempt(id, 'middle', score)).replace('att-', ''));
    }
    const first = await service.leaderboard(undefined, 'middle', { pageSize: 2 });
    assert.equal(first.total, 5);
    assert.deepEqual(
      first.entries.map((e) => e.rank),
      [1, 2],
    );
    const second = await service.leaderboard(undefined, 'middle', { pageSize: 2, page: 2 });
    assert.deepEqual(
      second.entries.map((e) => e.rank),
      [2, 4],
      'equal scores share a rank',
    );
    const mine = await service.leaderboard(undefined, 'middle', { pageSize: 2, me: numbers[4] });
    assert.equal(mine.mine?.rank, 5);
    assert.equal((await service.leaderboard(undefined, 'middle', { me: 'nobody' })).mine, null);
    assert.equal((await service.leaderboard(undefined, 'middle', { pageSize: 500 })).pageSize, 100);
    await db.query(`UPDATE competitions SET body = body || '{"leaderboardMode":"hidden"}'::jsonb`);
    await assert.rejects(service.leaderboard(undefined, 'middle'), /غير منشورة/);
  } finally {
    await db.close();
  }
});

test('campaign history lists every campaign and reads results after a new one is created', async () => {
  const { db, service, participant, attempt } = await closed();
  try {
    const id = await participant('م أول', 'middle', '0500000031', '1000000031');
    await attempt(id, 'middle', 17);
    const history = new CampaignHistory(db, () => Date.parse('2026-10-05T10:00:00Z'));
    await service.configure(admin, { action: 'create', title: 'حملة جديدة' });
    const list = await history.list(admin);
    assert.equal(list.length, 2);
    assert.equal(
      list.some((c) => c.id === 'legacy-demo'),
      false,
    );
    const old = list.find((c) => c.id === 'nbc-1448-2026')!;
    assert.equal(old.current, false);
    assert.equal(old.submitted, 1);
    const details = await history.results(admin, { id: old.id, stage: 'middle' });
    assert.equal(details.results.rows[0].name, 'م أول');
    assert.equal(details.stages.find((s) => s.stage === 'middle')?.average, 85);
    assert.equal((await history.participants(admin, old.id)).length, 1);
    await assert.rejects(history.results(admin, { id: 'missing' }), /غير موجودة/);
    await assert.rejects(history.list(editor), /صلاحية/);
    const status = await service.publicStatus();
    assert.equal(status.state, 'DRAFT');
    assert.equal(status.registration.open, true);
  } finally {
    await db.close();
  }
});

test('an uploaded book is chunked, verified, stored, served in parts and attached to a draft competition', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await initializeCompetition(db);
    const service = new CompetitionService(db);
    const store = new BookStore(db);
    const pdf = readFileSync('public/documents/national-belonging.pdf');
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    await assert.rejects(
      store.start(editor, { title: 'x', sizeBytes: pdf.length, sha256 }),
      /صلاحية/,
    );
    await assert.rejects(store.start(admin, { title: '', sizeBytes: pdf.length, sha256 }), /عنوان/);
    await assert.rejects(store.start(admin, { title: 'ك', sizeBytes: 10, sha256 }), /حجم/);
    const upload = await store.start(admin, {
      title: 'كتاب العام القادم',
      sizeBytes: pdf.length,
      sha256,
    });
    assert.equal(upload.parts, Math.ceil(pdf.length / BOOK_CHUNK_BYTES));
    await assert.rejects(store.finish(admin, upload.uploadId), /لم تكتمل/);
    await assert.rejects(store.chunk(admin, upload.uploadId, 0, Buffer.alloc(10)), /حجم الجزء/);
    for (let i = 0; i < upload.parts; i++)
      await store.chunk(
        admin,
        upload.uploadId,
        i,
        pdf.subarray(i * BOOK_CHUNK_BYTES, (i + 1) * BOOK_CHUNK_BYTES),
      );
    const book = await store.finish(admin, upload.uploadId);
    assert.equal(book.pageCount, 66);
    assert.equal(book.approved, false);
    assert.equal(book.parts, upload.parts);
    const joined = Buffer.concat(
      (await Promise.all(
        Array.from({ length: book.parts! }, (_, i) => store.part(book.sha256, i)),
      )) as Buffer[],
    );
    assert.equal(createHash('sha256').update(joined).digest('hex'), sha256);
    assert.equal(await store.part(book.sha256, book.parts!), null);
    assert.equal(await store.part('0'.repeat(64), 0), null);
    assert.equal(
      (await db.query('SELECT 1 FROM book_upload_chunks')).rows.length,
      0,
      'chunks are removed',
    );
    // The same file cannot be registered twice.
    const again = await store.start(admin, { title: 'نسخة', sizeBytes: pdf.length, sha256 });
    for (let i = 0; i < again.parts; i++)
      await store.chunk(
        admin,
        again.uploadId,
        i,
        pdf.subarray(i * BOOK_CHUNK_BYTES, (i + 1) * BOOK_CHUNK_BYTES),
      );
    await assert.rejects(store.finish(admin, again.uploadId), /مسجل/);

    // Wrong bytes and non-PDF content are refused.
    const bad = Buffer.alloc(2048, 7);
    const other = await store.start(admin, {
      title: 'ملف',
      sizeBytes: bad.length,
      sha256: createHash('sha256').update(bad).digest('hex'),
    });
    await store.chunk(admin, other.uploadId, 0, bad);
    await assert.rejects(store.finish(admin, other.uploadId), /PDF/);
    const wrong = await store.start(admin, {
      title: 'ملف',
      sizeBytes: bad.length,
      sha256: 'a'.repeat(64),
    });
    await store.chunk(admin, wrong.uploadId, 0, bad);
    await assert.rejects(store.finish(admin, wrong.uploadId), /بصمة/);

    // Attach to the draft competition; it can then be verified and approved like any book.
    const c = await service.current();
    await service.configure(admin, {
      action: 'set-book',
      version: c.version,
      bookVersionId: book.id,
    });
    assert.equal((await service.current()).bookVersionId, book.id);
    await service.verifyBook(book);
    await assert.rejects(
      service.verifyBook({ ...book, sha256: 'b'.repeat(64), url: `/books/${'b'.repeat(64)}.pdf` }),
      /مفقود/,
    );
    await assert.rejects(
      service.configure(admin, {
        action: 'set-book',
        version: (await service.current()).version,
        bookVersionId: 'nope',
      }),
      /غير موجودة/,
    );
    assert.equal((await service.admin(admin)).books.length, 2);
    await db.query(
      `UPDATE competitions SET body = body || '{"frozenAt":"2026-10-01T00:00:00Z"}'::jsonb`,
    );
    await assert.rejects(
      service.configure(admin, {
        action: 'set-book',
        version: (await service.current()).version,
        bookVersionId: 'national-belonging-ec07ef57',
      }),
      /بعد اعتماد/,
    );
  } finally {
    await db.close();
  }
});

test('site content is validated plain text with limits, and defaults cover every section', () => {
  const ok = { ...defaultSiteContent, version: 0 };
  assert.deepEqual(validateSiteContent(ok), ok);
  assert.ok(defaultSiteContent.faqs.length >= 5 && defaultSiteContent.rules.length >= 14);
  for (const patch of [
    { heroIntro: '' },
    { heroIntro: 'س'.repeat(301) },
    { aboutIntro: '   ' },
    { faqs: [{ q: '', a: 'جواب' }] },
    { faqs: 'no' },
    { rules: [''] },
    { bookTopics: Array(21).fill('محور') },
    { version: 'x' },
  ])
    assert.throws(
      () => validateSiteContent({ ...ok, ...patch }),
      `should reject ${JSON.stringify(patch).slice(0, 40)}`,
    );
  assert.equal(validateSiteContent({ ...ok, aboutDetails: '' }).aboutDetails, '');
});
