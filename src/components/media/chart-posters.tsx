'use client';
import {
  durationDistribution,
  groupParticipants,
  institutionParticipation,
  participationStatus,
  registrationTimeline,
  scoreDistribution,
  type AnalyticsParticipant,
} from '@/lib/analytics';
import {
  cityPerformance,
  isSmall,
  registrationHeat,
  stageCityMatrix,
  weekdays,
  SMALL_GROUP,
} from '@/lib/analytics-insights';
import { stageKeys, stageNames } from '@/lib/competition-domain';
import {
  arNumber,
  arPercent,
  countOf,
  ENTRIES,
  mediaFacts,
  PEOPLE,
  PEOPLE_SHORT,
  publicCount,
  SCHOOL_FLOOR,
} from '@/lib/media/facts';
import { ChartKind, chartKinds } from '@/lib/media/charts';
import { cols, fitBlock, gold, Lines, rows, Star, usePoster, type Box } from './poster-kit';
import { ArchBar, RegionMap } from './scenes';

// The analytics visuals redrawn as poster art. Each kind reads the same rules as the analytics
// page; groups under five never show a number, and named schools need ten participants.
export { chartKinds, type ChartKind };
const stageList = stageKeys.map((k) => stageNames[k]);
const short = (s: string) => s.replace('المرحلة ', '');

export function chartDefaults(kind: ChartKind, people: AnalyticsParticipant[]) {
  const total = people.length;
  const meta = chartKinds.find((c) => c.id === kind) ?? chartKinds[0];
  const done = people.filter((p) => p.submitted_at).length;
  const body: Record<ChartKind, string> = {
    cities: `${countOf(total, PEOPLE)} في المنطقة الشرقية`,
    stages: `${countOf(done, ENTRIES)} من ${countOf(total, PEOPLE)}`,
    gender: `${countOf(total, PEOPLE)} حتى الآن`,
    scores: countOf(done, ENTRIES),
    trend: `${countOf(total, PEOPLE)} حتى الآن`,
    duration: 'من بدء المحاولة إلى إرسالها',
    map: `${countOf(total, PEOPLE)} من مدن الشرقية`,
    schools: `الجهات التي بلغت ${arNumber(SCHOOL_FLOOR)} مشاركين فأكثر`,
    funnel: 'من التسجيل إلى إرسال المشاركة',
    heat: 'التسجيلات حسب اليوم والساعة بتوقيت المملكة',
    bubbles: 'نسبة من أكملوا المسابقة من المسجلين في كل مدينة',
    matrix: 'نسبة المكتملين من المسجلين في كل مدينة ومرحلة',
  };
  return { kicker: meta.kicker, title: meta.title, body: body[kind] };
}
export function chartFacts(
  kind: ChartKind,
  people: AnalyticsParticipant[],
): Record<string, string> {
  const meta = chartKinds.find((c) => c.id === kind) ?? chartKinds[0];
  return { الرسم: meta.name, المشاركون: publicCount(people.length) };
}

export function ChartBody({
  kind,
  people,
  box,
}: {
  kind: ChartKind;
  people: AnalyticsParticipant[];
  box: Box;
}) {
  switch (kind) {
    case 'cities':
      return (
        <HBars
          box={box}
          items={groupParticipants(people, 'locality')
            .filter((g) => g.label !== 'غير مسجل' && !isSmall(g.total))
            .slice(0, 8)
            .map((g) => ({ label: g.label, value: g.total, text: publicCount(g.total) }))}
          empty="تظهر المدن بعد بلوغها خمسة مشاركين"
        />
      );
    case 'schools':
      return (
        <HBars
          box={box}
          items={institutionParticipation(people)
            .filter((s) => s.total >= SCHOOL_FLOOR)
            .slice(0, 7)
            .map((s) => ({
              label: s.label,
              sub: s.city,
              value: s.total,
              text: publicCount(s.total),
            }))}
          empty={`تظهر الجهات بعد بلوغها ${arNumber(SCHOOL_FLOOR)} مشاركين`}
        />
      );
    case 'stages':
      return <StageStates box={box} people={people} />;
    case 'gender':
      return <Donut box={box} people={people} />;
    case 'scores':
      return (
        <Columns
          box={box}
          bins={scoreDistribution(people).map((b) => ({ ...b, label: b.label.replace('–<', '–') }))}
          caption="الدرجة من ١٠٠٪"
        />
      );
    case 'duration':
      return (
        <Columns box={box} bins={durationDistribution(people)} caption="مدة الإكمال بالدقائق" />
      );
    case 'trend':
      return <Trend box={box} people={people} />;
    case 'map':
      return <RegionMap box={box} F={mediaFacts({ people, now: Date.now() })} labels />;
    case 'funnel':
      return <Funnel box={box} people={people} />;
    case 'heat':
      return <Heat box={box} people={people} />;
    case 'bubbles':
      return (
        <HBars
          box={box}
          items={cityPerformance(people)
            .filter((c) => !c.small && c.city !== 'غير مسجل' && c.completion !== null)
            .sort((a, b) => b.completion! - a.completion! || b.total - a.total)
            .slice(0, 7)
            .map((c) => ({
              label: c.city,
              sub: countOf(c.total, PEOPLE_SHORT),
              value: c.completion!,
              text: arPercent(c.completion),
            }))}
          empty="تظهر المدن بعد بلوغها خمسة مشاركين"
          scale={100}
        />
      );
    case 'matrix':
      return <Matrix box={box} people={people} />;
  }
}

function Empty({ box, text }: { box: Box; text: string }) {
  const { P, L } = usePoster();
  return (
    <text
      x={box.x + box.w / 2}
      y={box.y + box.h / 2}
      textAnchor="middle"
      direction="rtl"
      fontFamily={`'${P.body}'`}
      fontSize={2.5 * L.u}
      fill={P.soft}
    >
      {text}
    </text>
  );
}

function HBars({
  box,
  items,
  empty,
  scale,
}: {
  box: Box;
  items: { label: string; sub?: string; value: number; text: string }[];
  empty: string;
  // A fixed full length (100 for percentages); otherwise the largest value.
  scale?: number;
}) {
  const { P, L, id } = usePoster();
  const u = L.u;
  if (!items.length) return <Empty box={box} text={empty} />;
  const max = scale ?? Math.max(...items.map((i) => i.value));
  const parts = rows(
    box,
    Array.from({ length: Math.max(items.length, 4) }, () => 1),
    1.2 * u,
  ).slice(0, items.length);
  return (
    <g>
      {parts.map((b, i) => {
        const it = items[i];
        const labelW = b.w * 0.36;
        const label = fitBlock(P, {
          text: it.label,
          w: labelW,
          h: b.h * 0.6,
          font: 'body',
          weight: 700,
          size: [1.9 * u, Math.min(3.2 * u, b.h * 0.42)],
          lines: 1,
        });
        const sub = it.sub
          ? fitBlock(P, {
              text: it.sub,
              w: labelW,
              h: b.h * 0.3,
              font: 'body',
              weight: 400,
              size: [1.5 * u, 2 * u],
              lines: 1,
            })
          : null;
        const val = fitBlock(P, {
          text: it.text,
          w: b.w * 0.18,
          h: b.h * 0.6,
          size: [2 * u, Math.min(3.4 * u, b.h * 0.45)],
          lines: 1,
          lh: 1.2,
        });
        const trackX = b.x + val.width + 2 * u;
        const trackW = b.x + b.w - labelW - 2 * u - trackX;
        const barH = Math.min(b.h * 0.42, 3.2 * u);
        const cy = b.y + b.h / 2;
        const len = Math.max(barH, trackW * (it.value / max));
        const labelTop = cy - (label.height + (sub?.height ?? 0)) / 2;
        return (
          <g key={it.label + (it.sub ?? '')}>
            <Lines block={label} x={b.x + b.w} y={labelTop} />
            {sub && <Lines block={sub} x={b.x + b.w} y={labelTop + label.height} fill={P.soft} />}
            <rect
              x={trackX}
              y={cy - barH / 2}
              width={trackW}
              height={barH}
              rx={barH / 2}
              fill={P.line}
              opacity={0.14}
            />
            <rect
              x={trackX + trackW - len}
              y={cy - barH / 2}
              width={len}
              height={barH}
              rx={barH / 2}
              fill={i === 0 ? gold(id) : P.gold}
              opacity={i === 0 ? 1 : 0.78}
            />
            <Lines
              block={val}
              x={b.x}
              y={cy - val.height / 2}
              align="left"
              fill={i === 0 ? gold(id) : P.ink}
            />
          </g>
        );
      })}
    </g>
  );
}

const STATES = [
  { key: 'completed', label: 'مكتملة' },
  { key: 'started', label: 'قيد المشاركة' },
  { key: 'new', label: 'لم تبدأ' },
] as const;
function StageStates({ box, people }: { box: Box; people: AnalyticsParticipant[] }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const legendH = 5 * u;
  const parts = rows(
    { ...box, h: box.h - legendH },
    stageList.map(() => 1),
    2 * u,
  );
  const shade = [gold(id), P.gold, P.line];
  const opacity = [1, 0.45, 0.16];
  return (
    <g>
      {parts.map((b, i) => {
        const stage = stageList[i];
        const group = people.filter((p) => p.stage === stage);
        const counts = STATES.map(
          (s) => group.filter((p) => participationStatus(p) === s.key).length,
        );
        const rate =
          group.length >= SMALL_GROUP ? arPercent((counts[0] / group.length) * 100) : '—';
        const name = fitBlock(P, {
          text: short(stage),
          w: b.w * 0.5,
          h: b.h * 0.4,
          size: [2.2 * u, 3.6 * u],
          lines: 1,
        });
        const val = fitBlock(P, {
          text: `${rate} إكمال`,
          w: b.w * 0.4,
          h: b.h * 0.4,
          font: 'body',
          weight: 700,
          size: [1.8 * u, 2.8 * u],
          lines: 1,
        });
        const barH = Math.min(b.h * 0.34, 4.4 * u);
        const barY = b.y + b.h - barH;
        let x = b.x + b.w;
        return (
          <g key={stage}>
            <Lines block={name} x={b.x + b.w} y={barY - name.height - 0.6 * u} />
            <Lines block={val} x={b.x} y={barY - val.height - 0.6 * u} align="left" fill={P.gold} />
            <rect
              x={b.x}
              y={barY}
              width={b.w}
              height={barH}
              rx={barH / 2}
              fill={P.line}
              opacity={0.1}
            />
            {group.length > 0 &&
              counts.map((c, k) => {
                const w = (c / group.length) * b.w;
                x -= w;
                return (
                  <rect
                    key={k}
                    x={x}
                    y={barY}
                    width={w}
                    height={barH}
                    fill={shade[k]}
                    opacity={opacity[k]}
                  />
                );
              })}
            <rect
              x={b.x}
              y={barY}
              width={b.w}
              height={barH}
              rx={barH / 2}
              fill="none"
              stroke={P.line}
              strokeWidth={0.1 * u}
              opacity={0.4}
            />
          </g>
        );
      })}
      <Legend
        x={box.x + box.w}
        y={box.y + box.h - legendH / 2}
        items={STATES.map((s, k) => ({ label: s.label, fill: shade[k], opacity: opacity[k] }))}
      />
    </g>
  );
}
function Legend({
  x,
  y,
  items,
}: {
  x: number;
  y: number;
  items: { label: string; fill: string; opacity: number }[];
}) {
  const { P, L } = usePoster();
  const u = L.u;
  let cursor = x;
  return (
    <g>
      {items.map((it) => {
        const b = fitBlock(P, {
          text: it.label,
          w: 30 * u,
          h: 4 * u,
          font: 'body',
          weight: 500,
          size: [2 * u, 2 * u],
          lines: 1,
        });
        const sx = cursor - 1.2 * u;
        const node = (
          <g key={it.label}>
            <circle
              cx={sx}
              cy={y}
              r={1 * u}
              fill={it.fill}
              opacity={it.opacity < 0.3 ? 0.4 : it.opacity}
            />
            <Lines block={b} x={sx - 1.8 * u} y={y - b.height / 2} fill={P.soft} />
          </g>
        );
        cursor = sx - 1.8 * u - b.width - 3.4 * u;
        return node;
      })}
    </g>
  );
}

function Donut({ box, people }: { box: Box; people: AnalyticsParticipant[] }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const groups = groupParticipants(people, 'gender');
  if (!people.length) return <Empty box={box} text="لا توجد بيانات بعد" />;
  const wide = box.w > box.h * 1.3;
  const r = Math.min(wide ? box.w * 0.24 : box.w * 0.3, box.h * (wide ? 0.42 : 0.3));
  const cx = wide ? box.x + box.w - r - 2 * u : box.x + box.w / 2;
  const cy = wide ? box.y + box.h / 2 : box.y + r + 2 * u;
  const colors: Record<string, string> = { ذكر: gold(id), أنثى: P.tone === 'dark' ? P.ink : P.ink };
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const total = people.length;
  const center = fitBlock(P, {
    text: publicCount(total),
    w: r * 1.2,
    h: r * 0.6,
    size: [3 * u, r * 0.42],
    lines: 1,
    lh: 1.15,
  });
  const legendBox = wide
    ? { x: box.x, y: box.y + box.h * 0.2, w: box.w - 2 * r - 8 * u, h: box.h * 0.6 }
    : { x: box.x, y: cy + r + 4 * u, w: box.w, h: box.y + box.h - (cy + r + 4 * u) };
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.3} fill={`url(#${id('halo')})`} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={P.line}
        strokeWidth={3.2 * u}
        opacity={0.12}
      />
      {groups.map((g) => {
        const share = g.total / total;
        const dash = `${circ * share - (groups.length > 1 ? 0.6 * u : 0)} ${circ}`;
        const el = (
          <circle
            key={g.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colors[g.label] ?? P.line}
            strokeOpacity={colors[g.label] ? (g.label === 'أنثى' ? 0.85 : 1) : 0.4}
            strokeWidth={3.2 * u}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += circ * share;
        return el;
      })}
      <Lines
        block={center}
        x={cx}
        y={cy - center.height / 2 - 0.6 * u}
        align="center"
        fill={P.ink}
      />
      <text
        x={cx}
        y={cy + center.height / 2 + 1.2 * u}
        textAnchor="middle"
        direction="rtl"
        fontFamily={`'${P.body}'`}
        fontSize={1.9 * u}
        fill={P.soft}
      >
        مشارك ومشاركة
      </text>
      {rows(
        legendBox,
        groups.map(() => 1),
        1.4 * u,
      ).map((b, i) => {
        const g = groups[i];
        const pct = isSmall(g.total) ? 'أقل من ٥' : arPercent((g.total / total) * 100);
        const label = fitBlock(P, {
          text: g.label,
          w: b.w * 0.5,
          h: b.h,
          font: 'body',
          weight: 700,
          size: [2 * u, Math.min(3.4 * u, b.h * 0.6)],
          lines: 1,
        });
        const val = fitBlock(P, {
          text: pct,
          w: b.w * 0.4,
          h: b.h,
          size: [2 * u, Math.min(4.2 * u, b.h * 0.7)],
          lines: 1,
          lh: 1.2,
        });
        const cyy = b.y + b.h / 2;
        const right = wide ? b.x + b.w : b.x + b.w * 0.78;
        const left = wide ? b.x : b.x + b.w * 0.22;
        return (
          <g key={g.label}>
            <circle
              cx={right - 1.2 * u}
              cy={cyy}
              r={1.2 * u}
              fill={colors[g.label] ?? P.line}
              opacity={colors[g.label] ? 1 : 0.5}
            />
            <Lines block={label} x={right - 3.4 * u} y={cyy - label.height / 2} />
            <Lines block={val} x={left} y={cyy - val.height / 2} align="left" fill={gold(id)} />
          </g>
        );
      })}
    </g>
  );
}

function Columns({
  box,
  bins,
  caption,
}: {
  box: Box;
  bins: { label: string; count: number }[];
  caption: string;
}) {
  const { P, L } = usePoster();
  const u = L.u;
  const total = bins.reduce((s, b) => s + b.count, 0);
  if (!total) return <Empty box={box} text="تظهر بعد إرسال المشاركات" />;
  const labelH = 8 * u;
  const max = Math.max(...bins.map((b) => b.count), 1);
  const plot = { ...box, h: box.h - labelH };
  const slots = cols(
    plot,
    bins.map(() => 1),
    2 * u,
  ).reverse();
  const base = plot.y + plot.h;
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
        const b = bins[i];
        const bw = Math.min(s.w * 0.72, 16 * u);
        const h = Math.max(bw * 0.55, (plot.h - 6 * u) * (b.count / max));
        const x = s.x + (s.w - bw) / 2;
        const num = fitBlock(P, {
          text: isSmall(b.count) ? '' : arNumber(b.count),
          w: s.w,
          h: 5 * u,
          size: [2 * u, 3.4 * u],
          lines: 1,
          lh: 1.2,
        });
        const lab = fitBlock(P, {
          text: b.label,
          w: s.w,
          h: 4 * u,
          font: 'body',
          weight: 500,
          size: [1.5 * u, 2.2 * u],
          lines: 1,
        });
        return (
          <g key={b.label}>
            <ArchBar x={x} base={base} w={bw} h={h} strong={b.count === max} />
            {num.lines.length > 0 && (
              <Lines
                block={num}
                x={x + bw / 2}
                y={base - h - num.height - 0.6 * u}
                align="center"
                fill={P.gold}
              />
            )}
            <Lines block={lab} x={s.x + s.w / 2} y={base + 1.2 * u} align="center" fill={P.soft} />
          </g>
        );
      })}
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h - 0.6 * u}
        textAnchor="middle"
        direction="rtl"
        fontFamily={`'${P.body}'`}
        fontSize={1.9 * u}
        fill={P.faint}
      >
        {caption}
      </text>
    </g>
  );
}

function Trend({ box, people }: { box: Box; people: AnalyticsParticipant[] }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const points = registrationTimeline(people);
  if (!points.length) return <Empty box={box} text="لا توجد تسجيلات بعد" />;
  const labelH = 5 * u;
  const plot = { x: box.x + 2 * u, y: box.y + 6 * u, w: box.w - 4 * u, h: box.h - labelH - 6 * u };
  const first = Date.parse(points[0].day),
    last = Date.parse(points.at(-1)!.day),
    span = Math.max(1, last - first);
  const max = points.at(-1)!.cumulative;
  // Time runs right to left, in reading order.
  const pts = points.map((p) => ({
    x: plot.x + plot.w - ((Date.parse(p.day) - first) / span) * plot.w,
    y: plot.y + plot.h - (p.cumulative / max) * plot.h,
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  const fillId = id('trend');
  const date = (d: string) =>
    new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(d));
  const end = pts.at(-1)!;
  return (
    <g>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.gold} stopOpacity="0.4" />
          <stop offset="1" stopColor={P.gold} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((k) => (
        <line
          key={k}
          x1={plot.x}
          x2={plot.x + plot.w}
          y1={plot.y + plot.h * k}
          y2={plot.y + plot.h * k}
          stroke={P.line}
          strokeWidth={0.08 * u}
          opacity={k === 1 ? 0.6 : 0.2}
        />
      ))}
      {pts.length > 1 && (
        <path
          d={`${line}L${end.x} ${plot.y + plot.h}L${pts[0].x} ${plot.y + plot.h}Z`}
          fill={`url(#${fillId})`}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={gold(id)}
        strokeWidth={0.6 * u}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={end.x} cy={end.y} r={2.6 * u} fill={P.goldHi} opacity={0.22} />
      <circle cx={end.x} cy={end.y} r={1.1 * u} fill={P.goldHi} />
      <text
        x={end.x}
        y={end.y - 3.4 * u}
        textAnchor="middle"
        fontFamily={`'${P.display}'`}
        fontWeight={700}
        fontSize={3.6 * u}
        fill={gold(id)}
      >
        {publicCount(max)}
      </text>
      <text
        x={plot.x + plot.w}
        y={box.y + box.h - 0.8 * u}
        textAnchor="end"
        direction="rtl"
        fontFamily={`'${P.body}'`}
        fontSize={1.9 * u}
        fill={P.soft}
      >
        {date(points[0].day)}
      </text>
      {points.length > 1 && (
        <text
          x={plot.x}
          y={box.y + box.h - 0.8 * u}
          textAnchor="start"
          direction="rtl"
          fontFamily={`'${P.body}'`}
          fontSize={1.9 * u}
          fill={P.soft}
        >
          {date(points.at(-1)!.day)}
        </text>
      )}
    </g>
  );
}

function Funnel({ box, people }: { box: Box; people: AnalyticsParticipant[] }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const steps = [
    { label: 'سجّلوا', count: people.length },
    { label: 'بدأوا المحاولة', count: people.filter((p) => p.attempt_id).length },
    { label: 'أرسلوا المشاركة', count: people.filter((p) => p.submitted_at).length },
  ];
  if (!people.length) return <Empty box={box} text="لا توجد بيانات بعد" />;
  const parts = rows(
    box,
    steps.map(() => 1),
    2 * u,
  );
  const max = Math.max(1, steps[0].count);
  return (
    <g>
      {parts.map((b, i) => {
        const s = steps[i];
        const w = Math.max(b.w * 0.18, b.w * (s.count / max));
        const x = b.x + (b.w - w) / 2;
        const h = b.h * 0.72;
        const y = b.y + (b.h - h) / 2;
        const share =
          i && steps[0].count >= SMALL_GROUP && !isSmall(s.count)
            ? ` (${arPercent((s.count / steps[0].count) * 100)})`
            : '';
        const label = fitBlock(P, {
          text: `${s.label}${share}`,
          w: Math.max(w, b.w * 0.5) * 0.9,
          h: h * 0.45,
          font: 'body',
          weight: 700,
          size: [1.8 * u, Math.min(3 * u, h * 0.3)],
          lines: 1,
        });
        const val = fitBlock(P, {
          text: publicCount(s.count),
          w: Math.max(w, b.w * 0.5) * 0.9,
          h: h * 0.5,
          size: [2 * u, Math.min(4.6 * u, h * 0.42)],
          lines: 1,
          lh: 1.2,
        });
        const inside = w > b.w * 0.45;
        return (
          <g key={s.label}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={h * 0.22}
              fill={i === 0 ? gold(id) : P.gold}
              opacity={[1, 0.62, 0.36][i]}
            />
            <Lines
              block={val}
              x={b.x + b.w / 2}
              y={y + h / 2 - (val.height + label.height) / 2}
              align="center"
              fill={inside && P.tone === 'light' ? '#fff' : inside ? P.bg1 : P.ink}
            />
            <Lines
              block={label}
              x={b.x + b.w / 2}
              y={y + h / 2 - (val.height + label.height) / 2 + val.height}
              align="center"
              fill={inside && P.tone === 'light' ? '#fff' : inside ? P.bg1 : P.soft}
            />
          </g>
        );
      })}
    </g>
  );
}

function Heat({ box, people }: { box: Box; people: AnalyticsParticipant[] }) {
  const { P, L } = usePoster();
  const u = L.u;
  const heat = registrationHeat(people);
  if (!heat.max) return <Empty box={box} text="لا توجد تسجيلات بعد" />;
  const labelW = 9 * u,
    labelH = 4.5 * u;
  const cell = Math.min((box.w - labelW) / 24, (box.h - labelH) / 7);
  const gridW = cell * 24,
    gridH = cell * 7;
  const gx = box.x + (box.w - labelW - gridW) / 2,
    gy = box.y + (box.h - labelH - gridH) / 2;
  const hour = (h: number) => `${arNumber(h % 12 || 12)}${h < 12 ? 'ص' : 'م'}`;
  return (
    <g>
      {heat.grid.map((row, d) => (
        <g key={d}>
          <text
            x={gx + gridW + labelW}
            y={gy + d * cell + cell * 0.66}
            textAnchor="end"
            direction="rtl"
            fontFamily={`'${P.body}'`}
            fontSize={Math.min(2 * u, cell * 0.62)}
            fill={P.soft}
          >
            {weekdays[d]}
          </text>
          {row.map((n, h) => (
            <rect
              key={h}
              x={gx + gridW - (h + 1) * cell + cell * 0.08}
              y={gy + d * cell + cell * 0.08}
              width={cell * 0.84}
              height={cell * 0.84}
              rx={cell * 0.18}
              fill={n ? P.gold : P.line}
              opacity={n ? 0.18 + 0.82 * (n / heat.max) : 0.08}
            />
          ))}
        </g>
      ))}
      {[0, 6, 12, 18].map((h) => (
        <text
          key={h}
          x={gx + gridW - h * cell - cell / 2}
          y={gy + gridH + labelH * 0.75}
          textAnchor="middle"
          direction="rtl"
          fontFamily={`'${P.body}'`}
          fontSize={Math.min(1.9 * u, cell * 0.6)}
          fill={P.soft}
        >
          {hour(h)}
        </text>
      ))}
      {heat.peak && (
        <Star
          cx={gx + gridW - (heat.peak.hour + 0.5) * cell}
          cy={gy + (heat.peak.day + 0.5) * cell}
          r={cell * 0.62}
          stroke={P.goldHi}
          sw={0.18 * u}
        />
      )}
    </g>
  );
}

function Matrix({ box, people }: { box: Box; people: AnalyticsParticipant[] }) {
  const { P, L } = usePoster();
  const u = L.u;
  const m = stageCityMatrix(people, stageList);
  const list = m.cities
    .map((city, i) => ({ city, cells: m.cells[i] }))
    .filter((r) => r.city !== 'غير مسجل' && r.cells.some((c) => c.rate !== null))
    .slice(0, 8);
  if (!list.length) return <Empty box={box} text="تظهر النسب بعد بلوغ المجموعات خمسة مشاركين" />;
  const headH = 5 * u,
    labelW = box.w * 0.3;
  const cellW = (box.w - labelW) / 3;
  const cellH = Math.min((box.h - headH) / list.length, 9 * u);
  return (
    <g>
      {stageList.map((s, j) => (
        <text
          key={s}
          x={box.x + box.w - labelW - cellW * (j + 0.5)}
          y={box.y + headH * 0.7}
          textAnchor="middle"
          direction="rtl"
          fontFamily={`'${P.body}'`}
          fontWeight={700}
          fontSize={2.1 * u}
          fill={P.soft}
        >
          {short(s)}
        </text>
      ))}
      {list.map((r, i) => {
        const y = box.y + headH + i * cellH;
        return (
          <g key={r.city}>
            <text
              x={box.x + box.w}
              y={y + cellH * 0.62}
              textAnchor="start"
              direction="rtl"
              fontFamily={`'${P.body}'`}
              fontWeight={700}
              fontSize={Math.min(2.6 * u, cellH * 0.42)}
              fill={P.ink}
            >
              {r.city}
            </text>
            {r.cells.map((c, j) => {
              const x = box.x + box.w - labelW - cellW * (j + 1);
              return (
                <g key={j}>
                  <rect
                    x={x + 0.4 * u}
                    y={y + 0.4 * u}
                    width={cellW - 0.8 * u}
                    height={cellH - 0.8 * u}
                    rx={0.9 * u}
                    fill={c.rate === null ? P.line : P.gold}
                    opacity={c.rate === null ? 0.07 : 0.15 + 0.75 * (c.rate / 100)}
                  />
                  <text
                    x={x + cellW / 2}
                    y={y + cellH * 0.62}
                    textAnchor="middle"
                    fontFamily={`'${P.display}'`}
                    fontWeight={700}
                    fontSize={Math.min(2.6 * u, cellH * 0.42)}
                    fill={
                      c.rate !== null && c.rate > 55 ? (P.tone === 'dark' ? P.bg1 : '#fff') : P.ink
                    }
                  >
                    {c.rate === null ? '—' : arPercent(c.rate)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
