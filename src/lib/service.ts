import { randomBytes, randomInt, randomUUID, createHash } from 'node:crypto';
import { getDb } from './db';
import { isProduction, requireLocalMode } from './runtime';
import {
  AppError,
  publicQuestions,
  scoreAttempt,
  validateAnswers,
  type Answers,
  type Question,
} from './domain';
import { validatePrizes, type PrizeSettings } from './prizes';
export type Session = {
  role: 'participant' | 'admin' | 'editor';
  participant_id: string | null;
  actor?: string | null;
  auth_source?: string;
};
export type ParticipantReport = {
  id: string;
  name: string;
  stage: string;
  institution: string | null;
  gender: string | null;
  region: string;
  locality: string;
  village: string;
  score: number | null;
  max_score: number | null;
  created_at: string;
  submitted_at: string | null;
  attempt_id: string | null;
  receipt: string | null;
};
type Attempt = {
  id: string;
  participant_id: string;
  questions: Question[];
  answers: Answers;
  revision: number;
  score: number | null;
  submitted_at: string | null;
  receipt: string | null;
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function sessionFor(token?: string): Promise<Session | null> {
  if (!token) return null;
  const db = await getDb();
  const { rows } = await db.query<Session>(
    'SELECT role,participant_id,actor,auth_source FROM sessions WHERE token=$1 AND expires_at > now()',
    [hash(token)],
  );
  const session = rows[0];
  if (isProduction() && session && session.auth_source !== 'otp') return null;
  return session ?? null;
}
export async function newSession(role: Session['role'], participant: string | null = null) {
  requireLocalMode();
  const token = randomBytes(32).toString('hex');
  const db = await getDb();
  await db.query(
    "INSERT INTO sessions (token,participant_id,role,expires_at,auth_source,actor) VALUES ($1,$2,$3,$4,'demo',$3)",
    [hash(token), participant, role, new Date(Date.now() + 8 * 3600 * 1000)],
  );
  return token;
}
export async function revokeSession(token: string) {
  const db = await getDb();
  await db.query('DELETE FROM sessions WHERE token=$1', [hash(token)]);
}
function field(body: Record<string, unknown>, key: string, max = 120) {
  const value = String(body[key] ?? '').trim();
  if (value.length > max) throw new AppError('أحد الحقول أطول من الحد المسموح.');
  return value;
}
export async function participantState(session: Session) {
  const db = await getDb();
  const participant = (
    await db.query(
      'SELECT id,name,stage,region,locality,institution,gender FROM participants WHERE id=$1',
      [session.participant_id],
    )
  ).rows[0];
  const attempt = (
    await db.query<Attempt>('SELECT * FROM attempts WHERE participant_id=$1', [
      session.participant_id,
    ])
  ).rows[0];
  const published = (
    await db.query<{ value: boolean }>('SELECT value FROM settings WHERE id=$1', ['published'])
  ).rows[0].value;
  return {
    participant,
    attempt: attempt
      ? {
          id: attempt.id,
          questions: publicQuestions(attempt.questions),
          answers: attempt.answers,
          revision: attempt.revision,
          submittedAt: attempt.submitted_at,
          receipt: attempt.receipt,
          score: published ? attempt.score : null,
        }
      : null,
    published,
  };
}
export async function startAttempt(session: Session) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const old = await tx.query('SELECT id FROM attempts WHERE participant_id=$1', [
      session.participant_id,
    ]);
    if (old.rows.length) return;
    const questions = (
      await tx.query<{ body: Question }>('SELECT body FROM questions ORDER BY id')
    ).rows.map((q) => q.body);
    if (questions.length !== 10 || questions.some((q) => !q.approved))
      throw new AppError('بانتظار اعتماد جميع أسئلة النسخة التجريبية.', 409);
    for (let i = questions.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    await tx.query(
      'INSERT INTO attempts (id,participant_id,questions) VALUES ($1,$2,$3) ON CONFLICT (participant_id) DO NOTHING',
      [randomUUID(), session.participant_id, JSON.stringify(questions)],
    );
  });
  return participantState(session);
}
export async function changeAttempt(
  session: Session,
  body: Record<string, unknown>,
  submit = false,
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const a = (
      await tx.query<Attempt>('SELECT * FROM attempts WHERE participant_id=$1 FOR UPDATE', [
        session.participant_id,
      ])
    ).rows[0];
    if (!a) throw new AppError('ابدأ المشاركة أولًا.', 404);
    if (a.submitted_at) {
      if (submit) return;
      throw new AppError('تم إرسال المشاركة ولا يمكن تعديلها.', 409);
    }
    if (a.revision !== body.revision)
      throw new AppError('توجد إجابات أحدث محفوظة. أعد تحميل المشاركة قبل التعديل.', 409);
    const answers = validateAnswers(a.questions, body.answers);
    if (submit) {
      const receipt = `NBC-${a.id.slice(0, 8).toUpperCase()}`;
      await tx.query(
        'UPDATE attempts SET answers=$1,revision=revision+1,score=$2,submitted_at=now(),receipt=$3 WHERE id=$4',
        [JSON.stringify(answers), scoreAttempt(a.questions, answers), receipt, a.id],
      );
      // New submissions require a fresh review before grades are released again.
      await tx.query('UPDATE settings SET value=$1 WHERE id=$2', ['false', 'published']);
      await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
        session.participant_id,
        'إرسال نهائي',
        receipt,
      ]);
    } else
      await tx.query('UPDATE attempts SET answers=$1,revision=revision+1 WHERE id=$2', [
        JSON.stringify(answers),
        a.id,
      ]);
  });
  return participantState(session);
}
export async function adminState() {
  const db = await getDb();
  return db.transaction(async (tx) => ({
    participants: (
      await tx.query<ParticipantReport>(
        'SELECT p.id,p.name,p.stage,p.institution,p.gender,p.region,p.locality,p.village,p.created_at,a.score,jsonb_array_length(a.questions) AS max_score,a.submitted_at,a.receipt,a.id AS attempt_id FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id ORDER BY p.created_at',
      )
    ).rows,
    questions: (
      await tx.query<{ body: Question }>('SELECT body FROM questions ORDER BY id')
    ).rows.map((q) => q.body),
    audit: (
      await tx.query(
        'SELECT id,actor,action,detail,created_at FROM audit ORDER BY id DESC LIMIT 50',
      )
    ).rows,
    published: (
      await tx.query<{ value: boolean }>('SELECT value FROM settings WHERE id=$1', ['published'])
    ).rows[0].value,
    prizes: (
      await tx.query<{ value: PrizeSettings }>('SELECT value FROM settings WHERE id=$1', ['prizes'])
    ).rows[0].value,
  }));
}
export async function readPrizes() {
  const db = await getDb();
  return (
    await db.query<{ value: PrizeSettings }>('SELECT value FROM settings WHERE id=$1', ['prizes'])
  ).rows[0].value;
}
export async function updatePrizes(body: Record<string, unknown>, actor = 'admin') {
  const next = validatePrizes(body);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const current = (
      await tx.query<{ value: PrizeSettings }>(
        'SELECT value FROM settings WHERE id=$1 FOR UPDATE',
        ['prizes'],
      )
    ).rows[0].value;
    if (current.version !== next.version)
      throw new AppError('توجد إعدادات أحدث. حدّث الصفحة قبل الحفظ.', 409);
    const saved = { ...next, version: next.version + 1 };
    await tx.query('UPDATE settings SET value=$1 WHERE id=$2', [JSON.stringify(saved), 'prizes']);
    await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
      actor,
      'تعديل الجوائز',
      JSON.stringify({ before: current, after: saved }),
    ]);
    return saved;
  });
}
export async function updateQuestion(session: Session, body: Record<string, unknown>) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const q = (
      await tx.query<{ body: Question }>('SELECT body FROM questions WHERE id=$1 FOR UPDATE', [
        body.id,
      ])
    ).rows[0]?.body;
    if (!q) throw new AppError('السؤال غير موجود.', 404);
    if (body.version !== q.version)
      throw new AppError('توجد نسخة أحدث من السؤال. حدّث الصفحة.', 409);
    let next: Question;
    if (body.approve === true) {
      if (session.role !== 'admin') throw new AppError('اعتماد المحتوى متاح للجنة فقط.', 403);
      next = { ...q, approved: true };
    } else {
      const title = field(body, 'title', 500);
      const options = body.options;
      if (
        title.length < 5 ||
        !Array.isArray(options) ||
        options.length !== 4 ||
        options.some((x) => typeof x !== 'string' || !x.trim() || x.length > 200) ||
        !Number.isInteger(body.correct) ||
        Number(body.correct) < 0 ||
        Number(body.correct) > 3
      )
        throw new AppError('أكمل نص السؤال والخيارات الأربعة وحدد الإجابة.');
      next = {
        ...q,
        title,
        options: options.map((x) => x.trim()),
        correct: Number(body.correct),
        version: q.version + 1,
        approved: false,
      };
    }
    await tx.query('UPDATE questions SET body=$1 WHERE id=$2', [JSON.stringify(next), q.id]);
    await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
      session.role,
      next.approved ? 'اعتماد سؤال' : 'تعديل سؤال',
      `${q.id} · الإصدار ${next.version} · المحاولات السابقة تحتفظ بنسختها`,
    ]);
  });
}
