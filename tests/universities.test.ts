import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { disposableDatabase } from './database-fixture';
import type { Database } from '../src/lib/database';
import { migrate } from '../src/lib/migrations';
import { initializeCompetition } from '../src/lib/competition-service';
import { authenticateParticipant } from '../src/lib/participant-auth';
import { OtpService } from '../src/lib/otp';
import type { OtpProvider } from '../src/lib/otp-provider';
import { saveSetup } from '../src/lib/otp-readiness';
import { ParticipantAdmin } from '../src/lib/participant-admin';
import { UniversityAdmin, listUniversities, universityStudentId } from '../src/lib/universities';
import { OTHER_UNIVERSITY } from '../src/lib/content';
import { AppError } from '../src/lib/domain';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };
const editor = { role: 'editor' as const, participant_id: null, actor: 'editor-1' };
const university = 'المرحلة الجامعية';

const form = (n = 1, extra: Record<string, unknown> = {}) => ({
  mode: 'register',
  identity: `1${String(n).padStart(9, '0')}`,
  phone: `055111${String(n).padStart(4, '0')}`,
  name: 'طالب جامعي اختبار تسجيل',
  stage: university,
  gender: 'ذكر',
  locality: 'الدمام',
  terms: true,
  ...extra,
});
type Stored = {
  stage: string;
  institution: string | null;
  university_ref: string | null;
  university_student_id: string | null;
};
const stored = async (db: Database) =>
  (
    await db.query<Stored>(
      'SELECT stage,institution,university_ref,university_student_id FROM participants ORDER BY created_at',
    )
  ).rows;
const invalid = (promise: Promise<unknown>) => assert.rejects(promise, AppError);

async function fixture(run: (db: Database) => Promise<void>) {
  const keys = ['NBC_RUNTIME_MODE', 'NBC_OTP_ENABLED', 'IDENTITY_LOOKUP_SECRET', 'OTP_PROVIDER'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.NBC_RUNTIME_MODE = 'test';
  process.env.NBC_OTP_ENABLED = 'false';
  process.env.IDENTITY_LOOKUP_SECRET = randomBytes(32).toString('hex');
  process.env.OTP_PROVIDER = 'fake';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await initializeCompetition(db);
    await run(db);
  } finally {
    await db.close();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('the migration seeds the list and the list is served in the committee order', async () => {
  await fixture(async (db) => {
    const list = await listUniversities(db);
    assert.ok(list.length >= 30);
    assert.equal(list[0].name, 'جامعة الإمام عبدالرحمن بن فيصل');
    assert.ok(list.some((u) => u.name === 'جامعة الملك فهد للبترول والمعادن'));
    assert.ok(list.every((u) => u.id !== OTHER_UNIVERSITY));
  });
});

test('a university student registers with a listed university and a university ID', async () => {
  await fixture(async (db) => {
    const [first] = await listUniversities(db);
    await authenticateParticipant(
      db,
      form(1, {
        universityId: first.id,
        universityStudentId: ' ٢٢١٠٠١٢٣٤٥ ',
        institution: 'مدرسة',
      }),
      '10.0.0.1',
    );
    assert.deepEqual(await stored(db), [
      {
        stage: university,
        institution: first.name,
        university_ref: first.id,
        university_student_id: '2210012345',
      },
    ]);
  });
});

test('«أخرى» stores the typed university name and no list reference', async () => {
  await fixture(async (db) => {
    await authenticateParticipant(
      db,
      form(2, {
        universityId: OTHER_UNIVERSITY,
        institution: '  كلية   الخليج  التقنية ',
        universityStudentId: 'S-20240017',
      }),
      '10.0.0.2',
    );
    assert.deepEqual(await stored(db), [
      {
        stage: university,
        institution: 'كلية الخليج التقنية',
        university_ref: null,
        university_student_id: 'S-20240017',
      },
    ]);
  });
});

test('a university registration without a valid university choice or ID is rejected whole', async () => {
  await fixture(async (db) => {
    const [first] = await listUniversities(db);
    const ok = { universityId: first.id, universityStudentId: '2210012345' };
    const cases = [
      {},
      { universityId: '' },
      { universityId: 'uni-missing' },
      { universityId: OTHER_UNIVERSITY, institution: '' },
      { universityId: OTHER_UNIVERSITY, institution: 'ج' },
      { universityStudentId: '' },
      { universityStudentId: '123' },
      { universityStudentId: '1'.repeat(21) },
      { universityStudentId: '22 100<script>' },
      { universityStudentId: '-2210012345' },
    ];
    for (const [i, bad] of cases.entries())
      await invalid(
        authenticateParticipant(
          db,
          form(10 + i, { ...(i === 0 ? {} : ok), ...bad }),
          `10.0.1.${i}`,
        ),
      );
    assert.equal((await stored(db)).length, 0);
  });
});

test('school students still give a school name, and university fields are never stored for them', async () => {
  await fixture(async (db) => {
    const [first] = await listUniversities(db);
    const school = {
      stage: 'المرحلة الثانوية',
      institution: 'ثانوية الخبر',
      universityId: first.id,
      universityStudentId: '2210012345',
    };
    await authenticateParticipant(db, form(20, school), '10.0.2.1');
    await invalid(
      authenticateParticipant(db, form(21, { ...school, institution: '' }), '10.0.2.2'),
    );
    assert.deepEqual(await stored(db), [
      {
        stage: 'المرحلة الثانوية',
        institution: 'ثانوية الخبر',
        university_ref: null,
        university_student_id: null,
      },
    ]);
  });
});

test('the phone code path carries the university choice through verification', async () => {
  await fixture(async (db) => {
    const sent = new Map<string, string>();
    const provider: OtpProvider = {
      name: 'fake',
      async send(input) {
        sent.set(input.id, input.code);
        return input.id;
      },
      async healthCheck() {
        return true;
      },
    };
    await saveSetup(db, {});
    const otp = new OtpService(db, provider);
    const [first] = await listUniversities(db);
    const context = { ip: '192.0.2.40' };
    await invalid(
      otp.challenge(form(40, { universityId: first.id, universityStudentId: 'x' }), context),
    );
    const challenge = await otp.challenge(
      form(40, { universityId: first.id, universityStudentId: '2210012345' }),
      context,
    );
    assert.equal((await stored(db)).length, 0);
    await otp.verify(
      {
        challengeId: challenge.challengeId,
        purpose: challenge.purpose,
        code: sent.get(challenge.challengeId)!,
      },
      context,
    );
    assert.deepEqual(await stored(db), [
      {
        stage: university,
        institution: first.name,
        university_ref: first.id,
        university_student_id: '2210012345',
      },
    ]);
  });
});

test('the committee adds, renames and removes universities with an audit trail', async () => {
  await fixture(async (db) => {
    const service = new UniversityAdmin(db);
    const before = await service.list(admin);
    const { id } = await service.create(admin, { name: '  جامعة   الاختبار ' });
    let list = await service.list(admin);
    assert.equal(list.length, before.length + 1);
    assert.deepEqual(list.at(-1), { id, name: 'جامعة الاختبار', participants: 0 });
    await assert.rejects(service.create(admin, { name: 'جامعة الاختبار' }), /موجودة/);
    await assert.rejects(service.create(admin, { name: 'ج' }), AppError);
    await assert.rejects(service.create(admin, { name: '<b>x</b>' }), AppError);

    await authenticateParticipant(
      db,
      form(50, { universityId: id, universityStudentId: '2210012345' }),
      '10.0.3.1',
    );
    await service.update(admin, { id, name: 'جامعة الاختبار الأهلية' });
    assert.equal((await stored(db))[0].institution, 'جامعة الاختبار الأهلية');
    assert.equal((await service.list(admin)).find((u) => u.id === id)?.participants, 1);
    await assert.rejects(
      service.update(admin, { id, name: before[0].name }),
      (e: unknown) => e instanceof AppError && e.status === 409,
    );

    await service.remove(admin, { id });
    assert.equal((await service.list(admin)).length, before.length);
    assert.deepEqual(await stored(db), [
      {
        stage: university,
        institution: 'جامعة الاختبار الأهلية',
        university_ref: null,
        university_student_id: '2210012345',
      },
    ]);
    await assert.rejects(service.remove(admin, { id }), /غير موجودة/);
    const audit = (
      await db.query<{ action: string }>("SELECT action FROM audit WHERE action LIKE '%جامعة'")
    ).rows.map((r) => r.action);
    assert.deepEqual(audit, ['إضافة جامعة', 'تعديل اسم جامعة', 'حذف جامعة']);
  });
});

test('only an administrator can manage the university list', async () => {
  await fixture(async (db) => {
    const service = new UniversityAdmin(db);
    for (const staff of [editor, { ...editor, role: 'participant' as const }, null as never]) {
      await assert.rejects(service.list(staff), /صلاحية/);
      await assert.rejects(service.create(staff, { name: 'جامعة غير مسموحة' }), /صلاحية/);
    }
  });
});

test('university IDs are normalized and bounded', () => {
  assert.equal(universityStudentId('٢٢١٠٠١٢٣٤٥'), '2210012345');
  assert.equal(universityStudentId(' s-2024 0017 '), 's-20240017');
  for (const bad of ['', '   ', 'abc', 'a'.repeat(21), 'ab_cd1', 12345678, null])
    assert.throws(() => universityStudentId(bad), AppError);
});

test('committee corrections keep the university ID tied to the university stage; erasure removes it', async () => {
  await fixture(async (db) => {
    const [first] = await listUniversities(db);
    await authenticateParticipant(
      db,
      form(60, { universityId: first.id, universityStudentId: '2210012345' }),
      '10.0.4.1',
    );
    const participants = new ParticipantAdmin(db);
    const reason = 'تصحيح موثق بطلب من المشارك بعد التحقق من هويته';
    const row = (await participants.list(admin, {})).rows[0];
    assert.equal(row.universityStudentId, '2210012345');
    await participants.update(admin, {
      id: row.id,
      reason,
      changes: { universityStudentId: '٢٢١٠٠٩٩٩٩٩' },
    });
    assert.equal((await stored(db))[0].university_student_id, '2210099999');
    await assert.rejects(
      participants.update(admin, { id: row.id, reason, changes: { universityStudentId: 'no' } }),
      AppError,
    );
    await participants.update(admin, {
      id: row.id,
      reason,
      changes: { stage: 'المرحلة الثانوية' },
    });
    assert.deepEqual(await stored(db), [
      {
        stage: 'المرحلة الثانوية',
        institution: first.name,
        university_ref: null,
        university_student_id: null,
      },
    ]);
    await assert.rejects(
      participants.update(admin, {
        id: row.id,
        reason,
        changes: { universityStudentId: '2210012345' },
      }),
      /المرحلة الجامعية/,
    );
    await participants.update(admin, { id: row.id, reason, changes: { stage: university } });
    await participants.update(admin, {
      id: row.id,
      reason,
      changes: { universityStudentId: '2210012345' },
    });
    await db.query(
      "INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score) VALUES('att-u','" +
        row.id +
        "','nbc-1448-2026','university','1','[]',30)",
    );
    await participants.erase(admin, { id: row.id, reason });
    const erased = (await stored(db))[0];
    assert.equal(erased.institution, null);
    assert.equal(erased.university_ref, null);
    assert.equal(erased.university_student_id, null);
  });
});
