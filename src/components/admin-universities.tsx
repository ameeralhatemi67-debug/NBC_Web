'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { UniversityRow } from '@/lib/universities';
import { api, ErrorMessage } from './ui';
import { HoldButton } from './hold-button';

// The university list university students choose from when they register: add a university,
// correct a name, remove one. «أخرى» is always offered after the list, so it is not managed here.
export function AdminUniversities() {
  const [rows, setRows] = useState<UniversityRow[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<UniversityRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<UniversityRow[]>('admin/universities'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('admin/universities', body);
      setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    if (await run({ action: 'create', name }, 'أُضيفت الجامعة إلى القائمة.')) setName('');
  }
  async function save() {
    if (!editing) return;
    if (await run({ action: 'update', ...editing }, 'حُفظ اسم الجامعة.')) setEditing(null);
  }
  async function remove() {
    if (!removing) return;
    if (await run({ action: 'delete', id: removing.id }, 'حُذفت الجامعة من القائمة.'))
      setRemoving(null);
  }
  const shown = (rows ?? []).filter((r) => !search.trim() || r.name.includes(search.trim()));
  return (
    <section className="admin-panel universities-admin">
      <h2>قائمة الجامعات</h2>
      <p className="fine-print">
        يختار طلاب المرحلة الجامعية جامعتهم من هذه القائمة عند التسجيل، ويظهر خيار «أخرى» بعدها
        دائمًا لمن جامعته غير مدرجة. تعديل الاسم يحدّثه عند المسجلين الذين اختاروه. حذف الجامعة من
        القائمة لا يغيّر اسم جامعة من سبق تسجيله.
      </p>
      <form className="filters" onSubmit={add}>
        <label>
          إضافة جامعة
          <input
            value={name}
            maxLength={120}
            required
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الجامعة أو الكلية"
          />
        </label>
        <button className="button primary" type="submit" disabled={busy || !name.trim()}>
          إضافة إلى القائمة
        </button>
      </form>
      <ErrorMessage message={error} />
      {notice && (
        <div role="status" className="success-message">
          {notice}
        </div>
      )}
      {rows && (
        <>
          <div className="filters">
            <label>
              بحث في القائمة
              <input
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم الجامعة"
              />
            </label>
            <span className="fine-print">{rows.length} جامعة في القائمة</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الجامعة</th>
                  <th>المسجلون</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editing?.id === row.id ? (
                        <input
                          className="university-name-input"
                          value={editing.name}
                          maxLength={120}
                          autoFocus
                          disabled={busy}
                          aria-label={`اسم ${row.name}`}
                          onChange={(e) => setEditing({ id: row.id, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void save();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : (
                        <strong>{row.name}</strong>
                      )}
                    </td>
                    <td>
                      <bdi dir="ltr">{row.participants}</bdi>
                    </td>
                    <td className="university-actions">
                      {editing?.id === row.id ? (
                        <>
                          <button
                            type="button"
                            className="text-link"
                            disabled={busy || !editing.name.trim()}
                            onClick={() => void save()}
                          >
                            حفظ
                          </button>
                          <button
                            type="button"
                            className="text-link"
                            disabled={busy}
                            onClick={() => setEditing(null)}
                          >
                            إلغاء
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="text-link"
                            disabled={busy}
                            onClick={() => {
                              setEditing({ id: row.id, name: row.name });
                              setRemoving(null);
                              setNotice('');
                            }}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="text-link"
                            disabled={busy}
                            onClick={() => {
                              setRemoving(row);
                              setEditing(null);
                              setNotice('');
                            }}
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && (
              <div className="empty-inline">
                {rows.length ? 'لا توجد جامعة مطابقة.' : 'القائمة فارغة. أضف جامعة لتظهر للطلاب.'}
              </div>
            )}
          </div>
        </>
      )}
      {removing && (
        <section className="launch-card" aria-label="حذف جامعة">
          <h3>حذف «{removing.name}» من القائمة؟</h3>
          <p className="fine-print">
            لن تظهر الجامعة للمسجلين الجدد.{' '}
            {removing.participants
              ? `يحتفظ ${removing.participants} من المسجلين حاليًا باسم جامعتهم ورقمهم الجامعي.`
              : 'لم يسجّل أحد بهذه الجامعة بعد.'}{' '}
            يمكن إضافتها لاحقًا من جديد.
          </p>
          <div className="launch-actions">
            <HoldButton danger disabled={busy} onConfirm={() => void remove()}>
              اضغط مطولًا لحذف الجامعة
            </HoldButton>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              إلغاء
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
