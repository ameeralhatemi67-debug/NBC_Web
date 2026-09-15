'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, DemoNote, ErrorMessage, Icon, Loading } from './ui';
import { regions, stages } from '@/lib/content';
function RegistrationForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState(params.get('mode') === 'login' ? 'login' : 'register');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    name: '',
    identity: '',
    phone: '',
    backup: '',
    stage: stages[0],
    region: regions[0],
    locality: '',
    village: '',
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
    <div className="registration-grid">
      <aside className="registration-aside">
        <span className="eyebrow">أهلًا بك في الرحلة</span>
        <h1>
          خطوة صغيرة.
          <br />
          <em>وبداية تستحق.</em>
        </h1>
        <p>
          مساحتك للقراءة والمشاركة،
          <br /> ومعرفة أقرب إلى حياتك.
        </p>
        <div className="registration-arch">
          <Icon name="book" size={64} />
          <span>اقرأ لننتمي معًا</span>
        </div>
        <div className="aside-points">
          <span>
            <Icon name="check" size={17} /> يمكنك الرجوع إلى الكتاب
          </span>
          <span>
            <Icon name="check" size={17} /> إجاباتك تُحفظ لتعود إليها
          </span>
          <span>
            <Icon name="check" size={17} /> المشاركة دون مؤقت للإجابة
          </span>
        </div>
      </aside>
      <section className="form-card">
        <div className="form-heading">
          <span className="eyebrow">
            {step === 1 ? '01 / بيانات المشاركة' : '02 / التحقق من الجوال'}
          </span>
          <DemoNote compact />
        </div>
        <h2>
          {step === 2 ? 'بقيت خطوة واحدة.' : mode === 'login' ? 'سعداء بعودتك.' : 'لنبدأ بالتعارف.'}
        </h2>
        <p className="muted">
          {step === 2 ? (
            <>
              رمز التحقق للرقم <bdi>{challenge?.maskedPhone}</bdi>
            </>
          ) : mode === 'login' ? (
            'أدخل بيانات حسابك للعودة إلى مشاركتك.'
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
                  رقم الجوال الأساسي
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
                      المنطقة
                      <select
                        name="region"
                        value={values.region}
                        onChange={(e) => change('region', e.target.value)}
                      >
                        {regions.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      المدينة / المحافظة
                      <input
                        name="locality"
                        required
                        placeholder="مثال: الرياض"
                        maxLength={120}
                        value={values.locality}
                        onChange={(e) => change('locality', e.target.value)}
                      />
                    </label>
                    <label>
                      القرية / المركز <small>إن وجد</small>
                      <input
                        name="village"
                        maxLength={120}
                        value={values.village}
                        onChange={(e) => change('village', e.target.value)}
                      />
                    </label>
                    <label className="full-width">
                      جوال احتياطي <small>اختياري</small>
                      <input
                        name="backup"
                        dir="ltr"
                        type="tel"
                        placeholder="05XXXXXXXX"
                        value={values.backup}
                        onChange={(e) => change('backup', e.target.value)}
                      />
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
                    <Link href="/#faq" target="_blank">
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
            <p className="form-switch">
              {mode === 'register' ? 'لديك حساب بالفعل؟' : 'تشارك للمرة الأولى؟'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
              >
                {mode === 'register' ? 'تسجيل الدخول' : 'إنشاء حساب'}
              </button>
            </p>
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
                    <bdi className="demo-code">{challenge?.demoCode}</bdi>. الرمز صالح لمدة ٥ دقائق،
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
                {busy ? 'جارٍ التحقق…' : 'تحقق وابدأ الرحلة'}
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
export function Registration() {
  return (
    <Suspense fallback={<Loading />}>
      <RegistrationForm />
    </Suspense>
  );
}
