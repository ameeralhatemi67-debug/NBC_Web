'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, Brand, DemoNote, ErrorMessage, Icon, Loading, OrganizationsBar } from './ui';
import { bookChapters, regions, stages } from '@/lib/content';
import { tieGroups, type Question } from '@/lib/domain';
type Participant = {
  id: string;
  name: string;
  stage: string;
  region: string;
  locality: string;
  village: string;
  score: number | null;
  submitted_at: string | null;
  attempt_id: string | null;
};
type AdminData = {
  participants: Participant[];
  questions: Question[];
  audit: { id: string; action: string; detail: string; actor: string; created_at: string }[];
  published: boolean;
};
const tabs = [
  { id: 'overview', name: 'نظرة عامة', icon: 'chart' },
  { id: 'participants', name: 'المشاركون', icon: 'user' },
  { id: 'questions', name: 'بنك الأسئلة', icon: 'book' },
  { id: 'results', name: 'النتائج والاعتماد', icon: 'shield' },
  { id: 'reports', name: 'التقارير', icon: 'download' },
  { id: 'audit', name: 'سجل العمليات', icon: 'clock' },
];
export function Admin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [stage, setStage] = useState('');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Question | null>(null);
  const [notice, setNotice] = useState('');
  const [reminder, setReminder] = useState<{
    recipients: { name: string }[];
    message: string;
    sent: boolean;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    const state = await api<AdminData>('admin');
    setData(state);
  }
  useEffect(() => {
    api<{ session: { role: string } | null }>('session')
      .then(async (s) => {
        if (s.session && ['admin', 'editor'].includes(s.session.role)) {
          setRole(s.session.role);
          if (s.session.role === 'editor') setTab('questions');
          await load();
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function login(selected: string) {
    setBusy(true);
    setError('');
    try {
      await api('auth/demo-staff', { role: selected });
      setRole(selected);
      setTab(selected === 'editor' ? 'questions' : 'overview');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, body: unknown, message: string) {
    setBusy(true);
    setError('');
    try {
      await api(path, body);
      await load();
      setNotice(message);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ recipients: { name: string }[]; message: string; sent: boolean }>(
        'admin/reminders',
        {},
      );
      setReminder(r);
      dialog.current?.showModal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!role || !data)
    return (
      <main id="main" className="staff-entry container">
        <Brand />
        <div className="staff-entry-card">
          <div className="arch-icon">
            <Icon name="shield" size={32} />
          </div>
          <span className="eyebrow">مساحة اللجنة</span>
          <h1>
            خلف كل مشاركة،
            <br />
            <em>إدارة تستحق الثقة.</em>
          </h1>
          <p>استعرض إدارة المحتوى، ومتابعة المشاركين، واعتماد الدرجات.</p>
          <div className="simulation-box">
            <Icon name="shield" />
            <p>
              دخول تجريبي محلي ببيانات افتراضية. اختيار الدور هنا مخصص للعرض، ولا يمثّل مصادقة
              موظفين في نظام إنتاجي.
            </p>
          </div>
          <ErrorMessage message={error} />
          <div className="button-row centered">
            <button className="button primary" disabled={busy} onClick={() => login('admin')}>
              دخول عرض اللجنة <Icon />
            </button>
            <button className="button outline" disabled={busy} onClick={() => login('editor')}>
              دخول محرر المحتوى
            </button>
          </div>
          <Link className="text-link" href="/">
            العودة إلى الموقع
          </Link>
        </div>
        <OrganizationsBar compact />
      </main>
    );
  const rows = data.participants.filter(
    (p) =>
      (!stage || p.stage === stage) &&
      (!region || p.region === region) &&
      (tab !== 'participants' || !search || p.name.includes(search) || p.locality.includes(search)),
  );
  const submitted = data.participants.filter((p) => p.submitted_at);
  const completed = rows.filter((p) => p.submitted_at).length;
  const ties = tieGroups(data.participants);
  const approved = data.questions.filter((q) => q.approved).length;
  const ranked = [...submitted].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name, 'ar'),
  );
  function Table({ people = rows }: { people?: Participant[] }) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>المشارك</th>
              <th>المرحلة</th>
              <th>المنطقة / المحافظة</th>
              <th>حالة المشاركة</th>
              <th>الدرجة</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <small>سجل تجريبي</small>
                </td>
                <td>{p.stage.replace('المرحلة ', '')}</td>
                <td>
                  {p.region}
                  <small>
                    {p.locality}
                    {p.village && p.village !== '—' ? ` · ${p.village}` : ''}
                  </small>
                </td>
                <td>
                  <span
                    className={`badge ${p.submitted_at ? 'success' : p.attempt_id ? 'warning' : 'neutral'}`}
                  >
                    {p.submitted_at ? 'مكتملة' : p.attempt_id ? 'قيد المشاركة' : 'لم تبدأ'}
                  </span>
                </td>
                <td>
                  <bdi>{p.score !== null ? `${p.score} / 10` : '—'}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!people.length && <div className="empty-inline">لا توجد نتائج مطابقة لهذه المرشحات.</div>}
      </div>
    );
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Brand />
        <span className="sidebar-caption">مساحة اللجنة</span>
        <nav aria-label="لوحة التحكم">
          {tabs
            .filter((t) => role === 'admin' || t.id === 'questions')
            .map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => {
                  setTab(t.id);
                  setNotice('');
                  setError('');
                }}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <Icon name={t.icon} size={20} />
                {t.name}
                {t.id === 'questions' && <small>{data.questions.length}</small>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <DemoNote compact />
          <Link href="/">
            معاينة الموقع <Icon size={17} />
          </Link>
          <button
            onClick={async () => {
              await api('auth/logout', {});
              setRole('');
              setData(null);
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>مسابقة الانتماء واللحمة الوطنية</span>
          <div>
            <span className="status-dot" /> بيانات تجريبية{' '}
            <span className="avatar">{role === 'admin' ? 'ل' : 'م'}</span>
          </div>
        </header>
        <main id="main" className="admin-main">
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">إدارة واعية. تجربة متكاملة.</span>
              <h1>{tabs.find((t) => t.id === tab)?.name}</h1>
              <p>
                {tab === 'overview'
                  ? 'صورة واضحة للمشاركة، من البداية إلى الاعتماد.'
                  : 'المعلومات المعروضة من سجلات العرض التجريبي.'}
              </p>
            </div>
            {role === 'admin' && (
              <button className="button outline" disabled={busy} onClick={preview}>
                <Icon name="bell" size={18} /> معاينة التذكير
              </button>
            )}
          </div>
          <ErrorMessage message={error} />
          {notice && (
            <div role="status" className="success-message">
              {notice}
            </div>
          )}
          {tab === 'overview' && (
            <>
              <section className="stats-grid">
                {[
                  {
                    label: 'إجمالي المشاركين',
                    value: data.participants.length,
                    icon: 'user',
                    note: 'عبر المراحل التعليمية',
                  },
                  {
                    label: 'مشاركات مكتملة',
                    value: submitted.length,
                    icon: 'check',
                    note: 'تم إرسالها نهائيًا',
                  },
                  {
                    label: 'بانتظار الإكمال',
                    value: data.participants.length - submitted.length,
                    icon: 'clock',
                    note: 'يشمل من لم يبدأ',
                  },
                  {
                    label: 'أسئلة معتمدة',
                    value: `${approved} / ${data.questions.length}`,
                    icon: 'book',
                    note: 'من النص التجريبي',
                  },
                ].map((s) => (
                  <div key={s.label} className="stat-card">
                    <div>
                      <span>{s.label}</span>
                      <Icon name={s.icon} />
                    </div>
                    <strong>{s.value}</strong>
                    <small>{s.note}</small>
                  </div>
                ))}
              </section>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>المشاركة حسب المرحلة</h2>
                    <Icon name="chart" />
                  </div>
                  <div className="stage-chart">
                    {stages.map((s) => {
                      const total = data.participants.filter((p) => p.stage === s).length;
                      const done = data.participants.filter(
                        (p) => p.stage === s && p.submitted_at,
                      ).length;
                      return (
                        <div key={s}>
                          <div>
                            <span>{s}</span>
                            <bdi>
                              {done} / {total}
                            </bdi>
                          </div>
                          <div className="chart-track">
                            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="fine-print">المشاركات المكتملة من إجمالي المسجلين في كل مرحلة</p>
                </section>
                <section className="panel campaign-panel">
                  <span className="eyebrow">جاهزية الاعتماد</span>
                  <h2>
                    كل نتيجة،
                    <br />
                    لها مسار واضح.
                  </h2>
                  <div>
                    <span>الدرجات</span>
                    <span className={`badge ${data.published ? 'success' : 'warning'}`}>
                      {data.published ? 'منشورة' : 'بانتظار النشر'}
                    </span>
                  </div>
                  <div>
                    <span>مجموعات التعادل</span>
                    <strong>{ties.length}</strong>
                  </div>
                  <p>التعادل لا يُحسم بسرعة الإرسال. اختيار الفائزين بانتظار قرار اللجنة.</p>
                  <button className="text-link" onClick={() => setTab('results')}>
                    مراجعة النتائج <Icon size={18} />
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>المشاركون في العرض</h2>
                  <a className="text-link" href="/api/admin/backup">
                    نسخة احتياطية <Icon name="download" size={17} />
                  </a>
                  <button className="text-link" onClick={() => setTab('participants')}>
                    عرض الجميع <Icon size={17} />
                  </button>
                </div>
                <Table people={data.participants.slice(0, 5)} />
              </section>
            </>
          )}
          {(tab === 'participants' || tab === 'reports') && (
            <>
              <div className="filters">
                <label>
                  المرحلة
                  <select value={stage} onChange={(e) => setStage(e.target.value)}>
                    <option value="">جميع المراحل</option>
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  المنطقة
                  <select value={region} onChange={(e) => setRegion(e.target.value)}>
                    <option value="">جميع المناطق</option>
                    {regions.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                {tab === 'participants' && (
                  <label>
                    البحث
                    <input
                      placeholder="اسم المشارك أو المحافظة"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                )}
                <button
                  className="text-link"
                  onClick={() => {
                    setStage('');
                    setRegion('');
                    setSearch('');
                  }}
                >
                  مسح المرشحات
                </button>
              </div>
              {tab === 'reports' && (
                <>
                  <div className="report-summary">
                    <div>
                      <strong>{rows.length}</strong>
                      <span>مسجلون</span>
                    </div>
                    <div>
                      <strong>{completed}</strong>
                      <span>مكتملون</span>
                    </div>
                    <div>
                      <strong>{rows.length - completed}</strong>
                      <span>غير مكتملين</span>
                    </div>
                    <a
                      className="button primary"
                      href={`/api/export?${new URLSearchParams({ stage, region })}`}
                    >
                      <Icon name="download" /> تصدير CSV
                    </a>
                  </div>
                  <p className="notice">
                    التقرير يعرض الدرجات، وليس قائمة فائزين معتمدة. التصدير يطبّق مرشحات المرحلة
                    والمنطقة نفسها.
                  </p>
                </>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>{tab === 'reports' ? 'تفاصيل التقرير' : 'سجل المشاركين'}</h2>
                  <span className="muted">{rows.length} سجلًا</span>
                </div>
                <Table />
              </section>
            </>
          )}
          {tab === 'questions' && (
            <>
              <div className="notice">
                <Icon name="book" />
                <span>
                  ١٠ أسئلة من نص أصلي تجريبي. تعديل السؤال ينشئ إصدارًا غير معتمد؛ المحاولات القائمة
                  تحتفظ بنسختها الأصلية.
                </span>
              </div>
              <div className="question-bank">
                {data.questions.map((q, i) => (
                  <section className="panel bank-item" key={q.id}>
                    <div className="bank-item-heading">
                      <span className="small-index">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <h3>{q.title}</h3>
                        <p>
                          {bookChapters.find((c) => c.id === q.source)?.title} · الإصدار {q.version}
                        </p>
                      </div>
                      <span className={`badge ${q.approved ? 'success' : 'warning'}`}>
                        {q.approved ? 'معتمد' : 'مسودة'}
                      </span>
                    </div>
                    {editing?.id === q.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          mutate('admin/question', editing, 'تم حفظ إصدار جديد بانتظار الاعتماد.');
                        }}
                      >
                        <fieldset disabled={busy}>
                          <label>
                            نص السؤال
                            <textarea
                              value={editing.title}
                              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                              required
                            />
                          </label>
                          <div className="form-grid">
                            {editing.options.map((o, j) => (
                              <label key={j}>
                                الخيار {j + 1}
                                <input
                                  value={o}
                                  required
                                  onChange={(e) =>
                                    setEditing({
                                      ...editing,
                                      options: editing.options.map((v, k) =>
                                        k === j ? e.target.value : v,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <label>
                            الإجابة الصحيحة (للمحررين فقط)
                            <select
                              value={editing.correct}
                              onChange={(e) =>
                                setEditing({ ...editing, correct: Number(e.target.value) })
                              }
                            >
                              {editing.options.map((_, j) => (
                                <option key={j} value={j}>
                                  الخيار {j + 1}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="button-row">
                            <button className="button primary" type="submit">
                              حفظ كمسودة
                            </button>
                            <button
                              className="button outline"
                              type="button"
                              onClick={() => setEditing(null)}
                            >
                              إلغاء
                            </button>
                          </div>
                        </fieldset>
                      </form>
                    ) : (
                      <div className="bank-actions">
                        <span>المصدر: النص التجريبي · {q.source}</span>
                        <button
                          className="text-link"
                          onClick={() => setEditing({ ...q, options: [...q.options] })}
                        >
                          تحرير السؤال
                        </button>
                        {!q.approved && role === 'admin' && (
                          <button
                            className="button outline small-button"
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                'admin/question',
                                { id: q.id, version: q.version, approve: true },
                                'تم اعتماد السؤال.',
                              )
                            }
                          >
                            اعتماد السؤال <Icon name="check" size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {tab === 'results' && (
            <>
              <section className="panel release-panel">
                <div>
                  <span className="eyebrow">اعتماد الدرجات</span>
                  <h2>{data.published ? 'الدرجات متاحة للمشاركين' : 'الدرجات بانتظار الاعتماد'}</h2>
                  <p>
                    عند النشر، يرى كل مشارك درجته فقط دون الإجابات الصحيحة. يُحجب النشر تلقائيًا عند
                    وصول مشاركة جديدة لمراجعتها.
                  </p>
                </div>
                <button
                  className={`button ${data.published ? 'outline' : 'primary'}`}
                  disabled={busy}
                  onClick={() =>
                    mutate(
                      'admin/publish',
                      { published: !data.published },
                      data.published
                        ? 'تم حجب الدرجات.'
                        : 'تم اعتماد نشر الدرجات. اختيار الفائزين يبقى قرارًا منفصلًا.',
                    )
                  }
                >
                  {data.published ? 'حجب الدرجات' : 'اعتماد نشر الدرجات'}
                  <Icon name="shield" />
                </button>
              </section>
              <div className="notice">
                <Icon name="clock" />
                <span>
                  {ties.length
                    ? `${ties.length} مجموعة تعادل تحتاج إلى قرار اللجنة.`
                    : 'لا توجد درجات متساوية حاليًا.'}{' '}
                  لا يتم ترجيح أي مشارك بناءً على وقت الإرسال، ولا اختيار فائز تلقائيًا.
                </span>
              </div>
              {ties.map((t) => (
                <div className="tie-card" key={t.score}>
                  <strong>درجة متساوية: {t.score} / 10</strong>
                  <span>
                    {data.participants
                      .filter((p) => t.ids.includes(p.id))
                      .map((p) => p.name)
                      .join(' · ')}
                  </span>
                  <span className="badge warning">قيد قرار اللجنة</span>
                </div>
              ))}
              <section className="panel">
                <div className="panel-heading">
                  <h2>الدرجات المحتسبة</h2>
                  <span className="muted">الترتيب بالدرجة؛ تساويها لا يحدد فائزًا</span>
                </div>
                <Table people={ranked} />
              </section>
            </>
          )}
          {tab === 'audit' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>مسار يمكن مراجعته</h2>
                <span className="muted">آخر ٥٠ عملية</span>
              </div>
              <div className="audit-list">
                {data.audit.map((event) => (
                  <article key={event.id}>
                    <span className="audit-dot" />
                    <div>
                      <strong>{event.action}</strong>
                      <p>{event.detail}</p>
                      <small>
                        {event.actor === 'admin'
                          ? 'اللجنة'
                          : event.actor === 'editor'
                            ? 'محرر المحتوى'
                            : event.actor === 'system'
                              ? 'النظام'
                              : 'مشارك تجريبي'}{' '}
                        ·{' '}
                        {new Date(event.created_at).toLocaleString('ar-SA', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <div className="admin-footer">
            نسخة محلية تجريبية · لا تُستخدم بيانات مشاركين حقيقية · الدرجات ليست إعلانًا للفائزين
          </div>
        </main>
      </div>
      <dialog ref={dialog} className="reminder-dialog">
        <button
          className="icon-button dialog-close"
          onClick={() => dialog.current?.close()}
          aria-label="إغلاق المعاينة"
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">معاينة فقط · لا يتم الإرسال</span>
        <h2>تذكير في وقته.</h2>
        <p>{reminder?.message}</p>
        <h3>المشاركون غير المكتملين الآن ({reminder?.recipients.length ?? 0})</h3>
        <ul>
          {reminder?.recipients.map((r) => (
            <li key={r.name}>{r.name}</li>
          ))}
        </ul>
        <p className="fine-print">
          أُعيد التحقق من حالة المشاركة عند المعاينة. لا توجد خدمة رسائل متصلة.
        </p>
        <button className="button primary" onClick={() => dialog.current?.close()}>
          تمت المراجعة <Icon name="check" />
        </button>
      </dialog>
    </div>
  );
}
