import type { AnalyticsParticipant } from '../analytics';

// Analytics visuals that can become posters, and the hand-off from the analytics page.
// Internal views (question health, reading time, review signals, OTP, post sources) are not here.
export type ChartKind =
  | 'cities'
  | 'stages'
  | 'gender'
  | 'scores'
  | 'trend'
  | 'duration'
  | 'map'
  | 'schools'
  | 'funnel'
  | 'heat'
  | 'bubbles'
  | 'matrix';
export const chartKinds: { id: ChartKind; name: string; kicker: string; title: string }[] = [
  {
    id: 'cities',
    name: 'المشاركة حسب المدينة',
    kicker: 'حسب المدينة',
    title: 'مدن الشرقية في المسابقة',
  },
  { id: 'map', name: 'خريطة المشاركة', kicker: 'خريطة المشاركة', title: 'الشرقية تقرأ معنا' },
  {
    id: 'stages',
    name: 'الإكمال حسب المرحلة',
    kicker: 'حسب المرحلة',
    title: 'كيف تتقدم المراحل الثلاث؟',
  },
  {
    id: 'gender',
    name: 'توزيع الذكور والإناث',
    kicker: 'المشاركون والمشاركات',
    title: 'معًا في المسابقة',
  },
  { id: 'scores', name: 'توزيع الدرجات', kicker: 'الدرجات', title: 'كيف أجاب المشاركون؟' },
  { id: 'trend', name: 'تراكم التسجيل', kicker: 'نمو المشاركة', title: 'المسابقة تكبر كل يوم' },
  { id: 'duration', name: 'وقت الإكمال', kicker: 'وقت الإكمال', title: 'كم استغرقت المشاركة؟' },
  {
    id: 'schools',
    name: 'المدارس والجامعات',
    kicker: 'الجهات التعليمية',
    title: 'مدارس وجامعات تقرأ معنا',
  },
  { id: 'funnel', name: 'مسار المشاركة', kicker: 'مسار المشاركة', title: 'من التسجيل إلى الإرسال' },
  { id: 'heat', name: 'متى يسجّل المشاركون', kicker: 'أوقات التسجيل', title: 'متى ينضم القرّاء؟' },
  {
    id: 'bubbles',
    name: 'المدن: الحجم والأداء',
    kicker: 'المدن الأعلى إكمالًا',
    title: 'مدن تقرأ وتُكمل',
  },
  {
    id: 'matrix',
    name: 'الإكمال حسب المرحلة والمدينة',
    kicker: 'المرحلة والمدينة',
    title: 'نسب الإكمال في الشرقية',
  },
];
export type PosterRequest = {
  chart: ChartKind;
  people: AnalyticsParticipant[];
  scope: string;
  at: number;
};
