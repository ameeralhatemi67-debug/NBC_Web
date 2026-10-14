import { CompetitionService } from './competition-service';
import type { WriteEvent } from './competition-domain';
import { randomBytes, createHash } from 'node:crypto';
import { getDb } from './db';
import { isProduction, otpEnabled, requireLocalMode } from './runtime';
import { AppError, type Question } from './domain';
import { validatePrizes, type PrizeSettings } from './prizes';
import { defaultSiteContent, validateSiteContent, type SiteContent } from './site-content';
import { updateMeetingCopy } from './meeting-copy';
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
  attempt_started_at?: string | null;
  reading_flags?: string[];
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
  if (
    isProduction() &&
    session &&
    session.auth_source !== 'otp' &&
    (otpEnabled() ||
      session.auth_source !== 'direct' ||
      session.role !== 'participant' ||
      !session.participant_id)
  )
    return null;
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
        `WITH observations AS (
          SELECT detail::jsonb->>'attemptId' AS attempt_id, jsonb_agg(DISTINCT flag) AS flags
          FROM audit CROSS JOIN LATERAL jsonb_array_elements_text(detail::jsonb->'flags') AS flag
          WHERE action IN ('ملاحظة على وتيرة القراءة','ملاحظة على وتيرة الإجابة')
            AND detail::jsonb->>'testRun' IS DISTINCT FROM 'true'
            AND detail::jsonb->>'competitionId'=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')
          GROUP BY detail::jsonb->>'attemptId'
        )
        SELECT p.id,p.name,p.stage,p.institution,p.gender,p.region,p.locality,p.village,p.created_at,
          a.score,jsonb_array_length(a.questions) AS max_score,a.submitted_at,a.receipt,a.id AS attempt_id,
          a.created_at AS attempt_started_at,COALESCE(o.flags,'[]'::jsonb) AS reading_flags
        FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id
          AND a.competition_id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')
        LEFT JOIN observations o ON o.attempt_id=a.id ORDER BY p.created_at`,
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
  ).rows[0]?.value;
}
// Public announcement of the committee's winners, or null while none is published.
export async function readWinners() {
  return new CompetitionService(await getDb()).publicWinners();
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
// Editable public wording. Falls back to the built-in text when nothing is saved or storage is down.
export async function readSiteContent(): Promise<SiteContent> {
  try {
    const db = await getDb();
    const row = (
      await db.query<{ value: Partial<SiteContent> }>('SELECT value FROM settings WHERE id=$1', [
        'site_content',
      ])
    ).rows[0];
    return JSON.parse(
      updateMeetingCopy(JSON.stringify({ ...defaultSiteContent, ...(row?.value ?? {}) })),
    ) as SiteContent;
  } catch {
    return defaultSiteContent;
  }
}
export async function updateSiteContent(body: Record<string, unknown>, actor = 'admin') {
  const next = validateSiteContent(body);
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO settings(id,value) VALUES('site_content','{\"version\":0}') ON CONFLICT DO NOTHING",
    );
    const current = (
      await tx.query<{ value: Partial<SiteContent> }>(
        'SELECT value FROM settings WHERE id=$1 FOR UPDATE',
        ['site_content'],
      )
    ).rows[0].value;
    if ((current.version ?? 0) !== next.version)
      throw new AppError('توجد نسخة أحدث من المحتوى. حدّث الصفحة قبل الحفظ.', 409);
    const saved = { ...next, version: next.version + 1 };
    await tx.query('UPDATE settings SET value=$1 WHERE id=$2', [
      JSON.stringify(saved),
      'site_content',
    ]);
    await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
      actor,
      'تعديل محتوى الموقع',
      JSON.stringify({ version: saved.version }),
    ]);
    return saved;
  });
}
// The book of the current competition, or null while storage is unavailable.
export async function readCurrentBook() {
  try {
    const service = new CompetitionService(await getDb());
    return await service.book(await service.current());
  } catch {
    return null;
  }
}
// Public competition status for the home page; null while storage is unavailable.
export async function readPublicStatus() {
  try {
    return await new CompetitionService(await getDb()).publicStatus();
  } catch {
    return null;
  }
}
