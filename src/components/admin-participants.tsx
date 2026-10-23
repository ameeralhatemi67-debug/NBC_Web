'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { genders, regions, stages, universityStage } from '@/lib/content';
import type { ParticipantListRow } from '@/lib/participant-admin';
import { riyadhDateTime } from '@/lib/format';
import { api, ErrorMessage } from './ui';
import { HoldButton } from './hold-button';

type Page = { total: number; page: number; pageSize: number; rows: ParticipantListRow[] };
type Form = {
  name: string;
  institution: string;
  universityStudentId: string;
  gender: string;
  stage: string;
  region: string;
  locality: string;
  phone: string;
  identity: string;
};
const formOf = (row: ParticipantListRow): Form => ({
  name: row.name,
  institution: row.institution ?? '',
  universityStudentId: row.universityStudentId ?? '',
  gender: row.gender ?? '',
  stage: row.stage,
  region: row.region,
  locality: row.locality,
  phone: '',
  identity: '',
});
const statusLabel = (row: ParticipantListRow) =>
  row.submittedAt ? 'مكتملة' : row.attemptId ? 'قيد المشاركة' : 'لم تبدأ';

// Find a participant by name, school, city, phone number or identity number; correct the record
// (a changed phone or a mistyped identity are the usual cases); erase it on a data request.
export function AdminParticipants() {
  const [filters, setFilters] = useState({ q: '', stage: '', status: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<ParticipantListRow | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ ...applied, page: String(page) });
      setData(await api<Page>(`admin/participants?${params}`));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [applied, page]);
  useEffect(() => {
    void load();
  }, [load]);

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  }
  function open(row: ParticipantListRow) {
    setEditing(row);
    setForm(formOf(row));
    setReason('');
    setNotice('');
    setError('');
  }
  const changes = () => {
    if (!editing || !form) return {};
    const base = formOf(editing);
    const out: Record<string, string> = {};
    for (const key of Object.keys(form) as (keyof Form)[]) {
      const value = form[key].trim();
      if (key === 'phone' || key === 'identity') {
        if (value) out[key] = value;
      } else if (value !== base[key]) out[key] = value;
    }
    return out;
  };
  async function run(body: Record<string, unknown>, done: (result: { mode?: string }) => string) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ mode?: string }>('admin/participants', body);
      setNotice(done(result));
      setEditing(null);
      setForm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const diff = changes();
  const reasonOk = reason.trim().length >= 15;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section className="admin-panel participants-admin">
      <h2>إدارة سجلات المشاركين</h2>
      <p className="fine-print">
        ابحث بالاسم أو الجهة أو المدينة، أو برقم الجوال الكامل، أو برقم الهوية. كل تعديل أو حذف
        يتطلب سببًا موثقًا ويُسجل في سجل العمليات دون حفظ البيانات الشخصية نفسها.
      </p>
      <form className="filters" onSubmit={search}>
        <label>
          البحث
          <input
            value={filters.q}
            maxLength={80}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="اسم، جهة، مدينة، جوال أو هوية"
          />
        </label>
        <label>
          المرحلة
          <select
            value={filters.stage}
            onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
          >
            <option value="">الكل</option>
            {stages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          حالة المشاركة
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">الكل</option>
            <option value="new">لم تبدأ</option>
            <option value="started">قيد المشاركة</option>
            <option value="completed">مكتملة</option>
          </select>
        </label>
        <button className="button primary" type="submit">
          بحث
        </button>
      </form>
      <ErrorMessage message={error} />
      {notice && (
        <div role="status" className="success-message">
          {notice}
        </div>
      )}
      {data && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>المشارك</th>
                  <th>المرحلة</th>
                  <th>المدينة</th>
                  <th>الجوال</th>
                  <th>المشاركة</th>
                  <th>التسجيل</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      {row.erased && <small>بيانات محذوفة</small>}
                      <small>{row.institution || '—'}</small>
                    </td>
                    <td>{row.stage.replace('المرحلة ', '')}</td>
                    <td>
                      {row.region}
                      <small>{row.locality}</small>
                    </td>
                    <td>
                      <bdi dir="ltr">{row.maskedPhone}</bdi>
                    </td>
                    <td>
                      <span
                        className={`badge ${row.submittedAt ? 'success' : row.attemptId ? 'warning' : 'neutral'}`}
                      >
                        {statusLabel(row)}
                      </span>
                    </td>
                    <td>{riyadhDateTime(row.createdAt).split('،').slice(-2).join('،')}</td>
                    <td>
                      {!row.erased && (
                        <button type="button" className="text-link" onClick={() => open(row)}>
                          تعديل / حذف
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && <div className="empty-inline">لا توجد نتائج مطابقة.</div>}
          </div>
          <nav className="leaderboard-pager" aria-label="صفحات المشاركين">
            <button
              type="button"
              className="button outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              السابق
            </button>
            <span>
              {data.total} سجلًا · صفحة <bdi dir="ltr">{page}</bdi> من <bdi dir="ltr">{pages}</bdi>
            </span>
            <button
              type="button"
              className="button outline"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              التالي
            </button>
          </nav>
        </>
      )}
      {editing && form && (
        <section className="launch-card participant-editor" aria-label="تعديل مشارك">
          <h3>تعديل بيانات {editing.name}</h3>
          <div className="form-grid">
            <label className="full-width">
              الاسم
              <input
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              المرحلة
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              الجنس
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                {genders.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="full-width">
              جهة الدراسة
              <input
                value={form.institution}
                maxLength={160}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
              />
            </label>
            {form.stage === universityStage && (
              <label>
                الرقم الجامعي
                <input
                  dir="ltr"
                  value={form.universityStudentId}
                  maxLength={20}
                  onChange={(e) => setForm({ ...form, universityStudentId: e.target.value })}
                />
              </label>
            )}
            <label>
              المنطقة
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                {regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              المدينة
              <input
                value={form.locality}
                maxLength={60}
                onChange={(e) => setForm({ ...form, locality: e.target.value })}
              />
            </label>
            <label>
              رقم جوال جديد
              <input
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                maxLength={14}
                placeholder="اتركه فارغًا دون تغيير"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <span className="field-hint">
                الرقم الحالي <bdi dir="ltr">{editing.maskedPhone}</bdi>. يُنهي التغيير جلسات المشارك
                الحالية.
              </span>
            </label>
            <label>
              رقم هوية مصحّح
              <input
                dir="ltr"
                inputMode="numeric"
                value={form.identity}
                maxLength={10}
                placeholder="اتركه فارغًا دون تغيير"
                onChange={(e) => setForm({ ...form, identity: e.target.value })}
              />
              <span className="field-hint">لا يُعرض رقم الهوية المحفوظ لأنه مخزّن مشفرًا.</span>
            </label>
            <label className="full-width">
              سبب الإجراء (يُحفظ في سجل العمليات)
              <textarea
                rows={2}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>
          <div className="launch-actions">
            <button
              type="button"
              className="button primary"
              disabled={busy || !reasonOk || !Object.keys(diff).length}
              onClick={() =>
                void run(
                  { action: 'update', id: editing.id, changes: diff, reason },
                  () => 'حُفظت التعديلات وسُجلت في سجل العمليات.',
                )
              }
            >
              حفظ التعديلات
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setForm(null);
              }}
            >
              إلغاء
            </button>
          </div>
          <div className="danger-zone">
            <h4>طلب حذف البيانات</h4>
            <p className="fine-print">
              من لم يشارك يُحذف سجله كاملًا. من شارك تُمسح بياناته الشخصية (الاسم والجوال والهوية
              والجهة) وتبقى درجته برقم مشارك مجهول ضمن سجل المسابقة. لا يمكن التراجع.
            </p>
            <HoldButton
              danger
              disabled={busy || !reasonOk}
              onConfirm={() =>
                void run({ action: 'erase', id: editing.id, reason }, (r) =>
                  r.mode === 'deleted'
                    ? 'حُذف سجل المشارك.'
                    : 'مُسحت البيانات الشخصية وبقيت النتيجة دون هوية.',
                )
              }
            >
              اضغط مطولًا لحذف البيانات
            </HoldButton>
            {!reasonOk && <span className="launch-reason">اكتب السبب أولًا لتفعيل الحذف.</span>}
          </div>
        </section>
      )}
    </section>
  );
}
