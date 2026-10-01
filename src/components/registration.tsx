'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api, BrandMark, DemoNote, ErrorMessage, Icon, Loading } from './ui';
import { easternCities, genders, stages } from '@/lib/content';
function RegistrationForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    name: '',
    identity: '',
    phone: '',
    stage: stages[0],
    institution: '',
    gender: '',
    locality: '',
    terms: false,
  });
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    maskedPhone: string;
    demoCode: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const change = (key: string, value: string | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));
  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      setChallenge(await api('auth/challenge', { ...values, mode }));
      setStep(2);
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('auth/verify', { challengeId: challenge?.challengeId, code });
      router.push('/participate');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="registration-grid" data-mode={mode} data-step={step}>
      <aside className="registration-aside">
        <div className="registration-emblem">
          <BrandMark size={64} />
        </div>
        <span className="eyebrow light">معرفة تُلهمنا. وانتماء يجمعنا.</span>
        <h1>
          مسابقة الانتماء
          <br /> واللحمة الوطنية
        </h1>
        <p>
          {mode === 'login'
            ? 'أهلًا بعودتك. أكمل قراءتك، وراجع إجاباتك، وتابع مشاركتك من حيث توقفت.'
            : 'رحلة في المعرفة، ومساحة لتترك أثرًا. سجّل بياناتك لتبدأ المشاركة في المسابقة.'}
        </p>
        <div className="aside-points">
          <span>
            <Icon name="book" size={20} /> الكتاب متاح أثناء الإجابة
          </span>
          <span>
            <Icon name="clock" size={20} /> اقرأ وأجب دون مؤقت
          </span>
          <span>
            <Icon name="shield" size={20} /> راجع إجاباتك قبل الإرسال
          </span>
        </div>
        <Link href="/book" className="registration-book">
          <Image
            src="/images/competition/book-cover.png"
            alt=""
            width={921}
            height={1300}
            sizes="82px"
          />
          <span>
            <small>رفيقك في المسابقة</small>
            <strong>ابدأ من الكتاب.</strong>
            <span>
              افتح كتاب المسابقة <Icon size={16} />
            </span>
          </span>
        </Link>
        <p className="registration-aside-note">
          لطلاب وطالبات المتوسطة والثانوية والجامعات والكليات المعتمدة
        </p>
      </aside>
      <section className="form-card" aria-labelledby="registration-title">
        <nav className="auth-mode-nav" aria-label="خيارات الحساب">
          <Link
            href="/register"
            scroll={false}
            aria-current={mode === 'register' ? 'page' : undefined}
          >
            <Icon name="user" size={18} /> مشاركة جديدة
          </Link>
          <Link
            href="/register?mode=login"
            scroll={false}
            aria-current={mode === 'login' ? 'page' : undefined}
          >
            تسجيل الدخول
          </Link>
        </nav>
        <ol className="registration-progress" aria-label="خطوات الدخول والمشاركة">
          <li aria-current={step === 1 ? 'step' : undefined} data-complete={step > 1}>
            <span>{step > 1 ? <Icon name="check" size={16} /> : '1'}</span>
            {mode === 'register' ? 'بيانات المشاركة' : 'بيانات الدخول'}
          </li>
          <li aria-current={step === 2 ? 'step' : undefined}>
            <span>2</span>التحقق من الجوال
          </li>
        </ol>
        <div className="form-heading">
          <span className="eyebrow">
            {step === 2 ? 'تأكيد الدخول' : mode === 'login' ? 'تابع رحلتك' : 'ابدأ المشاركة'}
          </span>
          <DemoNote compact />
        </div>
        <h2 id="registration-title">
          {step === 2 ? 'بقيت خطوة واحدة.' : mode === 'login' ? 'سعداء بعودتك.' : 'لنبدأ بالتعارف.'}
        </h2>
        <p className="muted">
          {step === 2 ? (
            <>
              رمز التحقق للرقم <bdi>{challenge?.maskedPhone}</bdi>
            </>
          ) : mode === 'login' ? (
            'أدخل الهوية ورقم الجوال المسجلين في حسابك. التحقق محاكاة في هذه النسخة التجريبية.'
          ) : (
            'استخدم بيانات افتراضية فقط في هذا العرض.'
          )}
        </p>
        <ErrorMessage message={error} />
        {step === 1 ? (
          <form onSubmit={requestCode}>
            <fieldset disabled={busy}>
              <div className="form-grid">
                {mode === 'register' && (
                  <h3 className="form-section-label full-width">
                    <Icon name="user" size={17} /> بياناتك الشخصية
                  </h3>
                )}
                {mode === 'register' && (
                  <label className="full-width">
                    الاسم الرباعي
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={120}
                      placeholder="الاسم كما في الوثيقة"
                      value={values.name}
                      onChange={(e) => change('name', e.target.value)}
                    />
                  </label>
                )}
                <label>
                  الهوية / الإقامة
                  <input
                    name="identity"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    maxLength={10}
                    placeholder="1XXXXXXXXX"
                    value={values.identity}
                    onChange={(e) => change('identity', e.target.value)}
                  />
                </label>
                <label>
                  رقم الجوال
                  <input
                    name="phone"
                    dir="ltr"
                    type="tel"
                    autoComplete="tel-national"
                    required
                    maxLength={14}
                    placeholder="05XXXXXXXX"
                    value={values.phone}
                    onChange={(e) => change('phone', e.target.value)}
                  />
                </label>
                {mode === 'register' && (
                  <>
                    <h3 className="form-section-label full-width">
                      <Icon name="grad" size={19} /> الدراسة ومكان الإقامة
                    </h3>
                    <label>
                      المرحلة التعليمية
                      <select
                        name="stage"
                        value={values.stage}
                        onChange={(e) => change('stage', e.target.value)}
                      >
                        {stages.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      الجنس
                      <select
                        name="gender"
                        required
                        value={values.gender}
                        onChange={(e) => change('gender', e.target.value)}
                      >
                        <option value="">اختر الجنس</option>
                        {genders.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="full-width">
                      أسم المدرسة/الجامعة
                      <input
                        name="institution"
                        autoComplete="organization"
                        required
                        maxLength={160}
                        placeholder="اسم المدرسة أو الجامعة / الكلية"
                        value={values.institution}
                        onChange={(e) => change('institution', e.target.value)}
                      />
                    </label>
                    <label className="full-width">
                      المدينة / المحافظة
                      <select
                        name="locality"
                        required
                        value={values.locality}
                        onChange={(e) => change('locality', e.target.value)}
                      >
                        <option value="">اختر المدينة / المحافظة</option>
                        {easternCities.map((city) => (
                          <option key={city}>{city}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
              {mode === 'register' && (
                <label className="checkbox-label">
                  <input
                    name="terms"
                    type="checkbox"
                    required
                    checked={values.terms}
                    onChange={(e) => change('terms', e.target.checked)}
                  />
                  <span>
                    أوافق على{' '}
                    <Link href="/terms" target="_blank">
                      شروط المشاركة الموضحة
                    </Link>
                    ، وأفهم أن هذا عرض تجريبي ببيانات افتراضية.
                  </span>
                </label>
              )}
              <button className="button primary full-width" type="submit">
                {busy ? 'جارٍ المتابعة…' : 'متابعة إلى التحقق'}
                <Icon />
              </button>
            </fieldset>
          </form>
        ) : (
          <form onSubmit={verify}>
            <fieldset disabled={busy}>
              <div className="simulation-box">
                <Icon name="shield" />
                <div>
                  <strong>محاكاة التحقق في العرض</strong>
                  <p>
                    لا تُرسل رسالة فعلية. استخدم الرمز{' '}
                    <bdi className="demo-code">{challenge?.demoCode}</bdi>. الرمز صالح لمدة 5 دقائق،
                    ولا يثبت ملكية الهوية.
                  </p>
                </div>
              </div>
              <label>
                رمز التحقق
                <input
                  className="otp-input"
                  name="code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  required
                  placeholder="— — — — — —"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="button primary full-width" type="submit">
                {busy
                  ? 'جارٍ التحقق…'
                  : mode === 'login'
                    ? 'تحقق وتابع مشاركتك'
                    : 'تحقق وابدأ الرحلة'}
                <Icon />
              </button>
              <div className="form-switch">
                <button type="button" onClick={() => requestCode()}>
                  طلب رمز جديد
                </button>
                <span> · </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                >
                  تعديل البيانات
                </button>
              </div>
            </fieldset>
          </form>
        )}
        <div className="form-security">
          <Icon name="shield" size={17} />
          <span>المشاركة مرتبطة بحسابك، لا بسرعة إجابتك.</span>
        </div>
      </section>
    </div>
  );
}
function RegistrationMode() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'login' ? 'login' : 'register';
  return <RegistrationForm key={mode} mode={mode} />;
}
export function Registration() {
  return (
    <Suspense fallback={<Loading />}>
      <RegistrationMode />
    </Suspense>
  );
}
