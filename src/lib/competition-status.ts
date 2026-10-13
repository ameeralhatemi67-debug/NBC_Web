import { relativePhrase } from './admin-launch';
import { riyadhDateTime } from './format';
import type { Competition } from './competition-domain';

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
