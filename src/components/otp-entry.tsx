'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, ErrorMessage, Icon } from './ui';
export type OtpChallenge = {
  challengeId: string;
  purpose: 'REGISTER' | 'LOGIN' | 'ADMIN_TEST';
  maskedPhone: string;
  expiresAt: string;
  resendAt: string;
  simulation: boolean;
};
export function OtpEntry({
  challenge,
  onVerify,
  onResend,
  onBack,
}: {
  challenge: OtpChallenge;
  onVerify: (code: string) => Promise<void>;
  onResend?: () => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [now, setNow] = useState(Date.now()),
    [blocked, setBlocked] = useState(false),
    [retryUntil, setRetryUntil] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setCode('');
    setError('');
    setBlocked(false);
  }, [challenge.challengeId]);
  const expires = Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000));
  const resend = Math.max(
    0,
    Math.ceil((Math.max(Date.parse(challenge.resendAt), retryUntil) - now) / 1000),
  );
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) {
        if (e.code === 'EXHAUSTED' || e.code === 'EXPIRED') setBlocked(true);
        if (e.retryAfter) setRetryUntil(Date.now() + e.retryAfter * 1000);
      }
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => onVerify(code));
  }
  return (
    <form onSubmit={submit}>
      <p role="status">
        {challenge.simulation ? (
          'محاكاة محلية فقط. لا تُرسل رسالة فعلية؛ استخدم الرمز الذي ضبطه المطوّر محليًا.'
        ) : (
          <>
            أرسلنا رمزًا من ستة أرقام إلى <bdi>{challenge.maskedPhone}</bdi>.
          </>
        )}
      </p>
      <p className="muted">التحقق يثبت الوصول إلى الجوال، ولا يثبت ملكية الهوية أو الإقامة.</p>
      <p role="timer" aria-label="الوقت المتبقي لصلاحية الرمز">
        {expires
          ? `ينتهي الرمز خلال ${Math.floor(expires / 60)}:${String(expires % 60).padStart(2, '0')}`
          : 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.'}
      </p>
      <ErrorMessage message={error} />
      <fieldset disabled={busy}>
        <label>
          رمز التحقق
          <input
            className="otp-input"
            name="code"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            minLength={6}
            maxLength={6}
            required
            placeholder="— — — — — —"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button
          className="button primary full-width"
          type="submit"
          disabled={!expires || blocked || retryUntil > now}
        >
          {busy ? 'جارٍ التحقق…' : 'تحقق وتابع'}
          <Icon />
        </button>
        <div className="form-switch">
          {onResend && (
            <button type="button" disabled={resend > 0} onClick={() => void run(onResend)}>
              {resend ? `إعادة الإرسال بعد ${resend} ثانية` : 'إعادة إرسال الرمز'}
            </button>
          )}
          {' · '}
          <button type="button" onClick={onBack}>
            تعديل البيانات
          </button>
        </div>
      </fieldset>
    </form>
  );
}
