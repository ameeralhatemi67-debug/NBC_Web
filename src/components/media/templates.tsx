'use client';
import type { ReactNode } from 'react';
import type { AnalyticsParticipant } from '@/lib/analytics';
import type { LinkTarget } from '@/lib/media/codes';
import {
  arNumber,
  arPercent,
  CITIES,
  countOf,
  daysWord,
  ENTRIES,
  PEOPLE,
  PEOPLE_SHORT,
  pluralNoun,
  hoursWord,
  publicCount,
  riyadhLongDate,
  riyadhTime,
  SCHOOL_FLOOR,
  type MediaFacts,
} from '@/lib/media/facts';
import { isSmall } from '@/lib/analytics-insights';
import {
  cols,
  fitBlock,
  gold,
  inset,
  Lines,
  Mark,
  rows,
  Star,
  usePoster,
  type Align,
  type Box,
  type Layout,
  type Palette,
  type Tone,
} from './poster-kit';
import {
  archInner,
  ArchBar,
  ArchWindow,
  BookCover,
  fitArch,
  Kicker,
  kickerHeight,
  Medallion,
  Spark,
  splitArea,
  Steps,
} from './scenes';
import { ChartBody, chartKinds, chartDefaults, chartFacts, type ChartKind } from './chart-posters';
import { RegionMap } from './scenes';

export type GroupId = 'invite' | 'live' | 'countdown' | 'prizes' | 'charts';
export const templateGroups: { id: GroupId; name: string; note: string }[] = [
  { id: 'invite', name: 'دعوة وإطلاق', note: 'منشورات تعرّف بالمسابقة وتدعو للتسجيل' },
  { id: 'live', name: 'أرقام حيّة', note: 'تُقرأ من بيانات المسابقة الفعلية لحظة بلحظة' },
  { id: 'countdown', name: 'العد التنازلي', note: 'من موعد إغلاق المسابقة بتوقيت المملكة' },
  { id: 'prizes', name: 'الجوائز والنتائج', note: 'من إعدادات الجوائز وحالة المسابقة' },
  { id: 'charts', name: 'رسوم من التحليلات', note: 'أي رسم من صفحة التحليلات بهوية المسابقة' },
];
export type TemplateOptions = {
  chart: ChartKind;
  school: number;
  people: AnalyticsParticipant[];
  scope: string;
};
export type Check = { label: string; ok: boolean; note?: string };
export type RenderArgs = {
  P: Palette;
  L: Layout;
  id: (n: string) => string;
  F: MediaFacts;
  T: Record<string, string>;
  o: TemplateOptions;
};
export type SlotDef = { key: string; label: string; long?: boolean };
export type PosterTemplate = {
  id: string;
  name: string;
  group: GroupId;
  blurb: string;
  tone: Tone;
  target: LinkTarget;
  live: boolean;
  slots: SlotDef[];
  defaults: (F: MediaFacts, o: TemplateOptions) => Record<string, string>;
  checks?: (F: MediaFacts, o: TemplateOptions, T: Record<string, string>) => Check[];
  facts?: (F: MediaFacts, o: TemplateOptions) => Record<string, string>;
  caption: (F: MediaFacts, T: Record<string, string>, o: TemplateOptions) => string;
  render: (a: RenderArgs) => ReactNode;
};

// ---------- a column of kicker, value, title, body and note ----------
type Part = {
  kind: 'kicker' | 'value' | 'title' | 'body' | 'note';
  text: string;
  slot: string;
  max?: number;
  min?: number;
  lines?: number;
  share?: number;
};
function TextStack({
  box,
  parts,
  align = 'right',
  valign = 'middle',
}: {
  box: Box;
  parts: Part[];
  align?: Align;
  valign?: 'top' | 'middle' | 'bottom';
}) {
  const { P, L, id } = usePoster();
  const u = L.u * L.k;
  const visible = parts.filter((p) => p.text.trim());
  const budget = { value: 0.44, title: 0.36, body: 0.24, note: 0.14, kicker: 0.1 };
  const gapAfter = { kicker: 2.2 * u, value: 0.6 * u, title: 1.8 * u, body: 1.4 * u, note: 0 };
  // Fit every block, then shrink the shares until the whole stack fits its box.
  const layoutAt = (share: number) =>
    visible.map((p) => {
      if (p.kind === 'kicker') return { p, height: kickerHeight(u), block: null };
      const spec =
        p.kind === 'value'
          ? {
              font: 'display' as const,
              size: [p.min ?? 7 * u, p.max ?? 22 * u] as [number, number],
              lines: p.lines ?? 1,
              lh: 1.18,
            }
          : p.kind === 'title'
            ? {
                font: 'display' as const,
                size: [p.min ?? 3.6 * u, p.max ?? 7.4 * u] as [number, number],
                lines: p.lines ?? 3,
              }
            : p.kind === 'body'
              ? {
                  font: 'body' as const,
                  weight: 500,
                  size: [p.min ?? 2.2 * u, p.max ?? 3.3 * u] as [number, number],
                  lines: p.lines ?? 3,
                }
              : {
                  font: 'body' as const,
                  weight: 400,
                  size: [p.min ?? 1.9 * u, p.max ?? 2.5 * u] as [number, number],
                  lines: p.lines ?? 2,
                };
      const k = p.kind === 'value' ? 1 : L.k;
      const scaled = {
        ...spec,
        size: [spec.size[0], spec.size[1] * (p.max ? k : 1)] as [number, number],
      };
      const block = fitBlock(P, {
        text: p.text,
        w: box.w,
        h: box.h * (p.share ?? budget[p.kind]) * share,
        ...scaled,
      });
      return { p, height: block.height, block };
    });
  const sum = (list: ReturnType<typeof layoutAt>) =>
    list.reduce((s, b, i) => s + b.height + (i < list.length - 1 ? gapAfter[b.p.kind] : 0), 0);
  let share = 1;
  let blocks = layoutAt(share);
  for (let i = 0; i < 6 && sum(blocks) > box.h; i++) {
    share *= Math.max(0.6, (box.h / sum(blocks)) * 0.97);
    blocks = layoutAt(share);
  }
  const total = sum(blocks);
  let y =
    valign === 'top'
      ? box.y
      : valign === 'middle'
        ? box.y + (box.h - total) / 2
        : box.y + box.h - total;
  const x = align === 'right' ? box.x + box.w : align === 'center' ? box.x + box.w / 2 : box.x;
  return (
    <g>
      {blocks.map((b, i) => {
        const top = y;
        y += b.height + gapAfter[b.p.kind];
        if (!b.block)
          return <Kicker key={i} x={x} y={top} text={b.p.text} align={align} slot={b.p.slot} />;
        return (
          <Lines
            key={i}
            block={b.block}
            x={x}
            y={top}
            align={align}
            slot={b.p.slot}
            fill={
              b.p.kind === 'value'
                ? gold(id)
                : b.p.kind === 'body'
                  ? P.soft
                  : b.p.kind === 'note'
                    ? P.faint
                    : P.ink
            }
            glow={b.p.kind === 'value' && P.tone === 'dark'}
          />
        );
      })}
    </g>
  );
}

const STEP_TEXT = {
  s1: 'سجّل حضورك',
  d1: 'أنشئ حسابك وحدد مرحلتك التعليمية',
  s2: 'اقرأ الكتاب',
  d2: 'تصفّحه على مهل وارجع إليه متى شئت',
  s3: 'شارك بمعرفتك',
  d3: 'أجب عن أسئلة مرحلتك وأرسل مشاركتك',
};
const stepItems = (T: Record<string, string>) => [
  { n: '١', title: T.s1, text: T.d1, slot: 's1' },
  { n: '٢', title: T.s2, text: T.d2, slot: 's2' },
  { n: '٣', title: T.s3, text: T.d3, slot: 's3' },
];
const HASHTAGS = '#مسابقة_الانتماء_واللحمة_الوطنية #معرفة_تجمعنا #المنطقة_الشرقية';
export const hashtags = HASHTAGS;
const QUOTE_PLACEHOLDER = 'اكتب هنا اقتباسًا من كتاب المسابقة، ثم اذكر رقم صفحته في السطر الأخير.';
const FACT_PLACEHOLDER =
  'اكتب هنا معلومة من كتاب المسابقة تثير فضول القارئ، ودع تفاصيلها لمن يقرأ الكتاب.';
const align = (stacked: boolean): Align => (stacked ? 'center' : 'right');

// A visual box with room above for the arch's keystone star.
const roomy = (b: Box, u: number): Box => ({ ...b, y: b.y + 1.6 * u, h: b.h - 1.6 * u });

function cityRows(F: MediaFacts) {
  return F.cities.filter((c) => !isSmall(c.total)).slice(0, 5);
}

export const templates: PosterTemplate[] = [
  // ---------------- invite ----------------
  {
    id: 'gate',
    name: 'بوابة المعرفة',
    group: 'invite',
    blurb: 'الكتاب في قوس مضيء مع دعوة للتسجيل',
    tone: 'dark',
    target: 'register',
    live: false,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      kicker: 'معرفة تجمعنا',
      title: 'اقرأ الكتاب، وشارك بمعرفتك',
      body: 'مسابقة لطلاب المرحلة المتوسطة والثانوية والجامعية في المنطقة الشرقية',
      cta: 'سجّل الآن وابدأ رحلتك مع الكتاب',
      ...STEP_TEXT,
    }),
    caption: (_F, T) => `${T.title}. ${T.body}.`,
    render: ({ L, T }) => {
      const u = L.u;
      const a = splitArea(L, 0.43, L.shape === 'tall' ? 0.5 : 0.56);
      const arch = fitArch(roomy(a.visual, u), 1.3);
      const inner = archInner(arch, u);
      const textBox = L.shape === 'tall' ? rows(a.text, [0.62, 0.38], 2 * u) : [a.text];
      return (
        <g>
          <ArchWindow box={arch} />
          <BookCover
            cx={inner.x + inner.w / 2}
            cy={inner.y + inner.h * 0.6}
            h={inner.h * 0.62}
            rot={-5}
          />
          <TextStack
            box={textBox[0]}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', max: 8 * u },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
          {textBox[1] && (
            <Steps box={inset(textBox[1], u)} items={stepItems(T)} vertical={false} compact />
          )}
        </g>
      );
    },
  },
  {
    id: 'steps',
    name: 'كيف تشارك',
    group: 'invite',
    blurb: 'ثلاث خطوات واضحة من التسجيل إلى الإرسال',
    tone: 'light',
    target: 'register',
    live: false,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 's1', label: 'الخطوة الأولى' },
      { key: 'd1', label: 'شرح الخطوة الأولى' },
      { key: 's2', label: 'الخطوة الثانية' },
      { key: 'd2', label: 'شرح الخطوة الثانية' },
      { key: 's3', label: 'الخطوة الثالثة' },
      { key: 'd3', label: 'شرح الخطوة الثالثة' },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      kicker: 'كيف تشارك؟',
      title: 'ثلاث خطوات تفصلك عن المسابقة',
      cta: 'ابدأ الخطوة الأولى الآن',
      ...STEP_TEXT,
    }),
    caption: (_F, T) => `${T.title}: ${T.s1}، ثم ${T.s2}، ثم ${T.s3}.`,
    render: ({ L, T }) => {
      const u = L.u;
      if (L.wide) {
        const arch = fitArch(roomy(L.visual!, u), 1.3);
        const inner = archInner(arch, u);
        const [head, list] = rows(L.content, [0.3, 0.7], 2 * u);
        return (
          <g>
            <ArchWindow box={arch} />
            <BookCover
              cx={inner.x + inner.w / 2}
              cy={inner.y + inner.h * 0.6}
              h={inner.h * 0.62}
              rot={-5}
            />
            <TextStack
              box={head}
              valign="top"
              parts={[
                { kind: 'kicker', text: T.kicker, slot: 'kicker' },
                { kind: 'title', text: T.title, slot: 'title', lines: 1 },
              ]}
            />
            <Steps box={list} items={stepItems(T)} vertical />
          </g>
        );
      }
      const square = L.shape === 'square';
      const [head, list] = rows(L.content, square ? [0.3, 0.7] : [0.22, 0.78], 3 * u);
      return (
        <g>
          <TextStack
            box={head}
            align="center"
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', lines: 2, share: 0.62 },
            ]}
          />
          <Steps box={square ? list : inset(list, 2 * u)} items={stepItems(T)} vertical={!square} />
        </g>
      );
    },
  },
  {
    id: 'quote',
    name: 'اقتباس من الكتاب',
    group: 'invite',
    blurb: 'سطر من الكتاب بخط النسخ مع مصدره',
    tone: 'dark',
    target: 'book',
    live: false,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'quote', label: 'الاقتباس', long: true },
      { key: 'source', label: 'المصدر والصفحة' },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      kicker: 'من صفحات الكتاب',
      quote: QUOTE_PLACEHOLDER,
      source: 'كتاب الانتماء واللحمة الوطنية · صفحة —',
      cta: 'اقرأ الكتاب كاملًا وشارك في المسابقة',
    }),
    checks: (_F, _o, T) => [
      {
        label: 'اقتباس حقيقي من الكتاب',
        ok: T.quote.trim() !== QUOTE_PLACEHOLDER && !T.source.includes('—'),
        note: 'استبدل النص الافتراضي واذكر رقم الصفحة.',
      },
    ],
    caption: (_F, T) => `«${T.quote}» ${T.source}.`,
    render: ({ P, L, T, id }) => {
      const u = L.u;
      const area = L.content;
      const marks = (cx: number, y: number) => (
        <g>
          <line
            x1={cx - 16 * u}
            x2={cx - 2.4 * u}
            y1={y}
            y2={y}
            stroke={P.line}
            strokeWidth={0.12 * u}
            opacity={0.7}
          />
          <line
            x1={cx + 2.4 * u}
            x2={cx + 16 * u}
            y1={y}
            y2={y}
            stroke={P.line}
            strokeWidth={0.12 * u}
            opacity={0.7}
          />
          <Star cx={cx} cy={y} r={1.3 * u} fill={gold(id)} />
        </g>
      );
      if (L.wide) {
        const arch = fitArch(roomy(L.visual!, u), 1.3);
        const inner = archInner(arch, u);
        return (
          <g>
            <ArchWindow box={arch} />
            <BookCover
              cx={inner.x + inner.w / 2}
              cy={inner.y + inner.h * 0.6}
              h={inner.h * 0.62}
              rot={-5}
            />
            <QuoteBlock box={area} T={T} align="right" />
          </g>
        );
      }
      const [top, body, bottom] = rows(area, [0.08, 0.84, 0.08], u);
      return (
        <g>
          {marks(top.x + top.w / 2, top.y + top.h / 2)}
          <QuoteBlock box={inset(body, 2 * u)} T={T} align="center" />
          {marks(bottom.x + bottom.w / 2, bottom.y + bottom.h / 2)}
        </g>
      );
    },
  },
  {
    id: 'didyouknow',
    name: 'هل تعلم؟',
    group: 'invite',
    blurb: 'معلومة من الكتاب تثير الفضول',
    tone: 'light',
    target: 'book',
    live: false,
    slots: [
      { key: 'title', label: 'العنوان' },
      { key: 'fact', label: 'المعلومة', long: true },
      { key: 'note', label: 'السطر الأخير' },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      title: 'هل تعلم؟',
      fact: FACT_PLACEHOLDER,
      note: 'التفاصيل بين صفحات كتاب المسابقة',
      cta: 'اقرأ الكتاب وشارك بمعرفتك',
    }),
    checks: (_F, _o, T) => [
      {
        label: 'معلومة من الكتاب',
        ok: T.fact.trim() !== FACT_PLACEHOLDER,
        note: 'استبدل النص الافتراضي بمعلومة من الكتاب.',
      },
    ],
    caption: (_F, T) => `${T.title} ${T.fact}`,
    render: ({ P, L, T, id }) => {
      const u = L.u;
      const a = splitArea(L, 0.42, 0.42);
      const r = Math.min(a.visual.w, a.visual.h) * 0.36;
      const cx = a.visual.x + a.visual.w / 2,
        cy = a.visual.y + a.visual.h / 2;
      const q = fitBlock(P, {
        text: '؟',
        w: r * 1.4,
        h: r * 1.5,
        size: [r * 0.6, r * 1.15],
        lines: 1,
        lh: 1,
      });
      return (
        <g>
          <Medallion cx={cx} cy={cy} r={r} />
          <Lines block={q} x={cx} y={cy - q.height / 2 + r * 0.02} align="center" fill={gold(id)} />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'title', text: T.title, slot: 'title', lines: 1, max: 8.5 * u },
              { kind: 'body', text: T.fact, slot: 'fact', lines: 5, max: 4 * u, min: 2.4 * u },
              { kind: 'note', text: T.note, slot: 'note' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'launch',
    name: 'انطلقت المسابقة',
    group: 'invite',
    blurb: 'إعلان الانطلاق بموعده من إعدادات المسابقة',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'date', label: 'الموعد' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => {
      const open = F.state === 'OPEN';
      return {
        kicker: open ? 'بدأت الرحلة' : 'استعدّوا',
        title: open ? 'انطلقت المسابقة' : 'تنطلق المسابقة قريبًا',
        date: F.opensAt
          ? `${riyadhLongDate(F.opensAt)}، الساعة ${riyadhTime(F.opensAt)}`
          : 'الموعد يُعلن قريبًا',
        body: 'اقرأ كتاب الانتماء واللحمة الوطنية، وأجب عن أسئلة مرحلتك',
        cta: open ? 'سجّل الآن وابدأ القراءة' : 'سجّل اهتمامك وانتظر الانطلاق',
      };
    },
    caption: (_F, T) => `${T.title}! ${T.date}. ${T.body}.`,
    render: ({ P, L, T, id }) => {
      const u = L.u;
      const a = splitArea(L, 0.44, 0.5);
      const r = Math.min(a.visual.w, a.visual.h) * 0.3;
      const cx = a.visual.x + a.visual.w / 2,
        cy = a.visual.y + a.visual.h / 2;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r * 2.4} fill={`url(#${id('light')})`} opacity={0.55} />
          {Array.from({ length: 36 }, (_, i) => {
            const ang = (i / 36) * Math.PI * 2;
            const r0 = r * 1.25,
              r1 = r * (i % 2 ? 1.9 : 2.35);
            return (
              <line
                key={i}
                x1={cx + Math.cos(ang) * r0}
                y1={cy + Math.sin(ang) * r0}
                x2={cx + Math.cos(ang) * r1}
                y2={cy + Math.sin(ang) * r1}
                stroke={P.goldHi}
                strokeWidth={(i % 2 ? 0.14 : 0.24) * u}
                strokeLinecap="round"
                opacity={i % 2 ? 0.3 : 0.55}
              />
            );
          })}
          <Medallion cx={cx} cy={cy} r={r} />
          <Mark x={cx - r * 0.55} y={cy - r * 0.57} size={r * 1.1} />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', max: 9.5 * u, lines: 2 },
              { kind: 'value', text: T.date, slot: 'date', max: 3.8 * u, min: 2.4 * u },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'stagesbook',
    name: 'كتاب واحد وثلاث مراحل',
    group: 'invite',
    blurb: 'عدد أسئلة كل مرحلة من إعدادات المسابقة',
    tone: 'light',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      kicker: 'لكل مرحلة أسئلتها',
      title: 'كتاب واحد، ثلاث مراحل',
      body: 'يقرأ الجميع الكتاب نفسه، ويجيب كل طالب عن أسئلة مرحلته التعليمية',
      cta: 'اختر مرحلتك وسجّل الآن',
    }),
    facts: (F) => Object.fromEntries(F.stages.map((s) => [s.short, `${s.questions} سؤالًا`])),
    caption: (F, T) =>
      `${T.title}: ${F.stages.map((s) => `${s.short} ${arNumber(s.questions)} سؤالًا`).join('، ')}.`,
    render: ({ L, F, T }) => {
      const u = L.u;
      const a = splitArea(L, 0.46, 0.56);
      return (
        <g>
          <StageArches
            box={a.visual}
            values={F.stages.map((s) => ({
              label: s.short,
              value: arNumber(s.questions),
              unit: 'سؤالًا',
              weight: s.questions,
            }))}
          />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', max: 8 * u },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  // ---------------- live ----------------
  {
    id: 'milestone',
    name: 'محطة جديدة',
    group: 'live',
    blurb: 'إجمالي المسجلين داخل القوس',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'value', label: 'الرقم' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => ({
      kicker: 'محطة جديدة',
      value: publicCount(F.total),
      title: `${pluralNoun(F.total, PEOPLE)} يقرؤون معنا`,
      body: `من ${countOf(F.cityCount, CITIES, false)} في المنطقة الشرقية`,
      cta: 'انضم إليهم وسجّل الآن',
    }),
    facts: (F) => ({ المسجلون: publicCount(F.total), المدن: arNumber(F.cityCount) }),
    checks: (F) => [
      { label: 'عدد كافٍ للنشر', ok: F.total >= 5, note: 'الرقم أقل من ٥ ولا يُنشر.' },
    ],
    caption: (_F, T) => `${T.value} ${T.title} ${T.body}.`,
    render: ({ L, T }) => {
      const u = L.u;
      const a = splitArea(L, 0.46, 0.62);
      const arch = fitArch(roomy(a.visual, u), 1.22);
      const inner = archInner(arch, u);
      const numBox = {
        x: inner.x + 1.5 * u,
        y: inner.y + inner.w * 0.32,
        w: inner.w - 3 * u,
        h: inner.h - inner.w * 0.32 - 2 * u,
      };
      return (
        <g>
          <ArchWindow box={arch} />
          <TextStack
            box={numBox}
            align="center"
            parts={[
              { kind: 'note', text: 'حتى الآن', slot: 'sofar' },
              { kind: 'value', text: T.value, slot: 'value', max: numBox.h * 0.78, min: 6 * u },
            ]}
          />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'momentum',
    name: 'زخم اليوم',
    group: 'live',
    blurb: 'تسجيلات اليوم مع منحنى الأيام السبعة',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'value', label: 'الرقم' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => {
      const today = F.today >= 5,
        week = F.weekTotal >= 5;
      return {
        kicker: today ? 'اليوم وحده' : 'هذا الأسبوع',
        value: today ? `+${arNumber(F.today)}` : week ? `+${arNumber(F.weekTotal)}` : 'قرّاء جدد',
        title: today
          ? 'انضموا إلى المسابقة اليوم'
          : week
            ? 'انضموا إلى المسابقة خلال سبعة أيام'
            : 'ينضمون إلى المسابقة كل يوم',
        body: today
          ? `${countOf(F.weekTotal, PEOPLE)} خلال الأيام السبعة الأخيرة`
          : `${countOf(F.total, PEOPLE)} في المسابقة حتى الآن`,
        cta: 'كن التالي وسجّل الآن',
      };
    },
    facts: (F) => ({ اليوم: publicCount(F.today), 'سبعة أيام': publicCount(F.weekTotal) }),
    checks: (F) => [
      {
        label: 'تسجيلات اليوم أو الأسبوع ٥ فأكثر',
        ok: F.today >= 5 || F.weekTotal >= 5,
        note: 'العدد أقل من ٥، فيُكتب بلا رقم.',
      },
    ],
    caption: (_F, T) => `${T.value} ${T.title}. ${T.body}.`,
    render: ({ L, F, T }) => {
      const u = L.u;
      const stacked = !L.wide && L.shape !== 'square';
      if (stacked) {
        const [text, chart] = rows(L.content, [0.58, 0.42], 3 * u);
        return (
          <g>
            <TextStack
              box={text}
              align="center"
              parts={[
                { kind: 'kicker', text: T.kicker, slot: 'kicker' },
                { kind: 'value', text: T.value, slot: 'value', max: 20 * u },
                { kind: 'title', text: T.title, slot: 'title', lines: 2 },
                { kind: 'body', text: T.body, slot: 'body' },
              ]}
            />
            <Spark
              box={chart}
              values={F.week.map((d) => d.count)}
              days={F.week.map((d) => d.day)}
            />
          </g>
        );
      }
      const a = splitArea(L, 0.48);
      return (
        <g>
          <Spark
            box={{ ...a.visual, y: a.visual.y + a.visual.h * 0.18, h: a.visual.h * 0.72 }}
            values={F.week.map((d) => d.count)}
            days={F.week.map((d) => d.day)}
          />
          <TextStack
            box={a.text}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'value', text: T.value, slot: 'value', max: 18 * u },
              { kind: 'title', text: T.title, slot: 'title', lines: 2 },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'cities',
    name: 'أين يقرأ الشرق؟',
    group: 'live',
    blurb: 'ترتيب المدن الخمس الأكثر مشاركة',
    tone: 'light',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      kicker: 'حسب عدد المشاركين',
      title: 'أين يقرأ الشرق؟',
      body: 'المدن الأكثر مشاركة في المسابقة حتى الآن',
      cta: 'ارفع اسم مدينتك وسجّل الآن',
    }),
    facts: (F) => Object.fromEntries(cityRows(F).map((c) => [c.name, publicCount(c.total)])),
    checks: (F) => [
      {
        label: 'ثلاث مدن على الأقل بخمسة مشاركين',
        ok: cityRows(F).length >= 3,
        note: 'تظهر فقط المدن التي بلغت ٥ مشاركين.',
      },
    ],
    caption: (F, T) =>
      `${T.title} ${cityRows(F)
        .map((c, i) => `${arNumber(i + 1)}. ${c.name}`)
        .join(' · ')}`,
    render: ({ L, F, T }) => {
      const u = L.u;
      const list = cityRows(F);
      if (L.wide) {
        return (
          <g>
            <RankList
              box={inset(L.visual!, u)}
              items={list.map((c) => ({ label: c.name, value: c.total }))}
            />
            <TextStack
              box={L.content}
              parts={[
                { kind: 'kicker', text: T.kicker, slot: 'kicker' },
                { kind: 'title', text: T.title, slot: 'title', max: 9 * u },
                { kind: 'body', text: T.body, slot: 'body' },
              ]}
            />
          </g>
        );
      }
      const [head, body] = rows(
        L.content,
        L.shape === 'square' ? [0.26, 0.74] : [0.22, 0.78],
        3 * u,
      );
      return (
        <g>
          <TextStack
            box={head}
            align="center"
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', lines: 1, max: 9 * u, share: 0.66 },
            ]}
          />
          <RankList box={body} items={list.map((c) => ({ label: c.name, value: c.total }))} />
        </g>
      );
    },
  },
  {
    id: 'map',
    name: 'خريطة الشرقية',
    group: 'live',
    blurb: 'المدن تتوهّج بحجم مشاركتها',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => ({
      kicker: 'الشرقية تقرأ',
      title: 'من الخفجي إلى الأحساء، نقرأ كتابًا واحدًا',
      body: `${countOf(F.total, PEOPLE)} من ${countOf(F.cityCount, CITIES, false)}`,
      cta: 'أضف مدينتك إلى الخريطة وسجّل الآن',
    }),
    facts: (F) => ({ المسجلون: publicCount(F.total), المدن: arNumber(F.cityCount) }),
    caption: (_F, T) => `${T.title}. ${T.body}.`,
    render: ({ L, F, T }) => {
      const u = L.u;
      const a = splitArea(L, 0.5, 0.6);
      return (
        <g>
          <RegionMap box={a.visual} F={F} labels={a.visual.w > 28 * u} />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'stageshare',
    name: 'المراحل الثلاث',
    group: 'live',
    blurb: 'حصة كل مرحلة من المشاركين',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => ({
      kicker: 'توزيع المشاركين',
      title: 'ثلاث مراحل تقرأ كتابًا واحدًا',
      body: `${countOf(F.total, PEOPLE)} حتى الآن`,
      cta: 'مثّل مرحلتك وسجّل الآن',
    }),
    facts: (F) =>
      Object.fromEntries(
        F.stages.map((s) => [s.short, isSmall(s.total) ? 'أقل من ٥' : arPercent(s.share)]),
      ),
    checks: (F) => [
      {
        label: 'كل مرحلة ٥ مشاركين فأكثر',
        ok: F.stages.every((s) => !isSmall(s.total)),
        note: 'المرحلة الصغيرة تظهر بلا نسبة.',
      },
    ],
    caption: (F, T) =>
      `${T.title}: ${F.stages.map((s) => `${s.short} ${isSmall(s.total) ? '' : arPercent(s.share)}`).join('، ')}.`,
    render: ({ L, F, T }) => {
      const a = splitArea(L, 0.48, 0.58);
      return (
        <g>
          <StageArches
            box={a.visual}
            values={F.stages.map((s) => ({
              label: s.short,
              value: isSmall(s.total) || !F.total ? '—' : arPercent(s.share),
              unit: countOf(s.total, PEOPLE_SHORT),
              weight: Math.max(s.share, 6),
            }))}
          />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'completion',
    name: 'نسبة الإكمال',
    group: 'live',
    blurb: 'حلقة ذهبية بنسبة من أكملوا المسابقة',
    tone: 'light',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => ({
      kicker: 'إنجاز يستحق الفخر',
      title: 'من المسجلين أكملوا المسابقة وأرسلوا مشاركاتهم',
      body: `${countOf(F.completed, ENTRIES)} حتى الآن`,
      cta: 'أكمل مشاركتك قبل الإغلاق',
    }),
    facts: (F) => ({
      'نسبة الإكمال': arPercent(F.completionRate),
      المكتملون: publicCount(F.completed),
    }),
    checks: (F) => [
      {
        label: 'خمس مشاركات مكتملة فأكثر',
        ok: F.completed >= 5,
        note: 'النسبة لا تُحسب لمجموعة صغيرة.',
      },
    ],
    caption: (F, T) => `${arPercent(F.completionRate)} ${T.title}. ${T.body}.`,
    render: ({ P, L, F, T, id }) => {
      const u = L.u;
      const a = splitArea(L, 0.44, 0.56);
      const r = Math.min(a.visual.w, a.visual.h) * 0.4;
      const cx = a.visual.x + a.visual.w / 2,
        cy = a.visual.y + a.visual.h / 2;
      const rate = F.completed >= 5 && F.completionRate !== null ? F.completionRate : 0;
      const circ = 2 * Math.PI * r;
      const label = F.completed >= 5 ? arPercent(F.completionRate) : '—';
      const v = fitBlock(P, {
        text: label,
        w: r * 1.35,
        h: r * 0.9,
        size: [5 * u, r * 0.62],
        lines: 1,
        lh: 1.15,
      });
      return (
        <g>
          <circle cx={cx} cy={cy} r={r * 1.25} fill={`url(#${id('halo')})`} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={P.line}
            strokeWidth={1.6 * u}
            opacity={0.18}
          />
          {rate > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={gold(id)}
              strokeWidth={1.6 * u}
              strokeLinecap="round"
              strokeDasharray={`${(circ * rate) / 100} ${circ}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )}
          {Array.from({ length: 60 }, (_, i) => {
            const ang = (i / 60) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={cx + Math.cos(ang) * r * 0.86}
                y1={cy + Math.sin(ang) * r * 0.86}
                x2={cx + Math.cos(ang) * r * (i % 5 ? 0.83 : 0.8)}
                y2={cy + Math.sin(ang) * r * (i % 5 ? 0.83 : 0.8)}
                stroke={P.line}
                strokeWidth={0.12 * u}
                opacity={0.55}
              />
            );
          })}
          <Lines
            block={v}
            x={cx}
            y={cy - v.height / 2}
            align="center"
            fill={gold(id)}
            slot="rate"
          />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  {
    id: 'school',
    name: 'تحية جهة تعليمية',
    group: 'live',
    blurb: 'شكر لمدرسة أو جامعة بعشرة مشاركين فأكثر',
    tone: 'light',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'اسم الجهة' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'note', label: 'سطر الشكر', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F, o) => {
      const s = F.schools[o.school] ?? F.schools[0];
      return {
        kicker: 'تحية تقدير',
        title: s?.name ?? 'اختر جهة تعليمية من البيانات',
        body: s
          ? `${countOf(s.total, PEOPLE)} من ${s.city} يقرؤون معنا`
          : `تظهر الجهات التي بلغت ${arNumber(SCHOOL_FLOOR)} مشاركين`,
        note: 'شكرًا لإدارتها ومعلميها على تشجيع طلابهم على القراءة والمشاركة',
        cta: 'شجّع طلابك على المشاركة',
      };
    },
    facts: (F, o): Record<string, string> => {
      const s = F.schools[o.school] ?? F.schools[0];
      return s ? { الجهة: s.name, المدينة: s.city, المشاركون: publicCount(s.total) } : {};
    },
    checks: (F) => [
      {
        label: `جهة بلغت ${arNumber(SCHOOL_FLOOR)} مشاركين`,
        ok: F.schools.length > 0,
        note: 'لا توجد جهة بلغت الحد بعد.',
      },
    ],
    caption: (_F, T) => `${T.kicker} لـ${T.title}. ${T.body}. ${T.note}.`,
    render: ({ L, F, T, o }) => {
      const u = L.u;
      const s = F.schools[o.school] ?? F.schools[0];
      const a = splitArea(L, 0.42, 0.5);
      const arch = fitArch(roomy(a.visual, u), 1.22);
      const inner = archInner(arch, u);
      const numBox = {
        x: inner.x + 2 * u,
        y: inner.y + inner.w * 0.4,
        w: inner.w - 4 * u,
        h: inner.h - inner.w * 0.4 - 3 * u,
      };
      return (
        <g>
          <ArchWindow box={arch} />
          <TextStack
            box={numBox}
            align="center"
            parts={[
              {
                kind: 'value',
                text: s ? publicCount(s.total) : '—',
                slot: 'count',
                max: numBox.h * 0.55,
              },
              { kind: 'note', text: s ? pluralNoun(s.total, PEOPLE) : '', slot: 'unit' },
            ]}
          />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
              { kind: 'note', text: T.note, slot: 'note' },
            ]}
          />
        </g>
      );
    },
  },
  // ---------------- countdown ----------------
  {
    id: 'countdown',
    name: 'باقي أيام',
    group: 'countdown',
    blurb: 'عدد الأيام داخل النجمة الثمانية',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'value', label: 'الرقم' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الموعد', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => {
      const d = F.daysLeft;
      return {
        kicker: 'الأيام الأخيرة',
        value: d === null ? '—' : d === 0 ? 'اليوم' : arNumber(d),
        title:
          d === null
            ? 'تابعوا موعد الإغلاق'
            : d === 0
              ? 'آخر يوم للمشاركة في المسابقة'
              : `${daysWord(d)} على إغلاق المسابقة`,
        body: F.closesAt
          ? `تُغلق ${riyadhLongDate(F.closesAt)}، الساعة ${riyadhTime(F.closesAt)}`
          : 'موعد الإغلاق لم يُحدد بعد',
        cta: 'سجّل وأرسل مشاركتك قبل الإغلاق',
        ...STEP_TEXT,
      };
    },
    facts: (F) => ({
      'الأيام المتبقية': F.daysLeft === null ? '—' : arNumber(F.daysLeft),
      'موعد الإغلاق': F.closesAt ? riyadhLongDate(F.closesAt) : '—',
    }),
    checks: (F) => [
      {
        label: 'موعد إغلاق قادم',
        ok: F.daysLeft !== null,
        note: 'حدد موعد الإغلاق في إدارة المسابقة.',
      },
    ],
    caption: (_F, T) => `${T.value} ${T.title}. ${T.body}.`,
    render: ({ P, L, T, id }) => {
      const u = L.u;
      const a = splitArea(L, 0.46, L.shape === 'tall' ? 0.5 : 0.56);
      const r = Math.min(a.visual.w, a.visual.h) * 0.42;
      const cx = a.visual.x + a.visual.w / 2,
        cy = a.visual.y + a.visual.h / 2;
      const v = fitBlock(P, {
        text: T.value,
        w: r * 1.2,
        h: r * 0.95,
        size: [5 * u, r * 0.95],
        lines: 1,
        lh: 1.15,
      });
      const textBox = L.shape === 'tall' ? rows(a.text, [0.62, 0.38], 2 * u) : [a.text];
      return (
        <g>
          <Medallion cx={cx} cy={cy} r={r} />
          <Lines
            block={v}
            x={cx}
            y={cy - v.height / 2}
            align="center"
            fill={gold(id)}
            slot="value"
            glow={P.tone === 'dark'}
          />
          <TextStack
            box={textBox[0]}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
          {textBox[1] && (
            <Steps box={inset(textBox[1], u)} items={stepItems(T)} vertical={false} compact />
          )}
        </g>
      );
    },
  },
  {
    id: 'lastcall',
    name: 'الساعات الأخيرة',
    group: 'countdown',
    blurb: 'الساعات المتبقية مع عدد من سبقوك',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'value', label: 'الرقم' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => {
      const h = F.hoursLeft;
      return {
        kicker: 'لا تفوّت الفرصة',
        value: h === null ? '—' : arNumber(h),
        title: h === null ? 'الفرصة ما زالت قائمة' : `${hoursWord(h)} على إغلاق باب المشاركة`,
        body: `${countOf(F.total, PEOPLE)} سبقوك إلى المسابقة`,
        cta: 'أكمل مشاركتك الآن',
      };
    },
    facts: (F) => ({
      'الساعات المتبقية': F.hoursLeft === null ? '—' : arNumber(F.hoursLeft),
      المسجلون: publicCount(F.total),
    }),
    checks: (F) => [
      {
        label: 'موعد إغلاق قادم',
        ok: F.hoursLeft !== null,
        note: 'حدد موعد الإغلاق في إدارة المسابقة.',
      },
    ],
    caption: (_F, T) => `${T.value} ${T.title}. ${T.body}.`,
    render: ({ P, L, T, id }) => {
      const u = L.u;
      const a = splitArea(L, 0.46, 0.56);
      const r = Math.min(a.visual.w, a.visual.h) * 0.4;
      const cx = a.visual.x + a.visual.w / 2,
        cy = a.visual.y + a.visual.h / 2;
      const v = fitBlock(P, {
        text: T.value,
        w: r * 1.3,
        h: r * 0.9,
        size: [5 * u, r * 0.85],
        lines: 1,
        lh: 1.15,
      });
      return (
        <g>
          <circle cx={cx} cy={cy} r={r * 1.3} fill={`url(#${id('halo')})`} />
          {Array.from({ length: 48 }, (_, i) => {
            const ang = (i / 48) * Math.PI * 2 - Math.PI / 2;
            const big = i % 4 === 0;
            return (
              <line
                key={i}
                x1={cx + Math.cos(ang) * r}
                y1={cy + Math.sin(ang) * r}
                x2={cx + Math.cos(ang) * r * (big ? 0.86 : 0.92)}
                y2={cy + Math.sin(ang) * r * (big ? 0.86 : 0.92)}
                stroke={big ? P.goldHi : P.line}
                strokeWidth={(big ? 0.4 : 0.16) * u}
                strokeLinecap="round"
                opacity={big ? 0.95 : 0.6}
              />
            );
          })}
          <circle
            cx={cx}
            cy={cy}
            r={r * 1.06}
            fill="none"
            stroke={gold(id)}
            strokeWidth={0.3 * u}
          />
          <Lines
            block={v}
            x={cx}
            y={cy - v.height / 2 - r * 0.06}
            align="center"
            fill={gold(id)}
            slot="value"
            glow
          />
          <text
            x={cx}
            y={cy + v.height / 2 + r * 0.06}
            textAnchor="middle"
            direction="rtl"
            fontFamily={`'${P.body}'`}
            fontWeight={700}
            fontSize={r * 0.13}
            fill={P.soft}
          >
            ساعة متبقية
          </text>
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title' },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  // ---------------- prizes ----------------
  {
    id: 'prizes',
    name: 'مجموع الجوائز',
    group: 'prizes',
    blurb: 'مجموع الجوائز والجائزة الأولى لكل مرحلة',
    tone: 'dark',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'value', label: 'المبلغ' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (F) => ({
      kicker: 'جوائز المسابقة',
      value: `${arNumber(F.prizeTotal)} ريال`,
      title: 'جوائز تنتظر القرّاء المتميزين',
      body: `ست جوائز لكل مرحلة، وجائزة للتغطية الإعلامية بقيمة ${arNumber(F.mediaPrize)} ريال`,
      cta: 'سجّل الآن وكن من الفائزين',
    }),
    facts: (F) => ({
      'مجموع الجوائز': `${arNumber(F.prizeTotal)} ريال`,
      ...Object.fromEntries(
        F.firstPrizes.map((p) => [`الأولى · ${p.stage}`, `${arNumber(p.amount)} ريال`]),
      ),
    }),
    caption: (F, T) =>
      `${T.kicker}: ${T.value}. الجائزة الأولى ${F.firstPrizes.map((p) => `${p.stage} ${arNumber(p.amount)} ريال`).join('، ')}.`,
    render: ({ L, F, T }) => {
      const u = L.u;
      const stacked = !L.wide;
      const [main, medals] = stacked
        ? rows(L.content, [0.62, 0.38], 3 * u)
        : [L.content, L.visual!];
      return (
        <g>
          <TextStack
            box={main}
            align={stacked ? 'center' : 'right'}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'value', text: T.value, slot: 'value', max: 15 * u },
              { kind: 'title', text: T.title, slot: 'title', lines: 2 },
              { kind: 'body', text: T.body, slot: 'body', lines: 2 },
            ]}
          />
          <PrizeMedals
            box={stacked ? medals : inset(medals, 2 * u)}
            items={F.firstPrizes}
            vertical={!stacked}
          />
        </g>
      );
    },
  },
  {
    id: 'results',
    name: 'أُعلنت النتائج',
    group: 'prizes',
    blurb: 'دعوة للاطلاع على صفحة الفائزين',
    tone: 'dark',
    target: 'winners',
    live: false,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: () => ({
      kicker: 'شكرًا لكل من شارك',
      title: 'أُعلنت نتائج المسابقة',
      body: 'تعرّف على الفائزين في المراحل الثلاث، ونلتقي في دورة قادمة',
      cta: 'اطّلع على أسماء الفائزين',
    }),
    checks: (F) => [
      {
        label: 'النتائج منشورة',
        ok: F.state === 'RESULTS_PUBLISHED',
        note: 'انشر إعلان الفائزين قبل هذا المنشور.',
      },
    ],
    caption: (_F, T) => `${T.title}. ${T.body}.`,
    render: ({ L, T }) => {
      const u = L.u;
      const a = splitArea(L, 0.44, 0.56);
      const arch = fitArch(roomy(a.visual, u), 1.3);
      const inner = archInner(arch, u);
      const r = inner.w * 0.3;
      return (
        <g>
          <ArchWindow box={arch} />
          <Medallion cx={inner.x + inner.w / 2} cy={inner.y + inner.h * 0.58} r={r} />
          <Mark
            x={inner.x + inner.w / 2 - r * 0.55}
            y={inner.y + inner.h * 0.58 - r * 0.57}
            size={r * 1.1}
          />
          <TextStack
            box={a.text}
            align={align(a.stacked)}
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', max: 9 * u },
              { kind: 'body', text: T.body, slot: 'body' },
            ]}
          />
        </g>
      );
    },
  },
  // ---------------- charts ----------------
  {
    id: 'chart',
    name: 'رسم من التحليلات',
    group: 'charts',
    blurb: 'أي رسم من صفحة التحليلات بهوية المسابقة',
    tone: 'light',
    target: 'register',
    live: true,
    slots: [
      { key: 'kicker', label: 'السطر العلوي' },
      { key: 'title', label: 'العنوان' },
      { key: 'body', label: 'الوصف', long: true },
      { key: 'cta', label: 'دعوة الإجراء' },
    ],
    defaults: (_F, o) => ({
      ...chartDefaults(o.chart, o.people),
      kicker: o.scope || chartDefaults(o.chart, o.people).kicker,
      cta: 'شارك في المسابقة وسجّل الآن',
    }),
    facts: (_F, o) => chartFacts(o.chart, o.people),
    caption: (_F, T) => `${T.title}. ${T.body}.`,
    render: ({ L, T, o }) => {
      const u = L.u;
      if (L.wide)
        return (
          <g>
            <ChartBody kind={o.chart} people={o.people} box={inset(L.visual!, u)} />
            <TextStack
              box={L.content}
              parts={[
                { kind: 'kicker', text: T.kicker, slot: 'kicker' },
                { kind: 'title', text: T.title, slot: 'title', max: 7 * u },
                { kind: 'body', text: T.body, slot: 'body' },
              ]}
            />
          </g>
        );
      const [head, body] = rows(L.content, L.shape === 'square' ? [0.3, 0.7] : [0.24, 0.76], 3 * u);
      return (
        <g>
          <TextStack
            box={head}
            align="center"
            parts={[
              { kind: 'kicker', text: T.kicker, slot: 'kicker' },
              { kind: 'title', text: T.title, slot: 'title', lines: 2, max: 6.4 * u, share: 0.5 },
              { kind: 'body', text: T.body, slot: 'body', lines: 1, share: 0.22 },
            ]}
          />
          <ChartBody kind={o.chart} people={o.people} box={body} />
        </g>
      );
    },
  },
];
export const templateById = (id: string) => templates.find((t) => t.id === id) ?? templates[0];
export { chartKinds };

// ---------- pieces used by several templates ----------
function QuoteBlock({ box, T, align }: { box: Box; T: Record<string, string>; align: Align }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const parts = [
    fitBlock(P, {
      text: T.quote,
      w: box.w,
      h: box.h * 0.66,
      size: [3.4 * u, 7 * u],
      lines: 6,
      lh: 1.55,
    }),
    fitBlock(P, {
      text: T.source,
      w: box.w,
      h: 4 * u,
      font: 'body',
      size: [2 * u, 2.6 * u],
      lines: 1,
    }),
  ];
  const kick = kickerHeight(u);
  const total = kick + 2.4 * u + parts[0].height + 2.4 * u + parts[1].height;
  const y0 = box.y + (box.h - total) / 2;
  const x = align === 'right' ? box.x + box.w : box.x + box.w / 2;
  return (
    <g>
      <Kicker x={x} y={y0} text={T.kicker} align={align} />
      <Lines block={parts[0]} x={x} y={y0 + kick + 2.4 * u} align={align} slot="quote" />
      <Lines
        block={parts[1]}
        x={x}
        y={y0 + kick + 4.8 * u + parts[0].height}
        align={align}
        fill={gold(id)}
        slot="source"
      />
    </g>
  );
}

function StageArches({
  box,
  values,
}: {
  box: Box;
  values: { label: string; value: string; unit: string; weight: number }[];
}) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const labelH = 8.5 * u;
  const max = Math.max(...values.map((v) => v.weight), 1);
  const slots = cols(
    { ...box, h: box.h - labelH },
    values.map(() => 1),
    3 * u,
  );
  const base = box.y + box.h - labelH;
  return (
    <g>
      <line
        x1={box.x}
        x2={box.x + box.w}
        y1={base}
        y2={base}
        stroke={P.line}
        strokeWidth={0.14 * u}
        opacity={0.6}
      />
      {slots.map((s, i) => {
        const v = values[i];
        const bw = Math.min(s.w * 0.78, 22 * u);
        const h = Math.max(bw * 0.9, (s.h - 2 * u) * (0.35 + 0.65 * (v.weight / max)));
        const x = s.x + (s.w - bw) / 2;
        const num = fitBlock(P, {
          text: v.value,
          w: bw * 0.8,
          h: bw * 0.7,
          size: [2.6 * u, bw * 0.5],
          lines: 1,
          lh: 1.1,
        });
        const label = fitBlock(P, {
          text: v.label,
          w: s.w,
          h: 4 * u,
          font: 'body',
          weight: 700,
          size: [2 * u, 3 * u],
          lines: 1,
        });
        const unit = fitBlock(P, {
          text: v.unit,
          w: s.w,
          h: 3 * u,
          font: 'body',
          weight: 400,
          size: [1.6 * u, 2.2 * u],
          lines: 1,
        });
        return (
          <g key={i}>
            <ArchBar x={x} base={base} w={bw} h={h} />
            <Lines
              block={num}
              x={x + bw / 2}
              y={base - h + bw * 0.3}
              align="center"
              fill={P.tone === 'dark' ? P.bg1 : '#ffffff'}
            />
            <Lines block={label} x={s.x + s.w / 2} y={base + 1.4 * u} align="center" />
            <Lines
              block={unit}
              x={s.x + s.w / 2}
              y={base + 1.4 * u + label.height}
              align="center"
              fill={P.soft}
            />
          </g>
        );
      })}
    </g>
  );
}

function RankList({ box, items }: { box: Box; items: { label: string; value: number }[] }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  if (!items.length)
    return (
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h / 2}
        textAnchor="middle"
        direction="rtl"
        fontFamily={`'${P.body}'`}
        fontSize={2.6 * u}
        fill={P.soft}
      >
        تظهر المدن بعد بلوغها خمسة مشاركين
      </text>
    );
  const max = Math.max(...items.map((i) => i.value));
  const parts = rows(
    box,
    Array.from({ length: Math.max(items.length, 3) }, () => 1),
    1.4 * u,
  ).slice(0, items.length);
  return (
    <g>
      {parts.map((b, i) => {
        const item = items[i];
        const r = Math.min(b.h * 0.36, 3.6 * u);
        const cx = b.x + b.w - r;
        const cy = b.y + b.h * 0.42;
        const nameX = cx - r - 2.4 * u;
        const name = fitBlock(P, {
          text: item.label,
          w: b.w * 0.5,
          h: b.h * 0.66,
          size: [2 * u, Math.min(4.6 * u, b.h * 0.44)],
          lines: 1,
          lh: 1.3,
        });
        const value = fitBlock(P, {
          text: publicCount(item.value),
          w: b.w * 0.3,
          h: b.h * 0.66,
          size: [2 * u, Math.min(4.2 * u, b.h * 0.42)],
          lines: 1,
          lh: 1.2,
        });
        const trackY = cy + name.height * 0.5 + 0.6 * u;
        const trackW = nameX - b.x;
        return (
          <g key={item.label}>
            <Star
              cx={cx}
              cy={cy}
              r={r}
              fill={i === 0 ? gold(id) : 'none'}
              stroke={P.line}
              sw={0.16 * u}
            />
            <text
              x={cx}
              y={cy + r * 0.36}
              textAnchor="middle"
              fontFamily={`'${P.display}'`}
              fontWeight={700}
              fontSize={r * 1.05}
              fill={i === 0 ? (P.tone === 'dark' ? P.bg1 : '#fff') : P.gold}
            >
              {arNumber(i + 1)}
            </text>
            <Lines block={name} x={nameX} y={cy - name.height / 2 - 0.6 * u} />
            <Lines
              block={value}
              x={b.x}
              y={cy - value.height / 2 - 0.6 * u}
              align="left"
              fill={gold(id)}
            />
            <rect
              x={b.x}
              y={trackY}
              width={trackW}
              height={0.7 * u}
              rx={0.35 * u}
              fill={P.line}
              opacity={0.18}
            />
            <rect
              x={b.x + trackW * (1 - item.value / max)}
              y={trackY}
              width={trackW * (item.value / max)}
              height={0.7 * u}
              rx={0.35 * u}
              fill={gold(id)}
            />
          </g>
        );
      })}
    </g>
  );
}

function PrizeMedals({
  box,
  items,
  vertical,
}: {
  box: Box;
  items: { stage: string; amount: number }[];
  vertical: boolean;
}) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const parts = vertical
    ? rows(
        box,
        items.map(() => 1),
        2 * u,
      )
    : cols(
        box,
        items.map(() => 1),
        3 * u,
      );
  return (
    <g>
      {parts.map((b, i) => {
        const it = items[i];
        const r = Math.min(b.w * 0.34, b.h * (vertical ? 0.42 : 0.36));
        const cx = vertical ? b.x + b.w - r - u : b.x + b.w / 2;
        const cy = vertical ? b.y + b.h / 2 : b.y + r + u;
        const amount = fitBlock(P, {
          text: arNumber(it.amount),
          w: r * 1.3,
          h: r * 0.7,
          size: [2 * u, r * 0.5],
          lines: 1,
          lh: 1.1,
        });
        const label = fitBlock(P, {
          text: `الجائزة الأولى · ${it.stage}`,
          w: vertical ? b.w - 2 * r - 4 * u : b.w,
          h: 4 * u,
          font: 'body',
          weight: 700,
          size: [1.8 * u, 2.7 * u],
          lines: 1,
        });
        const unit = fitBlock(P, {
          text: 'ريال',
          w: r,
          h: r * 0.5,
          font: 'body',
          weight: 500,
          size: [1.2 * u, r * 0.2],
          lines: 1,
        });
        return (
          <g key={it.stage}>
            <Medallion cx={cx} cy={cy} r={r} />
            <Lines
              block={amount}
              x={cx}
              y={cy - (amount.height + unit.height) / 2}
              align="center"
              fill={gold(id)}
            />
            <Lines
              block={unit}
              x={cx}
              y={cy - (amount.height + unit.height) / 2 + amount.height}
              align="center"
              fill={P.soft}
            />
            {vertical ? (
              <Lines block={label} x={cx - r - 3 * u} y={cy - label.height / 2} />
            ) : (
              <Lines block={label} x={cx} y={cy + r * 1.12 + u} align="center" />
            )}
          </g>
        );
      })}
    </g>
  );
}
