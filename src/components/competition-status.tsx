'use client';
import { useEffect, useState } from 'react';
import { competitionStateLabels } from '@/lib/format';
import { statusSentence, type PublicStatus } from '@/lib/competition-status';

export function registrationSentence(status: PublicStatus) {
  if (status.registration.open) return 'التسجيل مفتوح.';
  return status.registration.reason === 'closed'
    ? 'أُغلق التسجيل. يمكن لمن سجّل سابقًا تسجيل الدخول.'
    : 'التسجيل متوقف مؤقتًا بقرار اللجنة. يمكن لمن سجّل سابقًا تسجيل الدخول.';
}
export function CompetitionStatus({ status }: { status: PublicStatus }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section
      className="competition-status container"
      aria-label="حالة المسابقة"
      data-state={status.state}
    >
      <span className={`status-pill state-${status.state.toLowerCase()}`}>
        {competitionStateLabels[status.state]}
      </span>
      <p>{statusSentence(status, now)}</p>
      <p className="muted">{registrationSentence(status)}</p>
    </section>
  );
}
