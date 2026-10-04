'use client';
import { AdminCompetition } from './admin-competition';
import { AdminQuestionBank, QuestionCoverage } from './admin-question-bank';
import { AdminTestRun } from './admin-test-run';
import { AdminQuestionCredit } from './admin-question-credit';
import { AdminRecovery } from './admin-recovery';
import {
  stageKeys,
  stageNames,
  type Competition,
  type CompetitionQuestion,
  type BookVersion,
} from '@/lib/competition-domain';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  Brand,
  DemoNote,
  DesignToggle,
  ErrorMessage,
  Icon,
  Loading,
  OrganizationsBar,
} from './ui';
import { regions, stages } from '@/lib/content';
import { tieGroups } from '@/lib/domain';
import { AdminAnalytics } from './admin-analytics';
import { AdminSecurity } from './admin-security';
import { AdminPrizes } from './admin-prizes';
import { defaultPrizes, type PrizeSettings } from '@/lib/prizes';
type Participant = {
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
};
type AdminData = {
  participants: Participant[];
  questions: CompetitionQuestion[];
  competition?: Competition;
  book?: BookVersion;
  history?: Record<string, unknown>[];
  audit: { id: string; action: string; detail: string; actor: string; created_at: string }[];
  published: boolean;
  prizes: PrizeSettings;
};
const tabs = [
  { id: 'competition', name: 'إدارة المسابقة', icon: 'clock' },
  { id: 'coverage', name: 'تغطية الكتاب', icon: 'book' },
  { id: 'test-run', name: 'تجربة الإدارة', icon: 'shield' },
  { id: 'security', name: 'إعداد التحقق والأمان', icon: 'shield' },
  { id: 'overview', name: 'نظرة عامة', icon: 'chart' },
  { id: 'participants', name: 'المشاركون', icon: 'user' },
  { id: 'analytics', name: 'تحليلات المسابقة', icon: 'chart' },
  { id: 'prizes', name: 'الجوائز والتصميم', icon: 'trophy' },
  { id: 'questions', name: 'بنك الأسئلة', icon: 'book' },
  { id: 'results', name: 'النتائج والاعتماد', icon: 'shield' },
  { id: 'reports', name: 'التقارير', icon: 'download' },
  { id: 'audit', name: 'سجل العمليات', icon: 'clock' },
];
export function Admin({
  demo,
  staffAuth = 'cloudflare',
  signInReady = false,
  loginFailed = false,
}: {
  demo: boolean;
  staffAuth?: 'cloudflare' | 'vercel';
  signInReady?: boolean;
  loginFailed?: boolean;
}) {
  const [data, setData] = useState<AdminData | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    loginFailed ? 'تعذّر تسجيل الدخول. استخدم حساب Vercel المصرح له ثم أعد المحاولة.' : '',
  );
  const [tab, setTab] = useState('overview');
  const [stage, setStage] = useState('');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
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
    setDataReady(true);
  }
  useEffect(() => {
    api<{ session: { role: string } | null }>('admin/session')
      .then(async (s) => {
        if (s.session && ['admin', 'editor'].includes(s.session.role)) {
          setRole(s.session.role);
          if (s.session.role === 'editor') setTab('questions');
          try {
            await load();
          } catch (e) {
            if (s.session.role !== 'admin') throw e;
            setDataReady(false);
            setData({
              participants: [],
              questions: [],
              audit: [],
              published: false,
              prizes: defaultPrizes,
            });
            setTab('security');
            setError('تعذّر تحميل بيانات المسابقة. راجع جاهزية قاعدة البيانات والترحيلات.');
          }
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
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
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
  // Render the real sign-in link in the initial HTML, including before hydration.
  if (loading && !signInReady) return <Loading />;
  if (!role || !data)
    return (
      <main id="main" className="staff-entry container">
        <DesignToggle />
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
          {demo && (
            <div className="simulation-box">
              <Icon name="shield" />
              <p>
                دخول تجريبي محلي ببيانات افتراضية. اختيار الدور هنا مخصص للعرض، ولا يمثّل مصادقة
                موظفين في نظام إنتاجي.
              </p>
            </div>
          )}
          <ErrorMessage message={error} />

          {demo ? (
            <div className="button-row centered">
              <button className="button primary" disabled={busy} onClick={() => login('admin')}>
                دخول عرض اللجنة <Icon />
              </button>
              <button className="button outline" disabled={busy} onClick={() => login('editor')}>
                دخول محرر المحتوى
              </button>
            </div>
          ) : staffAuth === 'vercel' ? (
            <>
              <p>سجّل الدخول بحساب Vercel المصرح له لإدارة المسابقة.</p>
              {signInReady ? (
                <a className="button primary" href="/api/staff/login">
                  تسجيل الدخول عبر Vercel <Icon />
                </a>
              ) : (
                <p role="status">
                  إعداد تسجيل الدخول غير مكتمل. يلزم ربط تطبيق Vercel بإعدادات النشر.
                </p>
              )}
            </>
          ) : (
            <p>
              دخول الموظفين عبر Cloudflare Access مع المصادقة متعددة العوامل. إذا تعذّر الدخول، اطلب
              من مسؤول النشر إعداد التطبيق وقائمة الموظفين المصرح لهم، ثم أعد فتح هذه الصفحة.
            </p>
          )}
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
      (tab !== 'participants' ||
        !search ||
        p.name.includes(search) ||
        p.locality.includes(search) ||
        p.institution?.includes(search)),
  );
  const submitted = data.participants.filter((p) => p.submitted_at);
  const completed = rows.filter((p) => p.submitted_at).length;
  const ties = stageKeys.flatMap((s) =>
    tieGroups(data.participants.filter((p) => p.stage === stageNames[s])),
  );
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
              <th>الجنس</th>
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
                  {p.id.startsWith('sample-') && <small>سجل تجريبي</small>}
                </td>
                <td>
                  {p.stage.replace('المرحلة ', '')}
                  <small>{p.institution || 'أسم المدرسة/الجامعة غير مسجل'}</small>
                </td>
                <td>{p.gender || 'غير مسجل'}</td>
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
                  <bdi>{p.score !== null ? `${p.score} / ${p.max_score}` : '—'}</bdi>
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
            .filter((t) => role === 'admin' || ['questions', 'coverage'].includes(t.id))
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
          {demo && <DemoNote compact />}
          <Link href="/">
            معاينة الموقع <Icon size={17} />
          </Link>
          <button
            onClick={async () => {
              if (!demo) {
                if (staffAuth === 'vercel') {
                  try {
                    await api('staff/logout', {});
                    window.location.assign('/admin');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                } else window.location.assign('/cdn-cgi/access/logout');
                return;
              }
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
            <span className="status-dot" /> {demo ? 'بيانات تجريبية' : 'جلسة موظف موثقة'}{' '}
            <span className="avatar">{role === 'admin' ? 'ل' : 'م'}</span>
            <DesignToggle />
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
                  : demo
                    ? 'المعلومات المعروضة من سجلات العرض التجريبي.'
                    : 'المعلومات المعروضة من سجلات المنصة.'}
              </p>
            </div>
            {role === 'admin' && (
              <button className="button outline" disabled={busy} onClick={preview}>
                <Icon name="bell" size={18} /> معاينة التذكير
              </button>
            )}
          </div>
          <ErrorMessage message={error} />
          {!dataReady && (
            <div className="notice" role="status">
              <p>
                بيانات المسابقة غير متصلة. إعدادات الجوائز المعروضة افتراضية ولم تُحفظ. يلزم اتصال
                قاعدة البيانات وتشغيل الترحيلات قبل حفظ التغييرات.
              </p>
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await load();
                    setError('');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                إعادة الاتصال ببيانات المسابقة
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="success-message">
              {notice}
            </div>
          )}
          {tab === 'analytics' && <AdminAnalytics people={data.participants} />}
          {tab === 'prizes' && (
            <AdminPrizes settings={data.prizes} storageReady={dataReady} onSaved={load} />
          )}
          {tab === 'security' && role === 'admin' && <AdminSecurity />}
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
                    note: 'من بنك المسابقة',
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
                  <h2>{demo ? 'المشاركون في العرض' : 'المشاركون في المسابقة'}</h2>
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
                      placeholder="اسم المشارك أو جهة الدراسة أو المحافظة"
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
          {tab === 'competition' && data.competition && data.book && (
            <AdminCompetition
              key={data.competition.version + data.competition.id}
              competition={data.competition}
              book={data.book}
              busy={busy}
              mutate={mutate}
            />
          )}
          {tab === 'questions' && data.book && (
            <AdminQuestionBank
              questions={data.questions}
              canApprove={role === 'admin'}
              book={data.book}
              history={data.history ?? []}
              busy={busy}
              mutate={mutate}
            />
          )}
          {tab === 'coverage' && data.book && (
            <QuestionCoverage questions={data.questions} book={data.book} />
          )}
          {tab === 'test-run' && role === 'admin' && <AdminTestRun />}
          {tab === 'participants' && role === 'admin' && (
            <AdminRecovery participants={data.participants} busy={busy} mutate={mutate} />
          )}
          {tab === 'results' && role === 'admin' && (
            <AdminQuestionCredit questions={data.questions} busy={busy} mutate={mutate} />
          )}
          {tab === 'results' && (
            <>
              <section className="panel release-panel">
                <div>
                  <span className="eyebrow">اعتماد الدرجات</span>
                  <h2>{data.published ? 'الدرجات متاحة للمشاركين' : 'الدرجات بانتظار الاعتماد'}</h2>
                  <p>
                    تتحكم سياسة المسابقة في النتيجة الشخصية والترتيب. يتطلب النشر إغلاق المسابقة
                    وانتهاء مهلة المزامنة والمعالجة التقنية.
                  </p>
                </div>
                <button
                  className={`button ${data.published ? 'outline' : 'primary'}`}
                  disabled={busy}
                  onClick={() =>
                    mutate(
                      'admin/publish',
                      { published: !data.published, version: data.competition?.version },
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
                <div className="tie-card" key={t.ids.join('-')}>
                  <strong>درجة متساوية: {t.score} / 20</strong>
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
                {stageKeys.map((s) => (
                  <section key={s}>
                    <h3>{stageNames[s]}</h3>
                    <Table people={ranked.filter((p) => p.stage === stageNames[s])} />
                  </section>
                ))}
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
                              : event.actor}{' '}
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
            الدرجات لا تمثل إعلان الفائزين. اختيار الجوائز واعتمادها يخضعان للجنة.
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
