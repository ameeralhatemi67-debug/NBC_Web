import { faqs as defaultFaqs } from './content';
import { AppError } from './domain';
import { updateMeetingCopy } from './meeting-copy';

// Public wording the committee can edit without a release. Anything not saved falls back to
// these defaults, so a database outage never blanks the public pages.
export type SiteContent = {
  version: number;
  heroIntro: string;
  aboutIntro: string;
  aboutDetails: string;
  bookTopics: string[];
  faqs: { q: string; a: string }[];
  rules: string[];
};
export const defaultSiteContent: SiteContent = {
  version: 0,
  heroIntro: 'نقرأ لنفهم معنى الانتماء، ونشارك في تعزيز اللحمة الوطنية. رحلة معرفية تبدأ بصفحة.',
  aboutIntro:
    'مسابقة معرفية تنطلق من كتاب «الانتماء واللحمة الوطنية» لعبدالرحمن بن عبدالله السند، لتعزيز قيم الانتماء الوطني والولاء للوطن وقيادته، وترسيخ التماسك المجتمعي والوعي الفكري.',
  aboutDetails:
    'تجمع بين القراءة والتحليل والتنافس العادل، وتدعو الشباب إلى فهم دورهم في حماية المكتسبات الوطنية وتعزيز الهوية الوطنية في ضوء رؤية المملكة 2030.',
  bookTopics: [
    'تعريف الوطن والمواطنة والانتماء واللحمة الوطنية.',
    'تأصيل الانتماء للوطن ومحبته في نصوص الوحيين.',
    'الانتماء والمواطنة في حياة السلف الصالح.',
    'الانتماء واللحمة الوطنية في الشريعة.',
    'حقوق الانتماء إلى الوطن.',
    'محاذير لا بد من التنبه لها.',
  ],
  faqs: defaultFaqs.map(({ q, a }) => ({ q, a: updateMeetingCopy(a) })),
  rules: [
    'تهدف المسابقة إلى نشر وتعزيز الوعي بمضامين كتاب «الانتماء واللحمة الوطنية»، وترسيخ قيم الانتماء واللحمة الوطنية لدى أفراد المجتمع.',
    'المشاركة متاحة لطلاب وطالبات المرحلتين المتوسطة والثانوية، وطلاب وطالبات الجامعات والكليات المعتمدة بالمنطقة الشرقية، في المدارس والجهات التعليمية الحكومية والأهلية والعالمية.',
    'يلتزم المشارك بإدخال بيانات صحيحة، ويتحمل مسؤولية صحة المعلومات المدخلة.',
    'لا يحق للشخص الواحد المشاركة أكثر من مرة، ويترتب على تكرار المشاركة استبعاد جميع المشاركات المخالفة.',
    'تعتمد الأسئلة على كتاب «الانتماء واللحمة الوطنية»، مع ثلاثة أسئلة عن الجهة المنظمة تستند إلى مصادر رسمية في كل مرحلة. جميع الأسئلة موضوعية.',
    'تتيح المنصة للمشارك الرجوع إلى الأسئلة السابقة والاستفادة من الكتاب أثناء الإجابة.',
    'لا يوجد وقت محدد للإجابة، وتستمر المشاركة طوال المدة المعلنة للمسابقة.',
    'يمكن تعديل جميع الإجابات حتى الإرسال النهائي. تظهر الإجابات الصحيحة والتوضيحات بعد استلام المشاركة نهائيًا.',
    'يتم احتساب النتائج إلكترونيًا وفق أعلى الدرجات المحققة.',
    'لا يعتمد الوقت معيارًا للمفاضلة بين المشاركين عند تساوي الدرجات.',
    'للجنة المنظمة الحق في اعتماد آلية مناسبة للترجيح عند الحاجة.',
    'تخضع النتائج للمراجعة والتدقيق قبل إعلانها واعتمادها.',
    'للجنة المنظمة طلب ما يثبت أهلية الفائز وصحة بياناته قبل اعتماد الجائزة.',
    'يحق للجنة المنظمة استبعاد أي مشاركة يثبت مخالفتها لشروط المسابقة أو الإخلال بمبادئ النزاهة والعدالة.',
    'يحق للجهة المنظمة تعديل أو تفسير هذه الشروط بما يحقق أهداف المسابقة ومقتضيات المصلحة العامة.',
  ].map(updateMeetingCopy),
};
export const siteContentLimits = {
  heroIntro: 300,
  paragraph: 1000,
  topic: 200,
  topics: 20,
  question: 200,
  answer: 1500,
  faqs: 30,
  rule: 600,
  rules: 40,
};
const text = (value: unknown, max: number, label: string, required = true) => {
  const out = typeof value === 'string' ? value.replace(/\r/g, '').trim() : '';
  if (
    (required && !out) ||
    out.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(out)
  )
    throw new AppError(`${label} غير صالح أو أطول من ${max} حرفًا.`);
  return out;
};
function list<T>(value: unknown, max: number, label: string, each: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new AppError(`${label} غير صالحة.`);
  if (value.length > max) throw new AppError(`الحد الأقصى لـ${label} هو ${max}.`);
  return value.map(each);
}
// Plain text only: pages render it as text, never as HTML.
export function validateSiteContent(body: Record<string, unknown>): SiteContent {
  const l = siteContentLimits;
  if (!Number.isSafeInteger(body.version)) throw new AppError('إعدادات المحتوى غير صالحة.');
  return {
    version: Number(body.version),
    heroIntro: text(body.heroIntro, l.heroIntro, 'نص الواجهة'),
    aboutIntro: text(body.aboutIntro, l.paragraph, 'فقرة التعريف الأولى'),
    aboutDetails: text(body.aboutDetails, l.paragraph, 'فقرة التعريف الثانية', false),
    bookTopics: list(body.bookTopics, l.topics, 'المحاور', (t) => text(t, l.topic, 'المحور')),
    faqs: list(body.faqs, l.faqs, 'الأسئلة الشائعة', (item) => {
      const f = (item ?? {}) as Record<string, unknown>;
      return { q: text(f.q, l.question, 'السؤال'), a: text(f.a, l.answer, 'الجواب') };
    }),
    rules: list(body.rules, l.rules, 'الشروط', (r) => text(r, l.rule, 'الشرط')),
  };
}
