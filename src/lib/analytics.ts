export type AnalyticsParticipant = {
  id: string;
  name: string;
  stage: string;
  institution: string | null;
  gender: string | null;
  region: string;
  locality: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  attempt_id: string | null;
  attempt_started_at?: string | null;
  reading_flags?: string[];
  created_at: string;
};
export const emptyFilters = {
  stage: '',
  region: '',
  gender: '',
  institution: '',
  locality: '',
  status: '',
  year: '',
  fromDate: '',
  toDate: '',
  minScore: '',
  maxScore: '',
  search: '',
};
export type AnalyticsFilters = typeof emptyFilters;
export function scorePercentage(p: AnalyticsParticipant) {
  return p.submitted_at && p.score !== null && p.max_score && p.max_score > 0
    ? (p.score / p.max_score) * 100
    : null;
}
const registrationCalendar = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  calendar: 'gregory',
  timeZone: 'Asia/Riyadh',
});
export function registrationYear(date: string) {
  return registrationCalendar.format(new Date(date));
}
export function participationStatus(p: AnalyticsParticipant) {
  return p.submitted_at ? 'completed' : p.attempt_id ? 'started' : 'new';
}
export function filterParticipants<T extends AnalyticsParticipant>(
  people: T[],
  filters: Partial<AnalyticsFilters>,
): T[] {
  return people.filter((p) => {
    const percent = scorePercentage(p);
    return (
      (!filters.stage || p.stage === filters.stage) &&
      (!filters.region || p.region === filters.region) &&
      (!filters.gender || (p.gender || 'غير مسجل') === filters.gender) &&
      (!filters.institution || (p.institution || 'غير مسجل') === filters.institution) &&
      (!filters.locality || (p.locality || 'غير مسجل') === filters.locality) &&
      (!filters.year || registrationYear(p.created_at) === filters.year) &&
      (!filters.fromDate || registrationDay(p.created_at) >= filters.fromDate) &&
      (!filters.toDate || registrationDay(p.created_at) <= filters.toDate) &&
      (!filters.status || participationStatus(p) === filters.status) &&
      (!filters.search ||
        [p.name, p.institution, p.locality].some((v) => v?.includes(filters.search!.trim()))) &&
      (!filters.minScore || (percent !== null && percent >= Number(filters.minScore))) &&
      (!filters.maxScore || (percent !== null && percent <= Number(filters.maxScore)))
    );
  });
}
export function summarize(people: AnalyticsParticipant[]) {
  const scores = people.map(scorePercentage).filter((n): n is number => n !== null);
  const durations = people.map(completionMinutes).filter((n): n is number => n !== null);
  return {
    total: people.length,
    completed: people.filter((p) => p.submitted_at).length,
    average: scores.length ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null,
    institutions: new Set(
      people
        .filter((p) => p.institution?.trim())
        .map((p) =>
          JSON.stringify([p.institution!.trim().replace(/\s+/g, ' '), p.locality.trim()]),
        ),
    ).size,
    averageMinutes: durations.length
      ? durations.reduce((sum, n) => sum + n, 0) / durations.length
      : null,
    timedCompletions: durations.length,
  };
}
export function groupParticipants(
  people: AnalyticsParticipant[],
  field: 'gender' | 'institution' | 'stage' | 'region' | 'locality' | 'year',
) {
  const groups = new Map<string, AnalyticsParticipant[]>();
  for (const p of people) {
    const label =
      field === 'year' ? registrationYear(p.created_at) : p[field]?.trim() || 'غير مسجل';
    const group = groups.get(label);
    if (group) group.push(p);
    else groups.set(label, [p]);
  }
  return [...groups]
    .map(([label, rows]) => ({ label, ...summarize(rows) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'ar'));
}

const dayCalendar = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  calendar: 'gregory',
  timeZone: 'Asia/Riyadh',
});
export function registrationDay(date: string) {
  const time = new Date(date);
  if (!Number.isFinite(time.getTime())) return '';
  const parts = dayCalendar.formatToParts(time);
  return ['year', 'month', 'day'].map((key) => parts.find((p) => p.type === key)!.value).join('-');
}
export function completionMinutes(p: AnalyticsParticipant) {
  if (!p.submitted_at || !p.attempt_started_at) return null;
  const minutes =
    (new Date(p.submitted_at).getTime() - new Date(p.attempt_started_at).getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}
export function scoreDistribution(people: AnalyticsParticipant[]) {
  const bins = [0, 20, 40, 60, 80].map((min) => ({
    label: min === 80 ? '80–100٪' : `${min}–<${min + 20}٪`,
    count: 0,
  }));
  for (const p of people) {
    const score = scorePercentage(p);
    if (score !== null && score >= 0 && score <= 100)
      bins[Math.min(4, Math.floor(score / 20))].count++;
  }
  return bins;
}
export function durationDistribution(people: AnalyticsParticipant[]) {
  const bins = ['أقل من 15', '15–<30', '30–<60', '60–<120', '120 فأكثر'].map((label) => ({
    label,
    count: 0,
  }));
  for (const p of people) {
    const minutes = completionMinutes(p);
    if (minutes !== null)
      bins[minutes < 15 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4].count++;
  }
  return bins;
}
export function registrationTimeline(people: AnalyticsParticipant[]) {
  const counts = new Map<string, number>();
  for (const p of people) {
    const day = registrationDay(p.created_at);
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  let total = 0;
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count, cumulative: (total += count) }));
}
export const readingFlagNames = {
  page_jump: 'قفز صفحات',
  rapid_page_turn: 'تصفح سريع',
  rapid_answers: 'إجابات متقاربة',
} as const;
export function readingObservations(people: AnalyticsParticipant[]) {
  return Object.entries(readingFlagNames).map(([key, label]) => ({
    label,
    count: people.filter((p) => p.attempt_id && p.reading_flags?.includes(key)).length,
  }));
}
export function institutionParticipation(people: AnalyticsParticipant[]) {
  const groups = new Map<string, AnalyticsParticipant[]>();
  for (const p of people) {
    const institution = p.institution?.trim().replace(/\s+/g, ' ');
    if (!institution) continue;
    const key = JSON.stringify([institution, p.locality.trim()]);
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  return [...groups]
    .map(([key, rows]) => {
      const [label, city] = JSON.parse(key) as [string, string];
      return { label, city, ...summarize(rows) };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'ar'));
}
