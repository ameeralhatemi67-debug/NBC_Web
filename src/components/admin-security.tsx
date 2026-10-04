'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ErrorMessage, Loading } from './ui';
import { OtpEntry, type OtpChallenge } from './otp-entry';
type Readiness = {
  status: string;
  checks: Record<string, boolean>;
  health: boolean;
  tested: boolean;
  canActivate: boolean;
  acknowledgements: Record<string, boolean>;
  healthAt: string | null;
  testedAt: string | null;
  provider: string;
  metrics: Record<string, number>;
};
const labels: Record<string, string> = {
  databaseConnected: 'اتصال قاعدة البيانات',
  migrationsCurrent: 'اكتمال الترحيلات',
  durableDatabase: 'تخزين PostgreSQL دائم',
  databaseUtf8: 'ترميز UTF-8 للبيانات العربية',
  providerSelected: 'اختيار Unifonic',
  credentialsConfigured: 'وجود بيانات اعتماد المزود',
  senderConfigured: 'ضبط اسم المرسل',
  providerConfigured: 'تهيئة محول الإنتاج',
  otpSecret: 'مفتاح حماية رموز التحقق',
  identitySecret: 'مفتاح حماية الهوية',
  identityKeyMatches: 'مطابقة مفتاح الهوية لمفتاح قاعدة البيانات',
  independentSecrets: 'مفاتيح مستقلة',
  https: 'عنوان HTTPS وملف ارتباط آمن',
  persistentRateLimits: 'حدود إرسال مشتركة في PostgreSQL',
  trustedProxy: 'إعداد مصدر عنوان الاتصال',
  demoDisabled: 'تعطيل الرموز ودخول الموظفين التجريبي',
  staffAuthentication: 'دخول الموظفين وقائمة الصلاحيات وتأكيد سياسة MFA',
};
const acknowledgements: Record<string, string> = {
  senderApproved:
    'استلمنا موافقة المزود على اسم المرسل الخدمي للرسائل داخل السعودية، وضبطنا الاسم المعتمد في النشر.',
  privacyReviewed: 'راجعنا سياسة الخصوصية واستخدام الجوال وإرسال الرسائل.',
  vendorReviewed: 'راجعنا مزود الرسائل واتفاقية معالجة البيانات وحماية سجلات محتوى الرسائل لديه.',
  transfersReviewed: 'راجعنا مواقع المعالجة ونقل البيانات عبر الحدود ومتطلبات الجهة.',
  incidentProcess: 'وثّقنا جهة الاتصال ومسار الاستجابة للحوادث في دليل التشغيل الداخلي.',
  retentionReviewed:
    'اعتمدنا الاحتفاظ بسجلات الأمان ٩٠ يومًا، وتنظيف التحديات بعد انتهاء صلاحيتها بـ٢٤ ساعة، وجدول حذف بيانات المشاركين والنسخ الاحتياطية.',
};
const statusLabels: Record<string, string> = {
  NOT_CONFIGURED: 'الإعداد غير مكتمل',
  CONFIGURED: 'مهيأ، بانتظار الاختبار',
  TESTED: 'تم الاختبار، بانتظار التفعيل',
  ACTIVE: 'التحقق الفعلي مفعّل',
  ERROR: 'تعذّر فحص المزود',
};
const metrics: Record<string, string> = {
  otp_sent: 'رسائل المشاركين المقبولة لدى المزود',
  otp_verified: 'عمليات التحقق الناجحة',
  verify_failed: 'محاولات التحقق الفاشلة',
  rate_limit: 'طلبات محجوبة بحدود الاستخدام',
  provider_failed: 'إخفاقات إرسال المزود',
  test_sent: 'رسائل الاختبار',
  test_verified: 'اختبارات التحقق الناجحة',
};
export function AdminSecurity() {
  const [backend, setBackend] = useState<{
    project: string | null;
    adapter: string;
    role: string;
    schema: string;
    migrationsCurrent: boolean;
    counts: Record<string, number>;
  } | null>(null);
  const [data, setData] = useState<Readiness | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({}),
    [phone, setPhone] = useState(''),
    [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  async function load() {
    const r = await api<Readiness>('admin/security');
    setData(r);
    setChecks(r.acknowledgements);
    setBackend(await api<NonNullable<typeof backend>>('admin/backend').catch(() => null));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function action(path: string, body: unknown, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, body);
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setChallenge(await api<OtpChallenge>('admin/security/test', { phone }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return error ? <ErrorMessage message={error} /> : <Loading />;
  return (
    <div className="security-setup">
      <section className="admin-panel" aria-label="تشخيص التخزين">
        <h2>تشخيص التخزين</h2>
        {backend ? (
          <>
            <p>
              المشروع: <bdi>{backend.project ?? 'local'}</bdi>
            </p>
            <p>
              التخزين: <bdi>{backend.adapter}</bdi> · المخطط: <bdi>{backend.schema}</bdi> · الدور:{' '}
              <bdi>{backend.role}</bdi>
            </p>
            <p>الترحيلات: {backend.migrationsCurrent ? 'مكتملة' : 'غير مكتملة'}</p>
            <p>
              المشاركون: {backend.counts.participants} · المحاولات: {backend.counts.attempts} ·
              أسئلة البنك: {backend.counts.questions} · تجارب الإدارة:{' '}
              {backend.counts.admin_test_runs}
            </p>
          </>
        ) : (
          <p>تشخيص التخزين غير متاح.</p>
        )}
      </section>
      <section className="admin-panel">
        <h2>{statusLabels[data.status]}</h2>
        <p>
          المزود: {data.provider}. التسجيل والدخول في الإنتاج متوقفان حتى اكتمال المتطلبات والتفعيل
          من مسؤول مخوّل.
        </p>
        <ErrorMessage message={error} />
        {notice && (
          <p role="status" className="success-message">
            {notice}
          </p>
        )}
        <div className="security-checks">
          {Object.entries(data.checks).map(([key, ok]) => (
            <div key={key}>
              <span>{labels[key] ?? key}</span>
              <strong className={`badge ${ok ? 'success' : 'warning'}`}>
                {ok ? 'مهيأ' : 'غير مكتمل'}
              </strong>
            </div>
          ))}
        </div>
        <p className="muted">
          تُعرض حالة الإعداد فقط. لا تُرسل قيم الأسرار أو بيانات الاعتماد إلى المتصفح.
        </p>
      </section>
      <section className="admin-panel">
        <h2>خطوات المسؤول خارج المنصة</h2>
        <ol className="security-instructions">
          <li>افتح حساب المؤسسة لدى Unifonic وأكمل التحقق من المنشأة ومتطلبات KYC عبر المزود.</li>
          <li>
            اطلب تسجيل اسم مرسل خدمي لغرض OTP، وقدّم المستندات والعينة المطلوبة. انتظر موافقة المزود
            والجهات التنظيمية والمشغلين بحسب متطلبات الحساب. الموقع لا يستطيع إصدار هذه الموافقات.{' '}
            <a
              href="https://www.unifonic.com/hubfs/Technical%20Writing/NOC%20letter%20KSA.pdf"
              target="_blank"
              rel="noreferrer"
            >
              نموذج تسجيل المرسل
            </a>
            .
          </li>
          <li>
            في إعدادات الخادم أو منصة النشر الآمنة، اضبط <bdi>DATABASE_URL</bdi> لقاعدة PostgreSQL
            دائمة، وشغّل <bdi>npm run db:migrate</bdi>. فعّل النسخ الاحتياطي والاستعادة المجربة.
          </li>
          <li>
            اضبط <bdi>NBC_RUNTIME_MODE=production</bdi> و<bdi>OTP_PROVIDER=unifonic</bdi>، وضع{' '}
            <bdi>UNIFONIC_APP_SID</bdi> و<bdi>OTP_SENDER_ID</bdi> في إعدادات النشر. أنشئ مفتاحين
            عشوائيين مستقلين من ٣٢ بايت على الأقل لـ<bdi>OTP_HMAC_SECRET</bdi> و
            <bdi>IDENTITY_LOOKUP_SECRET</bdi> بصيغة hex. لا تضع أي سر في خانة عامة أو متغير يبدأ بـ
            <bdi>NEXT_PUBLIC_</bdi>.
          </li>
          <li>
            اضبط <bdi>NBC_PUBLIC_ORIGIN</bdi> على عنوان HTTPS، وهيّئ الوكيل الموثوق ليكتب عنوان
            العميل ويمنع تجاوز الخادم الأصلي، ثم اختر <bdi>NBC_TRUSTED_IP_HEADER</bdi>. حذف الرؤوس
            المزورة من مسؤولية إعداد الوكيل.
          </li>
          <li>
            يمكن استخدام تسجيل الدخول عبر Vercel على نطاق vercel.app مع قائمة حسابات مسموحة ومصادقة
            متعددة العوامل. اضبط NBC_STAFF_AUTH=vercel وVERCEL_APP_CLIENT_ID
            وNBC_STAFF_SESSION_SECRET وNBC_VERCEL_ADMIN_SUBJECTS في النشر. أو اربط منطقة الموظفين
            بـCloudflare Access وهوية المؤسسة مع سياسة MFA إلزامية. اضبط <bdi>CF_ACCESS_ISSUER</bdi>{' '}
            و<bdi>CF_ACCESS_AUD</bdi>، وقوائم <bdi>NBC_ADMIN_SUBJECTS</bdi> و
            <bdi>NBC_EDITOR_SUBJECTS</bdi> بمعرفات الموظفين الثابتة. بعد فحص سياسة MFA اضبط{' '}
            <bdi>NBC_STAFF_MFA_CONFIRMED=true</bdi>. لا يوجد اختيار دور تجريبي في الإنتاج.
          </li>
          <li>
            احذف إعدادات المحاكاة من الإنتاج، وأعد النشر. افحص الاتصال، ثم أرسل رمزًا إلى جوال
            اختبار مصرح به وأدخله هنا. راجع الإقرارات الداخلية ثم فعّل التحقق الفعلي.
          </li>
        </ol>
        <p>
          الموافقة على المرسل إقرار إداري يعتمد على مستندات المزود، وليست موافقة تصدرها المنصة. OTP
          يثبت الوصول إلى الجوال ولا يثبت ملكية الهوية.
        </p>
      </section>
      <section className="admin-panel">
        <h2>فحص المزود واختبار الرسالة</h2>
        <p>
          فحص الاتصال: {data.health ? 'ناجح وحديث' : 'بانتظار فحص ناجح'}. آخر فحص:{' '}
          <bdi>
            {data.healthAt
              ? new Date(data.healthAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })
              : 'لم يُنفّذ'}
          </bdi>
          .
        </p>
        <p>
          فحص الاتصال لا يثبت صلاحية الحساب أو اسم المرسل. إدخال الرمز المستلم يثبت أن مسار الإرسال
          والتحقق عمل فعليًا. يجب إجراء اختبار ناجح خلال ٢٤ ساعة قبل التفعيل، وإعادته إذا تغيّر
          إعداد النشر.
        </p>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            void action('admin/security/health', {}, 'اكتمل الفحص. راجع الحالة أعلاه.')
          }
        >
          فحص اتصال المزود
        </button>
        {challenge ? (
          <OtpEntry
            challenge={challenge}
            onBack={() => setChallenge(null)}
            onVerify={async (code) => {
              await api('admin/security/test-verify', {
                challengeId: challenge.challengeId,
                purpose: 'ADMIN_TEST',
                code,
              });
              setChallenge(null);
              setNotice('نجح اختبار الرمز. لم يُنشأ حساب مشارك أو جلسة مشارك.');
              await load();
            }}
          />
        ) : (
          <form onSubmit={test} className="security-test">
            <label>
              جوال اختبار مصرح به
              <input
                type="tel"
                dir="ltr"
                required
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
              />
            </label>
            <button className="button primary" disabled={busy} type="submit">
              إرسال رمز اختبار
            </button>
          </form>
        )}
        <p>الاختبار الناجح: {data.tested ? 'مكتمل وحديث' : 'غير مكتمل أو يحتاج إعادة'}.</p>
      </section>
      <section className="admin-panel">
        <h2>إقرارات الجاهزية الداخلية</h2>
        <p>قائمة تشغيل داخلية، وليست شهادة امتثال أو استشارة قانونية.</p>
        {Object.entries(acknowledgements).map(([key, label]) => (
          <label className="checkbox-label" key={key}>
            <input
              type="checkbox"
              checked={checks[key] === true}
              onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            void action(
              'admin/security/setup',
              { action: 'acknowledge', acknowledgements: checks },
              'حُفظت الإقرارات. يلزم التفعيل مجددًا بعد تغييرها.',
            )
          }
        >
          حفظ الإقرارات
        </button>
        <div className="button-row">
          <button
            className="button primary"
            disabled={busy || !data.canActivate}
            onClick={() =>
              void action('admin/security/setup', { action: 'activate' }, 'تم تفعيل التحقق الفعلي.')
            }
          >
            تفعيل التحقق الفعلي
          </button>
          <button
            className="button outline"
            disabled={busy || data.status !== 'ACTIVE'}
            onClick={() =>
              void action(
                'admin/security/setup',
                { action: 'deactivate' },
                'تم إيقاف عمليات دخول وتسجيل المشاركين الجديدة.',
              )
            }
          >
            إيقاف التحقق مؤقتًا
          </button>
        </div>
      </section>
      <section className="admin-panel">
        <h2>استخدام اليوم بتوقيت الرياض</h2>
        <div className="security-checks">
          {Object.entries(metrics).map(([key, label]) => (
            <div key={key}>
              <span>{label}</span>
              <strong>{data.metrics[key] ?? 0}</strong>
            </div>
          ))}
        </div>
        <p>
          تُخزن أحداث أمنية بلا رموز أو هويات أو أرقام جوال كاملة. لا يعني قبول الرسالة لدى المزود
          وصولها؛ يؤكد إدخال رمز الاختبار الاستلام.
        </p>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            void action(
              'admin/security/cleanup',
              {},
              'نُظفت بيانات المصادقة المنتهية وفق سياسة الاحتفاظ.',
            )
          }
        >
          تنظيف البيانات المنتهية
        </button>
        <p>
          جدولوا <bdi>npm run db:cleanup</bdi> يوميًا في الخادم.
        </p>
      </section>
    </div>
  );
}
