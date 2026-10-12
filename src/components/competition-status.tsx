'use client';
import { useEffect, useState } from 'react';
import { relativePhrase } from '@/lib/admin-launch';
import { competitionStateLabels, riyadhDateTime } from '@/lib/format';
import type { Competition } from '@/lib/competition-domain';

export type PublicStatus = {
  title: string;
  state: Competition['state'];
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  registration: { open: boolean; reason: 'paused' | 'closed' | null; maxPerPhone: number };
  winnersPublished: boolean;
  questionCounts?: Competition['questionCounts'];
  answerMode?: Competition['answerMode'];
};
// What the home page says about the competition right now, from the committee's own settings.
export function statusSentence(status: PublicStatus, now: number | null) {
  const when = (iso: string) =>
    `${riyadhDateTime(iso)} بتوقيت الرياض${now === null ? '' : ` (${relativePhrase(iso, now)})`}`;
  switch (status.state) {
    case 'DRAFT':
      return status.opensAt
        ? `تفتح المسابقة ${when(status.opensAt)}.`
        : 'سيُعلن موعد فتح المسابقة قريبًا.';
    case 'SCHEDULED':
      return status.opensAt ? `تفتح المسابقة ${when(status.opensAt)}.` : 'ستفتح المسابقة قريبًا.';
    case 'OPEN':
      return status.closesAt ? `تُغلق المسابقة ${when(status.closesAt)}.` : 'المسابقة مفتوحة الآن.';
    case 'CLOSED':
      return 'انتهت فترة المسابقة. شكرًا لكل من شارك، وتُعلن النتائج بقرار اللجنة.';
    default:
      return status.winnersPublished
        ? 'أُعلنت النتائج والفائزون في المسابقة.'
        : 'أُعلنت النتائج. تُعلن اللجنة الفائزين قريبًا.';
  }
}
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
