import { CompetitionService } from './competition-service';
import type { WriteEvent } from './competition-domain';
import { randomBytes, createHash } from 'node:crypto';
import { getDb } from './db';
import { isProduction, requireLocalMode } from './runtime';
import { AppError, type Question } from './domain';
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
export async function participantState(session: Session, competitionId?: string) {
  return new CompetitionService(await getDb()).state(session, competitionId);
}
export async function startAttempt(session: Session) {
  return new CompetitionService(await getDb()).start(session);
}
export async function changeAttempt(session: Session, body: Record<string, unknown>) {
  return new CompetitionService(await getDb()).write(session, body as unknown as WriteEvent);
}
export async function adminState() {
  const db = await getDb();
  return db.transaction(async (tx) => ({
    participants: (
      await tx.query<ParticipantReport>(
        "SELECT p.id,p.name,p.stage,p.institution,p.gender,p.region,p.locality,p.village,p.created_at,a.score,jsonb_array_length(a.questions) AS max_score,a.submitted_at,a.receipt,a.id AS attempt_id FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id AND a.competition_id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition') ORDER BY p.created_at",
      )
    ).rows,
    questions: (
      await tx.query<{ body: Question }>(
        "SELECT body FROM questions WHERE body ? 'stage' ORDER BY id",
      )
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
  return new CompetitionService(await getDb()).saveQuestion(session, body);
}
