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
  return {
    total: people.length,
    completed: people.filter((p) => p.submitted_at).length,
    average: scores.length ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null,
    institutions: new Set(people.map((p) => p.institution).filter(Boolean)).size,
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
