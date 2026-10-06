import { createElement } from 'react';
import type { Competition } from './competition-domain';

export function pairLtr(a: number, b: number) {
  return createElement('bdi', { dir: 'ltr' }, `${a} / ${b}`);
}

export function NumPair({ a, b }: { a: number; b: number }) {
  return pairLtr(a, b);
}

export function arPlural(n: number, forms: readonly [string, string, string, string]): string {
  const [one, two, few, many] = forms;
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : many}`;
}

export const competitionStateLabels: Record<Competition['state'], string> = {
  DRAFT: 'المسابقة لم تفتح بعد',
  SCHEDULED: 'المسابقة لم تفتح بعد',
  OPEN: 'المسابقة مفتوحة الآن',
  CLOSED: 'أُغلقت المسابقة',
  RESULTS_PUBLISHED: 'أُعلنت النتائج',
};

export function closingPhrase(closesAt: string, now: number): string {
  const remaining = new Date(closesAt).getTime() - now;
  if (remaining <= 0) return 'انتهى موعد إغلاق المسابقة';
  if (remaining >= 86400000)
    return `تُغلق المسابقة بعد ${arPlural(Math.ceil(remaining / 86400000), ['يوم واحد', 'يومين', 'أيام', 'يومًا'])}`;
  if (remaining >= 3600000)
    return `تُغلق المسابقة بعد ${arPlural(Math.ceil(remaining / 3600000), ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'])}`;
  return `تُغلق المسابقة بعد ${arPlural(Math.ceil(remaining / 60000), ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'])}`;
}

export function riyadhDateTime(value: string): string {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(value));
}

export function resultSentence(correct: number, total: number): string {
  const noun = total >= 3 && total <= 10 ? 'أسئلة' : 'سؤالًا';
  return `أجبت إجابة صحيحة عن ${correct} من ${total} ${noun}.`;
}
