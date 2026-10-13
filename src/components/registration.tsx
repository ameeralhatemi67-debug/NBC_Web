'use client';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BookLinkFeedback } from './book-link-feedback';
import { api, BrandMark, DemoNote, ErrorMessage, Icon, Loading } from './ui';
import { OtpEntry, type OtpChallenge } from './otp-entry';
import { genders, stages } from '@/lib/content';
import type { Eligibility } from '@/lib/eligibility';

type RegistrationOptions = Eligibility & {
  registration: { open: boolean; reason: 'paused' | 'closed' | null };
};
function RegistrationForm({
  mode,
  demo,
  otpEnabled,
}: {
  mode: 'login' | 'register';
  demo: boolean;
  otpEnabled: boolean;
}) {
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
    region: '',
    locality: '',
    terms: false,
  });
  // Regions and cities come from the current competition's settings.
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  useEffect(() => {
    if (mode !== 'register') return;
    let alive = true;
    setOptionsFailed(false);
    api<RegistrationOptions>('registration-options')
      .then((result) => {
        if (!alive) return;
        setOptions(result);
        if (result.regions.length === 1) setValues((v) => ({ ...v, region: result.regions[0] }));
      })
      .catch((e) => {
        if (!alive) return;
        setOptionsFailed(true);
        setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [mode, optionsAttempt]);
  const cities = options?.cities[values.region] ?? [];
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const change = (key: string, value: string | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));
  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!otpEnabled) {
        await api('auth/direct', { ...values, mode });
        router.push('/participate');
        return;
      }
      setChallenge(await api('auth/challenge', { ...values, mode }));
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(code: string) {
    await api('auth/verify', {
      challengeId: challenge?.challengeId,
      purpose: challenge?.purpose,
      code,
    });
    router.push('/participate');
  }
  async function resend() {
    setChallenge(
      await api<OtpChallenge>('auth/resend', {
        challengeId: challenge?.challengeId,
        purpose: challenge?.purpose,
      }),
    );
  }
  return (
    <div className="registration-grid" data-mode={mode} data-step={step}>
      <aside className="registration-aside">
        <div className="registration-emblem">
          <BrandMark size={64} />
        </div>
        <span className="eyebrow light">معرفة تُلهمنا، وانتماء يجمعنا.</span>
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
            <BookLinkFeedback />
          </span>
        </Link>
        <p className="registration-aside-note">
          لطلاب وطالبات المرحلتين المتوسطة والثانوية والجامعات والكليات المعتمدة
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
        {otpEnabled && (
          <ol className="registration-progress" aria-label="خطوات الدخول والمشاركة">
            <li aria-current={step === 1 ? 'step' : undefined} data-complete={step > 1}>
              <span>{step > 1 ? <Icon name="check" size={16} /> : '١'}</span>
              {mode === 'register' ? 'بيانات المشاركة' : 'بيانات الدخول'}
            </li>
            <li aria-current={step === 2 ? 'step' : undefined}>
              <span>٢</span>التحقق من الجوال
            </li>
          </ol>
        )}
        <div className="form-heading">
          <span className="eyebrow">
            {step === 2 ? 'تأكيد الدخول' : mode === 'login' ? 'تابع رحلتك' : 'ابدأ المشاركة'}
          </span>
          {demo && <DemoNote compact />}
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
            otpEnabled ? (
              'أدخل الهوية ورقم الجوال المسجلين في حسابك لتلقي رمز تحقق جديد.'
            ) : (
              'أدخل الهوية ورقم الجوال المسجلين في حسابك للدخول إلى مساحة المشاركة.'
            )
          ) : demo ? (
            'استخدم بيانات افتراضية فقط في هذا العرض المحلي.'
          ) : otpEnabled ? (
            'أدخل بيانات المشاركة ورقم جوالك لتلقي رمز التحقق.'
          ) : (
            'أدخل بياناتك لبدء المشاركة في المسابقة.'
          )}
        </p>
        <ErrorMessage message={error} />
        {step === 1 && mode === 'register' && options && !options.registration.open ? (
          <div className="notice" role="status">
            <Icon name="clock" />
            <p>
              {options.registration.reason === 'closed'
                ? 'أُغلق التسجيل لأن المسابقة انتهت.'
                : 'التسجيل متوقف مؤقتًا بقرار اللجنة المنظمة.'}{' '}
              إذا سجّلت سابقًا فاستخدم <Link href="/register?mode=login">تسجيل الدخول</Link> لمتابعة
              مشاركتك.
            </p>
          </div>
        ) : step === 1 ? (
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
                      اسم المدرسة/الجامعة
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
                    {options && options.regions.length > 1 && (
                      <label className="full-width">
                        المنطقة
                        <select
                          name="region"
                          required
                          value={values.region}
                          onChange={(e) => {
                            change('region', e.target.value);
                            change('locality', '');
                          }}
                        >
                          <option value="">اختر المنطقة</option>
                          {options.regions.map((region) => (
                            <option key={region}>{region}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="full-width">
                      المدينة / المحافظة
                      <select
                        name="locality"
                        required
                        disabled={!options || !values.region}
                        value={values.locality}
                        onChange={(e) => change('locality', e.target.value)}
                      >
                        <option value="">
                          {!options
                            ? optionsFailed
                              ? 'تعذّر تحميل المدن'
                              : 'جارٍ تحميل المدن…'
                            : values.region
                              ? 'اختر المدينة / المحافظة'
                              : 'اختر المنطقة أولًا'}
                        </option>
                        {cities.map((city) => (
                          <option key={city}>{city}</option>
                        ))}
                      </select>
                      {optionsFailed && (
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            setError('');
                            setOptionsAttempt((n) => n + 1);
                          }}
                        >
                          إعادة تحميل المدن
                        </button>
                      )}
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
                    أقر بأنني اطلعت على{' '}
                    <Link href="/terms" target="_blank">
                      شروط وضوابط مسابقة «الانتماء واللحمة الوطنية»
                    </Link>{' '}
                    و
                    <Link href="/privacy" target="_blank">
                      سياسة الخصوصية وحماية البيانات الشخصية
                    </Link>
                    ، وفهمت ما ورد فيهما.
                  </span>
                </label>
              )}
              <button className="button primary full-width" type="submit">
                {busy
                  ? 'جارٍ المتابعة…'
                  : otpEnabled
                    ? 'متابعة إلى التحقق'
                    : mode === 'login'
                      ? 'تسجيل الدخول'
                      : 'سجّل وابدأ المشاركة'}
                <Icon />
              </button>
            </fieldset>
          </form>
        ) : (
          challenge && (
            <OtpEntry
              challenge={challenge}
              onVerify={verify}
              onResend={resend}
              onBack={() => {
                setStep(1);
                setError('');
              }}
            />
          )
        )}
        <div className="form-security">
          <Icon name="shield" size={17} />
          <span>المشاركة مرتبطة بحسابك، لا بسرعة إجابتك.</span>
        </div>
      </section>
    </div>
  );
}
function RegistrationMode({ demo, otpEnabled }: { demo: boolean; otpEnabled: boolean }) {
  const params = useSearchParams();
  const mode = params.get('mode') === 'login' ? 'login' : 'register';
  return <RegistrationForm key={mode} mode={mode} demo={demo} otpEnabled={otpEnabled} />;
}
export function Registration({ demo, otpEnabled = true }: { demo: boolean; otpEnabled?: boolean }) {
  return (
    <Suspense fallback={<Loading />}>
      <RegistrationMode demo={demo} otpEnabled={otpEnabled} />
    </Suspense>
  );
}
