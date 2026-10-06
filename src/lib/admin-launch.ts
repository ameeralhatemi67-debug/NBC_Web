// Pure rules for the committee launch control. No React, no network: unit-tested.
import {
  effectiveState,
  stageKeys,
  stageNames,
  type BookVersion,
  type Competition,
  type CompetitionQuestion,
  type Stage,
} from './competition-domain';
import { arPlural, riyadhDateTime, resultSentence } from './format';
import { leaderboardModeLines, resultHiddenLine, resultReceivedTitle } from './result-presentation';

export const QUESTIONS_PER_STAGE = 20;
export const HOLD_MS = 1100;
export const trackLabels = [
  'مسودة',
  'الأسئلة معتمدة',
  'مجدولة',
  'مفتوحة',
  'مغلقة',
  'النتائج منشورة',
] as const;
export type LaunchAction = 'freeze' | 'open' | 'close' | 'publish' | 'unpublish';
export type LaunchCounts = { registered: number; inProgress: number };

// Six steps from the effective state and the freeze mark. The raw state code never reaches the UI.
export function launchStep(c: Competition, now = Date.now()) {
  const state = effectiveState(c, now);
  if (state === 'DRAFT') return c.frozenAt ? 1 : 0;
  return { SCHEDULED: 2, OPEN: 3, CLOSED: 4, RESULTS_PUBLISHED: 5 }[state];
}

export function forRegistrants(n: number) {
  if (n === 1) return 'لمسجّل واحد';
  if (n === 2) return 'لمسجّلَين';
  return `لـ ${n} ${n >= 3 && n <= 10 ? 'مسجّلين' : 'مسجّلًا'}`;
}

export function impactSentence(action: LaunchAction, counts: LaunchCounts) {
  const n = counts.registered;
  if (action === 'open')
    return n
      ? `ستُتاح المسابقة فورًا ${forRegistrants(n)}. لا يمكن تعديل الأسئلة بعد الفتح.`
      : 'لا يوجد مسجّلون حتى الآن؛ ستُتاح المسابقة لمن يسجّل بعد الفتح. لا يمكن تعديل الأسئلة بعد الفتح.';
  if (action === 'close')
    return n
      ? `سيتوقف استلام مشاركات جديدة. من بين ${n} ${n >= 3 && n <= 10 ? 'مسجّلين' : 'مسجّلًا'}، ${arPlural(counts.inProgress, ['مشارك واحد', 'مشاركان', 'مشاركين', 'مشاركًا'])} قيد المشاركة الآن، وتبقى محاولاتهم القائمة وفق سياسة الإغلاق.`
      : 'سيتوقف استلام مشاركات جديدة. لا يوجد مسجّلون حتى الآن.';
  if (action === 'unpublish')
    return n
      ? `ستختفي النتائج والترتيب فورًا عن ${n} ${n >= 3 && n <= 10 ? 'مسجّلين' : 'مسجّلًا'}. يمكن إعادة النشر لاحقًا.`
      : 'ستختفي النتائج والترتيب فورًا. يمكن إعادة النشر لاحقًا.';
  if (action === 'publish')
    return 'تصبح النتيجة والترتيب ظاهرين للمشاركين وفق الإعداد المختار أدناه.';
  return 'تُثبَّت الأسئلة والكتاب لهذه النسخة. التعديل بعدها يُنشئ إصدارًا جديدًا ولا يغيّر المحاولات القائمة.';
}

export type NextAction = {
  step: number;
  title: string;
  description: string;
  label: string;
  action: LaunchAction;
  hold: boolean;
  danger: boolean;
};
// Exactly one primary action per step.
export function nextAction(step: number, counts: LaunchCounts): NextAction {
  const table: Record<number, Omit<NextAction, 'step' | 'description'> & { effect: LaunchAction }> =
    {
      0: {
        title: 'اعتمد نسخة الأسئلة',
        label: 'اعتمد نسخة الأسئلة',
        action: 'freeze',
        effect: 'freeze',
        hold: false,
        danger: false,
      },
      1: {
        title: 'افتح المسابقة',
        label: 'اضغط مطولًا لفتح المسابقة',
        action: 'open',
        effect: 'open',
        hold: true,
        danger: false,
      },
      2: {
        title: 'المسابقة مجدولة',
        label: 'اضغط مطولًا للفتح الآن',
        action: 'open',
        effect: 'open',
        hold: true,
        danger: false,
      },
      3: {
        title: 'أغلق المسابقة',
        label: 'اضغط مطولًا للإغلاق',
        action: 'close',
        effect: 'close',
        hold: true,
        danger: false,
      },
      4: {
        title: 'اعتمد نشر النتائج',
        label: 'اعتمد نشر النتائج',
        action: 'publish',
        effect: 'publish',
        hold: false,
        danger: false,
      },
      5: {
        title: 'النتائج منشورة',
        label: 'اضغط مطولًا لسحب النشر',
        action: 'unpublish',
        effect: 'unpublish',
        hold: true,
        danger: true,
      },
    };
  const { effect, ...rest } = table[step];
  const description =
    step === 2
      ? `ستفتح تلقائيًا في الموعد المحدد. ${impactSentence('open', counts)}`
      : impactSentence(effect, counts);
  return { step, description, ...rest };
}

export type StageReadiness = {
  stage: Stage;
  name: string;
  approved: number;
  drafts: number;
  active: number;
  ok: boolean;
  reason: string;
};
// Mirrors the server rule in validateBank: exactly 20 active questions, all approved.
export function stageReadiness(
  questions: CompetitionQuestion[],
  book: BookVersion,
): StageReadiness[] {
  return stageKeys.map((stage) => {
    const active = questions.filter(
      (q) => q.stage === stage && q.active && q.bookVersionId === book.id,
    );
    const approved = active.filter((q) => q.approved).length;
    const drafts = active.length - approved;
    const ok = active.length === QUESTIONS_PER_STAGE && drafts === 0;
    let reason = '';
    if (!ok) {
      if (active.length > QUESTIONS_PER_STAGE)
        reason = `يوجد ${active.length} سؤالًا نشطًا. عطّل الزائد ليبقى 20 بالضبط.`;
      else if (approved < QUESTIONS_PER_STAGE)
        reason = `ينقص ${QUESTIONS_PER_STAGE - approved} من الأسئلة المعتمدة.`;
      if (drafts > 0) reason += ` ${drafts} مسودات نشطة تمنع الاعتماد.`;
    }
    return {
      stage,
      name: stageNames[stage],
      approved,
      drafts,
      active: active.length,
      ok,
      reason: reason.trim(),
    };
  });
}

export type Precondition = {
  id: string;
  ok: boolean;
  informational?: boolean;
  label: string;
  detail: string;
  stage?: Stage;
};
export function preconditions(book: BookVersion, questions: CompetitionQuestion[]) {
  const stages = stageReadiness(questions, book);
  const list: Precondition[] = [
    {
      id: 'book',
      ok: book.approved,
      label: book.approved ? 'ملف الكتاب معتمد' : 'ملف الكتاب بانتظار الاعتماد',
      detail: `${book.pageCount} صفحة PDF`,
    },
    ...stages.map((s) => ({
      id: `stage-${s.stage}`,
      ok: s.ok,
      label: s.name,
      detail: `${s.approved} من ${QUESTIONS_PER_STAGE} سؤالًا معتمدًا${s.reason ? ` · ${s.reason}` : ''}`,
      stage: s.stage,
    })),
    {
      // Informational until the backend records rehearsals against a question version.
      id: 'rehearsal',
      ok: false,
      informational: true,
      label: 'جرّب المسابقة قبل الفتح',
      detail: 'تجربة الإدارة تفتح بواجهة الطالب نفسها. لا تمنع اعتماد النسخة.',
    },
  ];
  return { list, canFreeze: list.filter((p) => !p.informational).every((p) => p.ok), stages };
}

export function scheduleIssue(opensAt: string | null, closesAt: string | null, now = Date.now()) {
  if (!opensAt || !closesAt) return 'حدّد موعدي الفتح والإغلاق أولًا.';
  if (Date.parse(closesAt) <= Date.parse(opensAt)) return 'يجب أن يكون الإغلاق بعد الفتح.';
  if (Date.parse(closesAt) <= now) return 'موعد الإغلاق مضى.';
  return '';
}

const units = {
  minute: ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'],
  hour: ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'],
} as const;
export function relativePhrase(iso: string, now: number) {
  const diff = Date.parse(iso) - now;
  const future = diff >= 0;
  const abs = Math.abs(diff);
  const prefix = future ? 'بعد' : 'منذ';
  if (abs < 60000) return future ? 'الآن تقريبًا' : 'قبل لحظات';
  if (abs < 3600000) return `${prefix} ${arPlural(Math.round(abs / 60000), units.minute)}`;
  if (abs < 86400000) return `${prefix} ${arPlural(Math.round(abs / 3600000), units.hour)}`;
  const days = Math.round(abs / 86400000);
  if (days === 1) return future ? 'غدًا' : 'أمس';
  return `${prefix} ${arPlural(days, ['يوم واحد', 'يومين', 'أيام', 'يومًا'])}`;
}

export function graceSentence(closesAt: string | null, minutes: number) {
  if (!closesAt) return 'حدّد موعد الإغلاق لتظهر نهاية مهلة المزامنة.';
  const until = new Date(Date.parse(closesAt) + Math.max(0, minutes) * 60000).toISOString();
  return `تبقى المحاولات القائمة قابلة للمزامنة حتى ${riyadhDateTime(until)}.`;
}

export const settingKeys = [
  'title',
  'opensAt',
  'closesAt',
  'leaderboardMode',
  'closingPolicy',
  'graceMinutes',
] as const;
export type SettingKey = (typeof settingKeys)[number];
export function changedSettings(saved: Competition, current: Competition): SettingKey[] {
  return settingKeys.filter((key) => {
    if (
      key === 'graceMinutes' &&
      current.closingPolicy === 'immediate' &&
      saved.closingPolicy === 'immediate'
    )
      return false;
    return saved[key] !== current[key];
  });
}

export const leaderboardCards: {
  value: Competition['leaderboardMode'];
  title: string;
  detail: string;
}[] = [
  {
    value: 'hidden',
    title: 'محجوب كليًا',
    detail: 'لا نتيجة ولا ترتيب. تعلن اللجنة كل شيء بنفسها.',
  },
  {
    value: 'own_result_only',
    title: 'النتيجة الشخصية فقط',
    detail: 'كل مشارك يرى نتيجته. الفائزون تعلنهم اللجنة.',
  },
  {
    value: 'publish_after_close',
    title: 'النتيجة الشخصية، والترتيب بعد الإغلاق',
    detail: 'يظهر الترتيب بعد إغلاق المسابقة واعتماد النشر.',
  },
  { value: 'public_live', title: 'ترتيب عام مباشر', detail: 'يتغير الترتيب مع كل مشاركة.' },
];
const rankingNotes: Partial<Record<Competition['leaderboardMode'], string>> = {
  publish_after_close: 'يظهر جدول ترتيب المرحلة بعد اعتماد نشر النتائج.',
  public_live: 'يظهر جدول ترتيب المرحلة تحت النتيجة ويتحدث مباشرة.',
};
// Built from the student screen's own strings so the preview cannot drift from it.
export function studentResultPreview(mode: Competition['leaderboardMode']) {
  return {
    title: resultReceivedTitle,
    sentence: mode === 'hidden' ? resultHiddenLine : resultSentence(14, 20),
    policy: leaderboardModeLines[mode],
    ranking: rankingNotes[mode] ?? '',
  };
}
