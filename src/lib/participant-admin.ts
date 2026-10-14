import type { Database, Queryable } from './database';
import { AppError, normalizeDigits } from './domain';
import { genders, regions, stages } from './content';
import { identityLookup, keyedHash, maskPhone, normalizePhone } from './otp-crypto';
import type { Session } from './service';

// Committee tools for participant records: find, correct (including a changed phone or a
// mistyped identity) and erase on a data-subject request. Every change needs a written reason
// and is audited without storing the personal values themselves.
export type ParticipantListRow = {
  id: string;
  name: string;
  stage: string;
  institution: string | null;
  gender: string | null;
  region: string;
  locality: string;
  maskedPhone: string;
  createdAt: string;
  erased: boolean;
  attemptId: string | null;
  submittedAt: string | null;
  score: number | null;
};
export const PARTICIPANTS_PAGE_SIZE = 25;
const REASON = 'اكتب سببًا موثقًا للإجراء (15 حرفًا على الأقل).';

function admin(s: Session) {
  if (!s || s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return s.actor ?? s.role;
}
function reasonOf(body: Record<string, unknown>) {
  const reason = String(body.reason ?? '').trim();
  if (reason.length < 15) throw new AppError(REASON);
  if (reason.length > 1000) throw new AppError('سبب الإجراء طويل جدًا.');
  return reason;
}
const likeEscape = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const clean = (value: unknown, max: number, label: string) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > max || /[\u0000-\u001f\u007f<>]/.test(text))
    throw new AppError(`${label} غير صالح.`);
  return text;
};

export class ParticipantAdmin {
  constructor(private db: Database) {}

  async list(
    s: Session,
    query: { page?: number; q?: string; stage?: string; status?: string; pageSize?: number },
  ) {
    admin(s);
    const pageSize = Math.min(
      100,
      Math.max(1, Math.trunc(query.pageSize ?? 0) || PARTICIPANTS_PAGE_SIZE),
    );
    const page = Math.max(1, Math.trunc(query.page ?? 1) || 1);
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    const q = (query.q ?? '').trim().slice(0, 80);
    if (q) {
      const digits = normalizeDigits(q).replace(/[\s()-]/g, '');
      if (/^[12]\d{9}$/.test(digits)) add('p.identity=?', identityLookup(digits));
      else if (/^(\+?966|0)?5\d{8}$/.test(digits)) add('p.phone=?', normalizePhone(digits));
      else {
        params.push(`%${likeEscape(q)}%`);
        where.push(
          `(p.name ILIKE $${params.length} ESCAPE '\\' OR p.institution ILIKE $${params.length} ESCAPE '\\' OR p.locality ILIKE $${params.length} ESCAPE '\\')`,
        );
      }
    }
    if (query.stage && stages.includes(query.stage)) add('p.stage=?', query.stage);
    if (query.status === 'completed') where.push('a.submitted_at IS NOT NULL');
    else if (query.status === 'started') where.push('a.id IS NOT NULL AND a.submitted_at IS NULL');
    else if (query.status === 'new') where.push('a.id IS NULL');
    const from = `FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id AND a.competition_id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')${where.length ? ' WHERE ' + where.join(' AND ') : ''}`;
    const total = Number(
      (await this.db.query<{ n: string }>(`SELECT count(*) AS n ${from}`, params)).rows[0].n,
    );
    const rows = (
      await this.db.query<{
        id: string;
        name: string;
        stage: string;
        institution: string | null;
        gender: string | null;
        region: string;
        locality: string;
        phone: string;
        created_at: string;
        erased_at: string | null;
        attempt_id: string | null;
        submitted_at: string | null;
        score: number | null;
      }>(
        `SELECT p.id,p.name,p.stage,p.institution,p.gender,p.region,p.locality,p.phone,p.created_at,p.erased_at,a.id AS attempt_id,a.submitted_at,a.score ${from} ORDER BY p.created_at DESC,p.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      )
    ).rows;
    return {
      total,
      page,
      pageSize,
      rows: rows.map((r): ParticipantListRow => ({
        id: r.id,
        name: r.name,
        stage: r.stage,
        institution: r.institution,
        gender: r.gender,
        region: r.region,
        locality: r.locality,
        maskedPhone: r.erased_at ? '—' : maskPhone(r.phone),
        createdAt: r.created_at,
        erased: !!r.erased_at,
        attemptId: r.attempt_id,
        submittedAt: r.submitted_at,
        score: r.score === null ? null : Number(r.score),
      })),
    };
  }

  async update(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const reason = reasonOf(body);
    const changes = (body.changes ?? {}) as Record<string, unknown>;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes))
      throw new AppError('تغييرات غير صالحة.');
    const allowed = [
      'name',
      'phone',
      'identity',
      'institution',
      'gender',
      'stage',
      'region',
      'locality',
    ];
    const fields = Object.keys(changes);
    if (!fields.length) throw new AppError('لا توجد تغييرات للحفظ.');
    if (fields.some((f) => !allowed.includes(f))) throw new AppError('حقل غير مسموح.');
    const set: Record<string, string> = {};
    if ('name' in changes) {
      set.name = clean(changes.name, 120, 'الاسم');
      if (set.name.split(' ').length < 2) throw new AppError('أدخل الاسم الكامل.');
    }
    if ('institution' in changes) set.institution = clean(changes.institution, 160, 'جهة الدراسة');
    if ('locality' in changes) set.locality = clean(changes.locality, 60, 'المدينة');
    if ('gender' in changes) {
      if (!genders.includes(String(changes.gender))) throw new AppError('الجنس غير صالح.');
      set.gender = String(changes.gender);
    }
    if ('stage' in changes) {
      if (!stages.includes(String(changes.stage))) throw new AppError('المرحلة غير صالحة.');
      set.stage = String(changes.stage);
    }
    if ('region' in changes) {
      if (!regions.includes(String(changes.region))) throw new AppError('المنطقة غير صالحة.');
      set.region = String(changes.region);
    }
    if ('phone' in changes) set.phone = normalizePhone(String(changes.phone ?? ''));
    if ('identity' in changes) set.identity = identityLookup(String(changes.identity ?? ''));
    await this.db.transaction(async (tx) => {
      const p = await this.lockParticipant(tx, body.id);
      if (p.erased_at) throw new AppError('بيانات هذا المشارك محذوفة ولا يمكن تعديلها.', 409);
      if (set.stage && set.stage !== p.stage) {
        const attempt = (
          await tx.query(
            "SELECT 1 FROM attempts WHERE participant_id=$1 AND competition_id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')",
            [p.id],
          )
        ).rows.length;
        if (attempt)
          throw new AppError('لا يمكن تغيير المرحلة بعد بدء المشاركة في المسابقة الحالية.', 409);
      }
      if (set.identity) {
        const clash = (
          await tx.query('SELECT 1 FROM participants WHERE identity=$1 AND id<>$2', [
            set.identity,
            p.id,
          ])
        ).rows.length;
        if (clash)
          throw new AppError(
            'هذه الهوية مسجلة لمشارك آخر. إن كان الحساب الآخر مكررًا ولا مشاركة له فاحذفه أولًا.',
            409,
          );
      }
      const entries = Object.entries(set);
      await tx.query(
        `UPDATE participants SET ${entries.map(([k], i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${entries.length + 1}`,
        [...entries.map(([, v]) => v), p.id],
      );
      if (set.phone && set.phone !== p.phone) {
        // A changed number ends every session and pending code tied to the old one.
        await tx.query('DELETE FROM sessions WHERE participant_id=$1', [p.id]);
        await tx.query(
          "UPDATE otp_challenges SET state='SUPERSEDED',otp_digest=NULL,payload_json='{}' WHERE participant_id=$1 AND used_at IS NULL",
          [p.id],
        );
      }
      const plain = ['stage', 'gender', 'region', 'locality'];
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'تعديل بيانات مشارك',
        JSON.stringify({
          participantId: p.id,
          fields: Object.keys(set),
          values: Object.fromEntries(plain.filter((k) => k in set).map((k) => [k, set[k]])),
          reason,
        }),
      ]);
    });
    return { ok: true };
  }

  // Data-subject erasure. A participant who never took part is deleted outright. One with an
  // attempt is anonymised instead: the score and participant number stay, as the competition
  // record, but name, phone, identity and the rest are removed.
  async erase(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const reason = reasonOf(body);
    let mode: 'deleted' | 'anonymized' = 'deleted';
    await this.db.transaction(async (tx) => {
      const p = await this.lockParticipant(tx, body.id);
      if (p.erased_at) throw new AppError('بيانات هذا المشارك محذوفة بالفعل.', 409);
      const named = (
        await tx.query(
          `SELECT 1 FROM competition_awards aw JOIN attempts a ON a.id=aw.attempt_id JOIN competition_winner_publications pub ON pub.competition_id=aw.competition_id WHERE a.participant_id=$1 AND pub.show_names`,
          [p.id],
        )
      ).rows.length;
      if (named)
        throw new AppError(
          'اسم المشارك ظاهر في إعلان الفائزين. اسحب الإعلان أولًا ثم أعد النشر.',
          409,
        );
      const hasAttempt = (
        await tx.query(
          'SELECT 1 FROM attempts WHERE participant_id=$1 UNION ALL SELECT 1 FROM simulation_attempts WHERE participant_id=$1',
          [p.id],
        )
      ).rows.length;
      await tx.query('DELETE FROM sessions WHERE participant_id=$1', [p.id]);
      await tx.query('DELETE FROM otp_challenges WHERE participant_id=$1 OR phone_hash=$2', [
        p.id,
        keyedHash('phone', p.phone),
      ]);
      if (hasAttempt) {
        mode = 'anonymized';
        await tx.query(
          "UPDATE participants SET name='مشارك محذوف',phone='erased',identity=$2,institution=NULL,gender=NULL,locality='—',village=NULL,backup=NULL,erased_at=now() WHERE id=$1",
          [p.id, `erased:${p.id}`],
        );
      } else await tx.query('DELETE FROM participants WHERE id=$1', [p.id]);
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'حذف بيانات مشارك',
        JSON.stringify({ participantId: p.id, mode, reason }),
      ]);
    });
    return { ok: true, mode };
  }

  private async lockParticipant(tx: Queryable, id: unknown) {
    if (typeof id !== 'string' || !id) throw new AppError('المشارك غير موجود.', 404);
    const p = (
      await tx.query<{ id: string; phone: string; stage: string; erased_at: string | null }>(
        'SELECT id,phone,stage,erased_at FROM participants WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (!p) throw new AppError('المشارك غير موجود.', 404);
    return p;
  }
}
