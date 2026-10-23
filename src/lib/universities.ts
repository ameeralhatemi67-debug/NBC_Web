import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './database';
import { AppError, normalizeDigits } from './domain';
import { OTHER_UNIVERSITY, type University } from './content';
import type { Session } from './service';

// University students pick their university from a committee-managed list (or «أخرى» and type it)
// and give their university ID number. The name is copied onto the participant as `institution`,
// so reports, analytics and winners keep working from one field.
export type UniversityRow = University & { participants: number };
export const MAX_UNIVERSITY_NAME = 120;
export const MAX_INSTITUTION_NAME = 160;
const STUDENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{3,19}$/;

const clean = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

export function universityStudentId(value: unknown) {
  const id = normalizeDigits(clean(value)).replace(/\s/g, '');
  if (!STUDENT_ID.test(id))
    throw new AppError('أدخل الرقم الجامعي (من 4 إلى 20 خانة، أرقام أو حروف إنجليزية).');
  return id;
}
export function universityName(value: unknown, max = MAX_UNIVERSITY_NAME) {
  const name = clean(value);
  if (name.length < 2 || name.length > max || /[\u0000-\u001f\u007f<>]/.test(name))
    throw new AppError('اسم الجامعة غير صالح.');
  return name;
}

export async function listUniversities(db: Queryable): Promise<University[]> {
  return (await db.query<University>('SELECT id,name FROM universities ORDER BY sort_order,name'))
    .rows;
}

// What registration stores for a university student. `universityId` is a list entry's id or
// OTHER_UNIVERSITY; for the latter the typed `institution` is the university's name.
export async function resolveUniversity(db: Queryable, body: Record<string, unknown>) {
  const choice = typeof body.universityId === 'string' ? body.universityId : '';
  if (!choice) throw new AppError('اختر الجامعة من القائمة.');
  let institution: string;
  let universityRef = '';
  if (choice === OTHER_UNIVERSITY)
    institution = universityName(body.institution, MAX_INSTITUTION_NAME);
  else {
    const found = (
      await db.query<University>('SELECT id,name FROM universities WHERE id=$1', [choice])
    ).rows[0];
    if (!found) throw new AppError('اختر الجامعة من القائمة.');
    institution = found.name;
    universityRef = found.id;
  }
  return {
    institution,
    universityRef,
    universityStudentId: universityStudentId(body.universityStudentId),
  };
}

function admin(s: Session) {
  if (!s || s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return s.actor ?? s.role;
}

// Committee tools for the university list: add, rename and remove. Renaming also updates the
// participants who picked that entry; removing keeps their recorded university name.
export class UniversityAdmin {
  constructor(private db: Database) {}

  async list(s: Session): Promise<UniversityRow[]> {
    admin(s);
    return (
      await this.db.query<{ id: string; name: string; participants: string }>(
        'SELECT u.id,u.name,count(p.id) AS participants FROM universities u LEFT JOIN participants p ON p.university_ref=u.id GROUP BY u.id,u.name,u.sort_order ORDER BY u.sort_order,u.name',
      )
    ).rows.map((r) => ({ id: r.id, name: r.name, participants: Number(r.participants) }));
  }

  async create(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const name = universityName(body.name);
    const id = `uni-${randomUUID().slice(0, 8)}`;
    await this.db.transaction(async (tx) => {
      await this.assertUnique(tx, name);
      await tx.query(
        'INSERT INTO universities(id,name,sort_order) VALUES($1,$2,(SELECT COALESCE(max(sort_order),0)+1 FROM universities))',
        [id, name],
      );
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'إضافة جامعة',
        JSON.stringify({ id, name }),
      ]);
    });
    return { id };
  }

  async update(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    const name = universityName(body.name);
    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, body.id);
      if (current.name === name) return;
      await this.assertUnique(tx, name, current.id);
      await tx.query('UPDATE universities SET name=$1,updated_at=now() WHERE id=$2', [
        name,
        current.id,
      ]);
      await tx.query(
        'UPDATE participants SET institution=$1 WHERE university_ref=$2 AND erased_at IS NULL',
        [name, current.id],
      );
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'تعديل اسم جامعة',
        JSON.stringify({ id: current.id, from: current.name, to: name }),
      ]);
    });
    return { ok: true };
  }

  async remove(s: Session, body: Record<string, unknown>) {
    const actor = admin(s);
    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, body.id);
      await tx.query('DELETE FROM universities WHERE id=$1', [current.id]);
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'حذف جامعة',
        JSON.stringify({ id: current.id, name: current.name }),
      ]);
    });
    return { ok: true };
  }

  private async lock(tx: Queryable, id: unknown) {
    const row =
      typeof id === 'string' && id
        ? (
            await tx.query<University>('SELECT id,name FROM universities WHERE id=$1 FOR UPDATE', [
              id,
            ])
          ).rows[0]
        : undefined;
    if (!row) throw new AppError('الجامعة غير موجودة. حدّث الصفحة.', 404);
    return row;
  }
  private async assertUnique(tx: Queryable, name: string, except = '') {
    const clash = (
      await tx.query('SELECT 1 FROM universities WHERE lower(btrim(name))=lower($1) AND id<>$2', [
        name,
        except,
      ])
    ).rows.length;
    if (clash) throw new AppError('هذه الجامعة موجودة في القائمة.', 409);
  }
}
