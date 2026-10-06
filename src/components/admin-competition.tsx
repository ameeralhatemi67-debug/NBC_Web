'use client';
import { useState } from 'react';
import type { BookVersion, Competition } from '@/lib/competition-domain';
export function AdminCompetition({
  competition: c,
  book,
  busy,
  mutate,
}: {
  competition: Competition;
  book: BookVersion;
  busy: boolean;
  mutate: (path: string, body: unknown, message: string) => Promise<unknown>;
}) {
  const [form, setForm] = useState(c);
  const [schedule, setSchedule] = useState(false);
  const act = (action: string) =>
    mutate('admin/competition', { action, version: c.version }, 'تم تحديث المسابقة.');
  const localTime = (iso: string | null) =>
    iso ? new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(0, 16) : '';
  return (
    <section className="admin-panel">
      <span className="eyebrow">إدارة المسابقة</span>
      <h2>{c.title}</h2>
      <p>
        الحالة: {c.state} · الإصدار {c.version} ·{' '}
        {c.frozenAt ? 'نسخة الأسئلة معتمدة' : 'يلزم اعتماد نسخة الأسئلة'}
      </p>
      <div className="notice">
        <strong>{book.title}</strong>
        <p>
          {book.pageCount} صفحة PDF · {book.approved ? 'معتمد' : 'بانتظار الاعتماد'}
        </p>
        <code className="checksum">{book.sha256}</code>
        <p>
          الصفحة المطبوعة مستقلة عن صفحة PDF. تبقى نسخة الكتاب ونسخة الأسئلة ثابتتين للمحاولات
          القائمة.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate(
            'admin/competition',
            {
              ...form,
              feedbackMode: 'educational',
              action: 'settings',
              version: c.version,
              scheduled: schedule,
            },
            'تم حفظ سياسة المسابقة.',
          );
        }}
        className="competition-settings"
      >
        <label>
          اسم المسابقة
          <input
            value={form.title}
            maxLength={160}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          تفتح، بتوقيت الرياض
          <input
            type="datetime-local"
            value={localTime(form.opensAt)}
            onChange={(e) =>
              setForm({
                ...form,
                opensAt: e.target.value
                  ? new Date(`${e.target.value}:00+03:00`).toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          تغلق، بتوقيت الرياض
          <input
            type="datetime-local"
            value={localTime(form.closesAt)}
            onChange={(e) =>
              setForm({
                ...form,
                closesAt: e.target.value
                  ? new Date(`${e.target.value}:00+03:00`).toISOString()
                  : null,
              })
            }
          />
        </label>
        <p>تظهر الإجابة الصحيحة والتوضيح بعد تثبيت الإجابة. لا يمكن تغيير الإجابة المثبتة.</p>
        <label>
          النتائج والترتيب
          <select
            value={form.leaderboardMode}
            onChange={(e) =>
              setForm({
                ...form,
                leaderboardMode: e.target.value as Competition['leaderboardMode'],
              })
            }
          >
            <option value="hidden">محجوب كليًا</option>
            <option value="own_result_only">النتيجة الشخصية فقط</option>
            <option value="publish_after_close">
              النتيجة الشخصية، والترتيب بعد الإغلاق واعتماد النشر
            </option>
            <option value="public_live">ترتيب عام مباشر</option>
          </select>
        </label>
        <label>
          سياسة الإغلاق
          <select
            value={form.closingPolicy}
            onChange={(e) =>
              setForm({ ...form, closingPolicy: e.target.value as Competition['closingPolicy'] })
            }
          >
            <option value="immediate">إيقاف فوري</option>
            <option value="grace">مهلة مزامنة للمحاولات القائمة</option>
          </select>
        </label>
        <label>
          مهلة المزامنة بالدقائق
          <input
            type="number"
            min={0}
            max={10080}
            value={form.graceMinutes}
            onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={schedule}
            disabled={c.state !== 'DRAFT'}
            onChange={(e) => setSchedule(e.target.checked)}
          />{' '}
          جدولة الفتح والإغلاق بعد اعتماد نسخة الأسئلة
        </label>
        <button className="button primary" disabled={busy}>
          حفظ الإعدادات
        </button>
      </form>
      <div className="button-row admin-actions">
        {!book.approved && (
          <button className="button outline" disabled={busy} onClick={() => act('approve-book')}>
            اعتماد ملف الكتاب الحالي
          </button>
        )}
        <button
          className="button outline"
          disabled={busy || !['DRAFT', 'SCHEDULED'].includes(c.state)}
          onClick={() => act('freeze')}
        >
          التحقق واعتماد نسخة الأسئلة
        </button>
        <button
          className="button primary"
          disabled={busy || !c.frozenAt || !['DRAFT', 'SCHEDULED'].includes(c.state)}
          onClick={() => act('open')}
        >
          فتح الآن
        </button>
        <button
          className="button outline"
          disabled={busy || !['OPEN', 'SCHEDULED'].includes(c.state)}
          onClick={() => act('close')}
        >
          إغلاق الآن
        </button>
        <button
          className="button outline"
          disabled={busy || c.state !== 'CLOSED'}
          onClick={() => act('publish')}
        >
          اعتماد نشر النتائج
        </button>
        <button
          className="button outline"
          disabled={busy || c.state !== 'RESULTS_PUBLISHED'}
          onClick={() => act('unpublish')}
        >
          سحب النشر
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            mutate(
              'admin/competition',
              { action: 'create', title: 'مسابقة جديدة' },
              'تم إنشاء مسابقة مسودة جديدة. المحاولات السابقة محفوظة.',
            )
          }
        >
          إنشاء حملة جديدة
        </button>
      </div>
      <p className="fine-print">
        فتح المسابقة يتطلب 20 سؤالًا معتمدًا لكل مرحلة وملف كتاب مطابقًا. تغيير بنك الأسئلة بعد
        الاعتماد يجهز إصدارًا لاحقًا؛ النسخة المنشورة لا تتغير. لا تُنشر الجوائز تلقائيًا.
      </p>
    </section>
  );
}
