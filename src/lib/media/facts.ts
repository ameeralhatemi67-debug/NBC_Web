import {
  groupParticipants,
  institutionParticipation,
  registrationDay,
  type AnalyticsParticipant,
} from '../analytics';
import { isSmall, SMALL_GROUP } from '../analytics-insights';
import {
  questionCount,
  stageKeys,
  stageNames,
  type Competition,
  type Stage,
} from '../competition-domain';
import { prizeTotal, type PrizeSettings } from '../prizes';

// Everything a poster may say about the competition, computed from the committee's live data.
// Pure: no React and no database. Groups under SMALL_GROUP are never published as a number.
export const SCHOOL_FLOOR = 10;
const DAY = 86_400_000;

export type MediaFacts = {
  asOf: number;
  total: number;
  completed: number;
  completionRate: number | null;
  today: number;
  week: { day: string; count: number }[];
  weekTotal: number;
  cities: { name: string; total: number; completed: number; share: number }[];
  cityCount: number;
  stages: {
    key: Stage;
    name: string;
    short: string;
    total: number;
    completed: number;
    share: number;
    questions: number;
  }[];
  schools: { name: string; city: string; total: number; completed: number }[];
  institutions: number;
  state: Competition['state'] | null;
  opensAt: string | null;
  closesAt: string | null;
  daysLeft: number | null;
  hoursLeft: number | null;
  prizeTotal: number;
  firstPrizes: { stage: string; amount: number }[];
  mediaPrize: number;
};

// Days between two Riyadh calendar dates (yyyy-mm-dd).
function dayGap(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

export function mediaFacts({
  people,
  competition,
  prizes,
  now,
}: {
  people: AnalyticsParticipant[];
  competition?: Competition | null;
  prizes?: PrizeSettings | null;
  now: number;
}): MediaFacts {
  const total = people.length;
  const completed = people.filter((p) => p.submitted_at).length;
  const today = registrationDay(new Date(now).toISOString());
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = registrationDay(new Date(now - (6 - i) * DAY).toISOString());
    return { day, count: people.filter((p) => registrationDay(p.created_at) === day).length };
  });
  const cities = groupParticipants(people, 'locality')
    .filter((g) => g.label !== 'غير مسجل')
    .map((g) => ({
      name: g.label,
      total: g.total,
      completed: g.completed,
      share: total ? (g.total / total) * 100 : 0,
    }));
  const stages = stageKeys.map((key) => {
    const rows = people.filter((p) => p.stage === stageNames[key]);
    return {
      key,
      name: stageNames[key],
      short: stageNames[key].replace('المرحلة ', ''),
      total: rows.length,
      completed: rows.filter((p) => p.submitted_at).length,
      share: total ? (rows.length / total) * 100 : 0,
      questions: questionCount(competition ?? undefined, key),
    };
  });
  const schools = institutionParticipation(people)
    .filter((s) => s.total >= SCHOOL_FLOOR)
    .map((s) => ({ name: s.label, city: s.city, total: s.total, completed: s.completed }));
  const closes = competition?.closesAt ? Date.parse(competition.closesAt) : NaN;
  const open = Number.isFinite(closes) && closes > now;
  return {
    asOf: now,
    total,
    completed,
    completionRate: total >= SMALL_GROUP ? (completed / total) * 100 : null,
    today: week[6].count,
    week,
    weekTotal: week.reduce((sum, d) => sum + d.count, 0),
    cities,
    cityCount: cities.length,
    stages,
    schools,
    institutions: institutionParticipation(people).length,
    state: competition?.state ?? null,
    opensAt: competition?.opensAt ?? null,
    closesAt: competition?.closesAt ?? null,
    daysLeft: open ? dayGap(today, registrationDay(competition!.closesAt!)) : null,
    hoursLeft: open ? Math.floor((closes - now) / 3_600_000) : null,
    prizeTotal: prizes ? prizeTotal(prizes) : 0,
    firstPrizes: (prizes?.stages ?? []).map((s) => ({
      stage: s.name.replace('المرحلة ', ''),
      amount: s.awards[0] ?? 0,
    })),
    mediaPrize: prizes?.mediaPrize ?? 0,
  };
}

// A count as a poster may print it: Arabic-Indic digits, and never an exact count under five.
export function publicCount(n: number) {
  if (isSmall(n)) return 'أقل من ٥';
  return n.toLocaleString('ar-SA');
}
export const arNumber = (n: number, digits = 0) =>
  n.toLocaleString('ar-SA', { maximumFractionDigits: digits });
export const arPercent = (n: number | null, digits = 0) =>
  n === null ? '—' : `${arNumber(n, digits)}٪`;

// "Until 19 October 2026 · 8:00 pm", Riyadh time: the moment a poster's numbers were taken.
export function freshness(at: number) {
  const date = new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(at));
  const time = new Intl.DateTimeFormat('ar-SA', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(at));
  // No "·" beside Arabic-Indic digits: it reads as a zero (٠).
  return `حتى ${date}، الساعة ${time}`;
}
export function riyadhLongDate(iso: string) {
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    calendar: 'gregory',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(iso));
}
export function riyadhTime(iso: string) {
  return new Intl.DateTimeFormat('ar-SA', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(iso));
}
// Arabic number agreement. Forms: one, two, 3–10 (plural), 11–99 (accusative singular),
// and round hundreds/thousands (genitive singular): ١ مدينة واحدة، ٣ مدن، ١٧ مدينةً، ١٠٠ مدينة.
export type NounForms = readonly [string, string, string, string, string];
export const PEOPLE: NounForms = [
  'مشارك واحد',
  'مشاركان',
  'مشاركين ومشاركات',
  'مشاركًا ومشاركة',
  'مشارك ومشاركة',
];
export const CITIES: NounForms = [
  'مدينة واحدة',
  'مدينتين',
  'مدن ومحافظات',
  'مدينة ومحافظة',
  'مدينة ومحافظة',
];
// Short forms for tight labels under a chart.
export const PEOPLE_SHORT: NounForms = ['مشارك واحد', 'مشاركان', 'مشاركين', 'مشاركًا', 'مشارك'];
export const POSTS: NounForms = [
  'منشور واحد مسجّل',
  'منشوران مسجّلان',
  'منشورات مسجّلة',
  'منشورًا مسجّلًا',
  'منشور مسجّل',
];
export const DOWNLOADS: NounForms = ['تنزيل واحد', 'تنزيلان', 'تنزيلات', 'تنزيلًا', 'تنزيل'];
export const ENTRIES: NounForms = [
  'مشاركة مكتملة واحدة',
  'مشاركتان مكتملتان',
  'مشاركات مكتملة',
  'مشاركة مكتملة',
  'مشاركة مكتملة',
];
export function pluralNoun(n: number, forms: NounForms, mask = true) {
  if (mask && isSmall(n)) return forms[2];
  const r = n % 100;
  if (n === 1) return forms[0];
  if (n === 2) return forms[1];
  if (r >= 3 && r <= 10) return forms[2];
  if (r >= 11 && r <= 99) return forms[3];
  return forms[4];
}
// A count with its noun, or "fewer than five" with the plural for small groups of people.
// Counts that cannot identify anyone (cities, days) pass mask = false.
export function countOf(n: number, forms: NounForms, mask = true) {
  if (mask && isSmall(n)) return `أقل من ٥ ${forms[2]}`;
  if (n === 0) return `٠ ${forms[2]}`;
  if (n === 1 || n === 2) return pluralNoun(n, forms, mask);
  return `${n.toLocaleString('ar-SA')} ${pluralNoun(n, forms, mask)}`;
}
// Arabic plural for days: يوم / يومان / أيام / يومًا.
export function daysWord(n: number) {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومان';
  if (n >= 3 && n <= 10) return 'أيام';
  return 'يومًا';
}
export function hoursWord(n: number) {
  if (n === 1) return 'ساعة';
  if (n === 2) return 'ساعتان';
  if (n >= 3 && n <= 10) return 'ساعات';
  return 'ساعة';
}
