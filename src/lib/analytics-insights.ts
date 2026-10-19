import { completionMinutes, scorePercentage, type AnalyticsParticipant } from './analytics';

// Pure rules for the deeper analytics views. No database and no React: unit-tested.
// Every group smaller than SMALL_GROUP is reported as "fewer than 5", never as an exact count
// or a rate, so a small city or school cannot be singled out.
export const SMALL_GROUP = 5;
export const SOURCE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;
// Accepts a post link code from a URL or the registration form; anything else is dropped.
export function cleanSource(value: unknown) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return SOURCE_PATTERN.test(code) ? code : null;
}
export const isSmall = (n: number) => n > 0 && n < SMALL_GROUP;

// What the server adds per participant of the current competition (actual data only).
export type InsightAttempt = {
  readSeconds: number;
  readEvents: number;
  answered: number;
  furthest: number;
  questionCount: number;
  recovered: boolean;
};
export type InsightRow = {
  id: string;
  source: string | null;
  sharedPhone: boolean;
  attempt: InsightAttempt | null;
};
export type ItemStat = {
  questionId: string;
  title: string;
  topic: string;
  n: number;
  correct: number;
  difficulty: number;
  discrimination: number | null;
};
export type StageItems = { submitted: number; items: ItemStat[] };
export type OtpHour = { hour: string; sent: number; failed: number };
// One row per time the exam moved a student's book to the answer page (see recordGuide).
export type GuidanceRow = {
  attemptId: string;
  label: string;
  stage: string;
  city: string;
  questionId: string;
  title: string;
  gap: string;
};
export type GuidanceSet = { started: Record<string, number>; rows: GuidanceRow[] };
export type InsightsData = {
  rows: InsightRow[];
  items: Record<string, StageItems>;
  guidance?: { participants: GuidanceSet; tests: GuidanceSet };
  otp: { enabled: boolean; hours: OtpHour[] };
  // Media centre post titles by link code, so the source list names the post.
  postNames?: Record<string, string>;
  generatedAt: string;
};

export type Joined = AnalyticsParticipant & { insight?: InsightRow };
export function joinInsights(people: AnalyticsParticipant[], rows: InsightRow[] | undefined) {
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return people.map((p): Joined => ({ ...p, insight: byId.get(p.id) }));
}

// Registered → started → opened the book → answered → submitted.
export function participationFunnel(people: Joined[]) {
  const started = people.filter((p) => p.attempt_id);
  const steps = [
    { key: 'registered', label: 'سجّلوا', count: people.length },
    { key: 'started', label: 'بدأوا المحاولة', count: started.length },
    {
      key: 'opened',
      label: 'فتحوا الكتاب',
      count: started.filter((p) => (p.insight?.attempt?.readEvents ?? 0) > 0).length,
    },
    {
      key: 'answered',
      label: 'أجابوا عن سؤال',
      count: started.filter((p) => p.submitted_at || (p.insight?.attempt?.answered ?? 0) > 0)
        .length,
    },
    {
      key: 'submitted',
      label: 'أرسلوا المشاركة',
      count: people.filter((p) => p.submitted_at).length,
    },
  ];
  return steps.map((step, i) => ({
    ...step,
    ofStart: people.length ? (step.count / people.length) * 100 : null,
    fromPrevious: i && steps[i - 1].count ? (step.count / steps[i - 1].count) * 100 : null,
  }));
}
// The step with the largest share lost from the step before it.
export function biggestLoss(funnel: ReturnType<typeof participationFunnel>) {
  let worst: { from: string; to: string; lost: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const lost = funnel[i - 1].count - funnel[i].count;
    if (lost > 0 && (!worst || lost > worst.lost))
      worst = { from: funnel[i - 1].label, to: funnel[i].label, lost };
  }
  return worst;
}

// For started but unsent attempts: how far each got (the furthest question answered).
export function dropOff(people: Joined[], stage: string) {
  const open = people.filter(
    (p) => p.stage === stage && p.attempt_id && !p.submitted_at && p.insight?.attempt,
  );
  const length = Math.max(0, ...open.map((p) => p.insight!.attempt!.questionCount));
  const bins = Array.from({ length: length + 1 }, (_, i) => ({ question: i, count: 0 }));
  for (const p of open) bins[Math.min(length, p.insight!.attempt!.furthest)].count++;
  const peak = bins.slice(1).reduce((best, b) => (b.count > best.count ? b : best), {
    question: 0,
    count: 0,
  });
  return {
    total: open.length,
    questionCount: length,
    bins,
    peak: peak.count ? peak.question : null,
  };
}

const riyadhParts = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Riyadh',
});
export const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
// Registrations by weekday and hour, Riyadh time.
export function registrationHeat(people: AnalyticsParticipant[]) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const p of people) {
    const time = new Date(p.created_at);
    if (!Number.isFinite(time.getTime())) continue;
    const parts = riyadhParts.formatToParts(time);
    const day = weekdayIndex[parts.find((x) => x.type === 'weekday')!.value];
    const hour = Number(parts.find((x) => x.type === 'hour')!.value) % 24;
    grid[day][hour]++;
  }
  let peak = { day: 0, hour: 0, count: 0 };
  grid.forEach((row, day) =>
    row.forEach((count, hour) => {
      if (count > peak.count) peak = { day, hour, count };
    }),
  );
  return { grid, peak: peak.count ? peak : null, max: peak.count };
}

const average = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

// Per city: size, completion rate and average score. Rates only for groups of 5 or more.
export function cityPerformance(people: AnalyticsParticipant[]) {
  const groups = new Map<string, AnalyticsParticipant[]>();
  for (const p of people) {
    const city = p.locality?.trim() || 'غير مسجل';
    groups.set(city, [...(groups.get(city) ?? []), p]);
  }
  return [...groups]
    .map(([city, rows]) => {
      const small = rows.length < SMALL_GROUP;
      const completed = rows.filter((p) => p.submitted_at).length;
      return {
        city,
        total: rows.length,
        small,
        completion: small ? null : (completed / rows.length) * 100,
        average: small
          ? null
          : average(rows.map(scorePercentage).filter((n): n is number => n !== null)),
      };
    })
    .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city, 'ar'));
}

// Completion rate for every stage and city pair.
export function stageCityMatrix(people: AnalyticsParticipant[], stages: string[]) {
  const cities = cityPerformance(people).map((c) => c.city);
  return {
    cities,
    cells: cities.map((city) =>
      stages.map((stage) => {
        const rows = people.filter(
          (p) => (p.locality?.trim() || 'غير مسجل') === city && p.stage === stage,
        );
        const done = rows.filter((p) => p.submitted_at).length;
        return {
          total: rows.length,
          small: isSmall(rows.length),
          rate: rows.length >= SMALL_GROUP ? (done / rows.length) * 100 : null,
        };
      }),
    ),
  };
}

export function pearson(points: { x: number; y: number }[]) {
  if (points.length < 3) return null;
  const mx = average(points.map((p) => p.x))!,
    my = average(points.map((p) => p.y))!;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
// Reading minutes against score, for submitted attempts with server reading data.
export function readingAgainstScore(people: Joined[]) {
  const points = people
    .filter((p) => p.submitted_at && p.insight?.attempt)
    .map((p) => ({
      id: p.id,
      x: p.insight!.attempt!.readSeconds / 60,
      y: scorePercentage(p) ?? 0,
    }));
  return { points, r: pearson(points) };
}

// Registrations and completion by post link code.
export function sourceAttribution(people: Joined[]) {
  const groups = new Map<string, Joined[]>();
  for (const p of people) {
    const source = p.insight?.source ?? '';
    groups.set(source, [...(groups.get(source) ?? []), p]);
  }
  return [...groups]
    .map(([source, rows]) => ({
      source,
      total: rows.length,
      small: isSmall(rows.length),
      completion:
        rows.length >= SMALL_GROUP
          ? (rows.filter((p) => p.submitted_at).length / rows.length) * 100
          : null,
    }))
    .sort((a, b) => Number(!a.source) - Number(!b.source) || b.total - a.total);
}

// Signals for the committee to review. None of them decides anything on its own.
export function reviewSignals(people: Joined[]) {
  const completed = people.filter((p) => p.submitted_at);
  const minutes = completed
    .map(completionMinutes)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  const median = minutes.length ? minutes[Math.floor(minutes.length / 2)] : null;
  const has = (p: Joined, flag: string) => p.attempt_id && p.reading_flags?.includes(flag);
  return [
    {
      key: 'reading',
      label: 'ملاحظات على تصفح المصدر',
      note: 'قفز أو تقليب سريع للصفحات',
      count: people.filter((p) => has(p, 'page_jump') || has(p, 'rapid_page_turn')).length,
    },
    {
      key: 'rapid',
      label: 'إجابات متتابعة سريعة',
      note: 'أقل من ثانية ونصف بين سؤالين',
      count: people.filter((p) => has(p, 'rapid_answers')).length,
    },
    {
      key: 'fast',
      label: 'إكمال سريع بدرجة عالية',
      note: 'أقل من ربع الوقت الوسيط و٩٠٪ فأكثر',
      count:
        median === null
          ? 0
          : completed.filter((p) => {
              const m = completionMinutes(p);
              return m !== null && m < median / 4 && (scorePercentage(p) ?? 0) >= 90;
            }).length,
    },
    {
      key: 'unread',
      label: 'إرسال بقراءة أقل من دقيقة',
      note: 'وقت القراءة المحتسب في الكتاب',
      count: completed.filter((p) => p.insight?.attempt && p.insight.attempt.readSeconds < 60)
        .length,
    },
    {
      key: 'phone',
      label: 'جوال مشترك بين حسابات',
      note: 'ضمن الحد المسموح، للتحقق عند الفوز',
      count: people.filter((p) => p.insight?.sharedPhone).length,
    },
    {
      key: 'recovered',
      label: 'محاولات مستعادة',
      note: 'بقرار موثّق من اللجنة',
      count: people.filter((p) => p.insight?.attempt?.recovered).length,
    },
  ];
}

// Question health: hard, easy or weakly related to the overall score.
export const DISCRIMINATION_FLOOR = 0.2;
export function itemVerdict(item: ItemStat) {
  if (item.n < SMALL_GROUP) return 'small';
  if (item.discrimination !== null && item.discrimination < DISCRIMINATION_FLOOR) return 'review';
  if (item.difficulty < 20) return 'hard';
  if (item.difficulty > 95) return 'easy';
  return 'ok';
}
// Point-biserial correlation between one question and the total percentage.
export function pointBiserial(
  correctMean: number | null,
  wrongMean: number | null,
  sd: number,
  p: number,
) {
  if (correctMean === null || wrongMean === null || !sd || p <= 0 || p >= 1) return null;
  return ((correctMean - wrongMean) / sd) * Math.sqrt(p * (1 - p));
}

// Which questions sent students to the book most, and who leaned on the guidance most.
export function summarizeGuidance(set: GuidanceSet | undefined, stage: string) {
  const rows = (set?.rows ?? []).filter((r) => r.stage === stage);
  const questions = new Map<
    string,
    {
      questionId: string;
      title: string;
      events: number;
      attempts: Set<string>;
      gaps: Record<string, number>;
    }
  >();
  const people = new Map<
    string,
    { attemptId: string; label: string; city: string; events: number; questions: Set<string> }
  >();
  for (const r of rows) {
    const q = questions.get(r.questionId) ?? {
      questionId: r.questionId,
      title: r.title,
      events: 0,
      attempts: new Set<string>(),
      gaps: {},
    };
    q.events++;
    q.attempts.add(r.attemptId);
    q.gaps[r.gap] = (q.gaps[r.gap] ?? 0) + 1;
    questions.set(r.questionId, q);
    const p = people.get(r.attemptId) ?? {
      attemptId: r.attemptId,
      label: r.label,
      city: r.city,
      events: 0,
      questions: new Set<string>(),
    };
    p.events++;
    p.questions.add(r.questionId);
    people.set(r.attemptId, p);
  }
  const started = set?.started[stage] ?? 0;
  return {
    events: rows.length,
    guided: people.size,
    started,
    perAttempt: people.size ? rows.length / people.size : 0,
    questions: [...questions.values()]
      .map((q) => ({ ...q, attempts: q.attempts.size }))
      .sort((a, b) => b.events - a.events || b.attempts - a.attempts),
    people: [...people.values()]
      .map((p) => ({ ...p, questions: p.questions.size }))
      .sort((a, b) => b.events - a.events || b.questions - a.questions),
  };
}
