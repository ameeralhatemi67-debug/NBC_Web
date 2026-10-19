'use client';
import { REGION_PATH, regionCities } from '@/lib/ceremony-region';
import { isSmall } from '@/lib/analytics-insights';
import { publicCount, type MediaFacts } from '@/lib/media/facts';
import { measure } from './text-fit';
import {
  archPath,
  cols,
  fitBlock,
  gold,
  Lines,
  rows,
  Star,
  starPath,
  usePoster,
  type Align,
  type Box,
  type Layout,
} from './poster-kit';

// Larger pieces shared by templates: the arch window, the book, the star medallion, sparkline,
// arch bars and the three steps. All sizes derive from the layout unit `u`.

// Where text and the main visual go: side by side on wide and square posters, stacked otherwise.
export function splitArea(L: Layout, visualShare = 0.45, stackShare = 0.55) {
  if (L.wide) return { text: L.content, visual: L.visual!, stacked: false };
  if (L.shape === 'square') {
    const [text, visual] = cols(L.content, [1 - visualShare, visualShare], 4 * L.u);
    return { text, visual, stacked: false };
  }
  const [visual, text] = rows(L.content, [stackShare, 1 - stackShare], 4 * L.u);
  return { text, visual, stacked: true };
}

export function Kicker({
  x,
  y,
  text,
  align = 'right',
  slot = 'kicker',
  size,
}: {
  x: number;
  y: number;
  text: string;
  align?: Align;
  slot?: string;
  size?: number;
}) {
  const { P, L } = usePoster();
  const s = size ?? 2.7 * L.u * L.k;
  const block = fitBlock(P, {
    text,
    w: L.w * 0.7,
    h: s * 2,
    font: 'body',
    weight: 700,
    size: [s * 0.8, s],
    lines: 1,
    lh: 1.4,
  });
  const r = block.size * 0.42;
  const gap = block.size * 0.55;
  const starX =
    align === 'right'
      ? x - r
      : align === 'center'
        ? x + block.width / 2 + gap + r
        : x + block.width + gap + r;
  const textX = align === 'right' ? x - 2 * r - gap : x;
  const cy = y + block.height / 2;
  return (
    <g>
      <Star cx={starX} cy={cy} r={r} fill={P.gold} />
      {align === 'center' && (
        <Star cx={x - block.width / 2 - gap - r} cy={cy} r={r} fill={P.gold} />
      )}
      <Lines block={block} x={textX} y={y} align={align} fill={P.gold} slot={slot} />
    </g>
  );
}
export const kickerHeight = (u: number) => 2.7 * u * 1.4;

// A mihrab window: three gold arches, an inner light and rays. Returns the inner opening too.
export function archInner(b: Box, u: number): Box {
  const d = 3.4 * u;
  return { x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - d };
}
export function ArchWindow({
  box,
  rays = true,
  glow = true,
  fill = true,
}: {
  box: Box;
  rays?: boolean;
  glow?: boolean;
  fill?: boolean;
}) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const inner = archInner(box, u);
  const mid = { x: box.x + 1.7 * u, y: box.y + 1.7 * u, w: box.w - 3.4 * u, h: box.h - 1.7 * u };
  const clip = id(`arch-${Math.round(box.x)}-${Math.round(box.y)}`);
  const cx = box.x + box.w / 2;
  const dark = P.tone === 'dark';
  const rayCount = 15;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={archPath(inner.x, inner.y, inner.w, inner.h)} />
        </clipPath>
        <linearGradient id={`${clip}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark ? P.glow : '#ffffff'} stopOpacity={dark ? 0.55 : 1} />
          <stop offset="1" stopColor={dark ? P.bg1 : P.bg1} stopOpacity={dark ? 0.9 : 0.75} />
        </linearGradient>
      </defs>
      {glow && (
        <ellipse
          cx={cx}
          cy={box.y + box.h * 0.42}
          rx={box.w * 0.9}
          ry={box.h * 0.62}
          fill={`url(#${id('halo')})`}
        />
      )}
      {fill && <path d={archPath(inner.x, inner.y, inner.w, inner.h)} fill={`url(#${clip}-f)`} />}
      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={cx}
          cy={inner.y + inner.w * 0.42}
          rx={inner.w * 0.75}
          ry={inner.w * 0.75}
          fill={`url(#${id('light')})`}
          opacity={dark ? 0.9 : 0.6}
        />
        {rays &&
          Array.from({ length: rayCount }, (_, i) => {
            const a = Math.PI * (0.12 + (0.76 * i) / (rayCount - 1));
            const ox = cx,
              oy = inner.y + inner.w * 0.28;
            const len = inner.h * 1.3;
            return (
              <line
                key={i}
                x1={ox}
                y1={oy}
                x2={ox + Math.cos(a) * len}
                y2={oy + Math.sin(a) * len}
                stroke={P.goldHi}
                strokeWidth={0.16 * u}
                opacity={i % 2 ? 0.1 : 0.2}
              />
            );
          })}
      </g>
      <path
        d={archPath(mid.x, mid.y, mid.w, mid.h)}
        fill="none"
        stroke={P.line}
        strokeWidth={0.12 * u}
        opacity={0.5}
      />
      <path
        d={archPath(box.x, box.y, box.w, box.h)}
        fill="none"
        stroke={gold(id)}
        strokeWidth={0.32 * u}
      />
      <path
        d={archPath(inner.x, inner.y, inner.w, inner.h)}
        fill="none"
        stroke={P.line}
        strokeWidth={0.1 * u}
        opacity={0.7}
      />
      <Star cx={cx} cy={box.y} r={1.25 * u} fill={P.tone === 'dark' ? P.bg0 : P.bg0} />
      <Star cx={cx} cy={box.y} r={1.25 * u} fill={gold(id)} />
      <line
        x1={box.x - 5 * u}
        x2={box.x + box.w + 5 * u}
        y1={box.y + box.h}
        y2={box.y + box.h}
        stroke={P.line}
        strokeWidth={0.14 * u}
        opacity={0.6}
      />
    </g>
  );
}
// The largest arch of a given proportion (height/width) that fits a box, centred at its bottom.
export function fitArch(b: Box, ratio = 1.35): Box {
  const w = Math.min(b.w, b.h / ratio);
  const h = w * ratio;
  return { x: b.x + (b.w - w) / 2, y: b.y + b.h - h, w, h };
}

export function BookCover({
  cx,
  cy,
  h,
  rot = -5,
}: {
  cx: number;
  cy: number;
  h: number;
  rot?: number;
}) {
  const { L, id } = usePoster();
  const w = h * (921 / 1300);
  const clip = id(`book-${Math.round(cx)}-${Math.round(cy)}`);
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={0.8 * L.u} />
        </clipPath>
      </defs>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={0.8 * L.u}
        fill="#fff"
        filter={`url(#${id('lift')})`}
      />
      <image
        href="/images/competition/book-cover.png"
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        clipPath={`url(#${clip})`}
        preserveAspectRatio="xMidYMid slice"
      />
      <rect
        x={cx - w / 2 + 0.5 * L.u}
        y={cy - h / 2}
        width={0.5 * L.u}
        height={h}
        fill="#000"
        opacity={0.08}
      />
    </g>
  );
}

export function Medallion({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const dark = P.tone === 'dark';
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.45} fill={`url(#${id('halo')})`} />
      <path
        d={starPath(cx, cy, r * 1.08, 0)}
        fill="none"
        stroke={P.line}
        strokeWidth={0.12 * u}
        opacity={0.55}
      />
      <path
        d={starPath(cx, cy, r, Math.PI / 8)}
        fill={dark ? P.bg1 : '#ffffff'}
        fillOpacity={dark ? 0.75 : 0.9}
        stroke={gold(id)}
        strokeWidth={0.36 * u}
        strokeLinejoin="round"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.7}
        fill="none"
        stroke={P.line}
        strokeWidth={0.12 * u}
        opacity={0.6}
      />
    </g>
  );
}

// Seven days of registrations, right to left in reading order (today on the left end).
// Short weekday names (Intl has no short Arabic form), Sunday first like getUTCDay().
const SHORT_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const weekday = { format: (d: Date) => SHORT_DAYS[d.getUTCDay()] };
export function Spark({ box, values, days }: { box: Box; values: number[]; days: string[] }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const labelH = 4 * u;
  const plot = { x: box.x + 2 * u, y: box.y + 2 * u, w: box.w - 4 * u, h: box.h - labelH - 2 * u };
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => ({
    x: plot.x + plot.w - (i / Math.max(1, values.length - 1)) * plot.w,
    y: plot.y + plot.h - (v / max) * plot.h * 0.92,
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  const area = `${line}L${pts.at(-1)!.x} ${plot.y + plot.h}L${pts[0].x} ${plot.y + plot.h}Z`;
  const fillId = id(`spark-${Math.round(box.x)}`);
  const last = pts.at(-1)!;
  return (
    <g>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.gold} stopOpacity="0.38" />
          <stop offset="1" stopColor={P.gold} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.33, 0.66, 1].map((k) => (
        <line
          key={k}
          x1={plot.x}
          x2={plot.x + plot.w}
          y1={plot.y + plot.h * k}
          y2={plot.y + plot.h * k}
          stroke={P.line}
          strokeWidth={0.08 * u}
          opacity={k === 1 ? 0.6 : 0.22}
        />
      ))}
      <path d={area} fill={`url(#${fillId})`} />
      <path
        d={line}
        fill="none"
        stroke={gold(id)}
        strokeWidth={0.55 * u}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={0.55 * u}
          fill={P.tone === 'dark' ? P.bg1 : '#fff'}
          stroke={P.gold}
          strokeWidth={0.22 * u}
        />
      ))}
      <circle cx={last.x} cy={last.y} r={2.4 * u} fill={P.goldHi} opacity={0.22} />
      <circle cx={last.x} cy={last.y} r={1.1 * u} fill={P.goldHi} />
      {days.map((d, i) => (
        <text
          key={d}
          x={pts[i].x}
          y={box.y + box.h - 0.8 * u}
          textAnchor="middle"
          direction="rtl"
          fontFamily={`'${P.body}'`}
          fontWeight={i === days.length - 1 ? 700 : 400}
          fontSize={Math.min(1.9 * u, (plot.w / Math.max(1, days.length - 1)) * 0.32)}
          fill={i === days.length - 1 ? P.gold : P.soft}
        >
          {i === days.length - 1 ? 'اليوم' : weekday.format(new Date(`${d}T12:00:00+03:00`))}
        </text>
      ))}
    </g>
  );
}

// A bar with an arch top, from the baseline up.
export function ArchBar({
  x,
  base,
  w,
  h,
  strong = true,
}: {
  x: number;
  base: number;
  w: number;
  h: number;
  strong?: boolean;
}) {
  const { P, L, id } = usePoster();
  const hh = Math.max(h, w / 2 + 0.5 * L.u);
  return (
    <g>
      <path
        d={archPath(x, base - hh, w, hh)}
        fill={strong ? gold(id) : P.tone === 'dark' ? 'rgba(255,255,255,0.08)' : P.chip}
        stroke={strong ? 'none' : P.line}
        strokeWidth={0.12 * L.u}
        strokeOpacity={0.6}
      />
      {strong && (
        <path
          d={archPath(x + w * 0.16, base - hh + w * 0.16, w * 0.68, hh - w * 0.16)}
          fill="none"
          stroke={P.tone === 'dark' ? P.bg1 : '#ffffff'}
          strokeWidth={0.1 * L.u}
          opacity={0.35}
        />
      )}
    </g>
  );
}

export type StepItem = { n: string; title: string; text: string; slot: string };
export function Steps({
  box,
  items,
  vertical,
  compact = false,
}: {
  box: Box;
  items: StepItem[];
  vertical: boolean;
  compact?: boolean;
}) {
  const { P, L, id } = usePoster();
  const u = L.u;
  if (vertical) {
    const parts = rows(
      box,
      items.map(() => 1),
      2.4 * u,
    );
    return (
      <g>
        {parts.map((b, i) => {
          const r = Math.min(b.h * 0.42, 5.4 * u);
          const cx = b.x + b.w - r;
          const cy = b.y + b.h / 2;
          const tx = cx - r - 3 * u;
          const tw = tx - b.x;
          const title = fitBlock(P, {
            text: items[i].title,
            w: tw,
            h: b.h * 0.5,
            size: [3.4 * u, 5.2 * u],
            lines: 1,
          });
          const text = fitBlock(P, {
            text: items[i].text,
            w: tw,
            h: b.h * 0.45,
            font: 'body',
            size: [2.2 * u, 2.9 * u],
            lines: 2,
          });
          const top = cy - (title.height + text.height) / 2;
          return (
            <g key={i}>
              {i < parts.length - 1 && (
                <line
                  x1={cx}
                  x2={cx}
                  y1={cy + r + 0.8 * u}
                  y2={parts[i + 1].y + parts[i + 1].h / 2 - r - 0.8 * u}
                  stroke={P.line}
                  strokeWidth={0.14 * u}
                  strokeDasharray={`${0.5 * u} ${0.7 * u}`}
                  opacity={0.7}
                />
              )}
              <Star cx={cx} cy={cy} r={r} fill={gold(id)} />
              <text
                x={cx}
                y={cy + r * 0.36}
                textAnchor="middle"
                fontFamily={`'${P.display}'`}
                fontWeight={700}
                fontSize={r * 1.02}
                fill={P.tone === 'dark' ? P.bg1 : '#ffffff'}
              >
                {items[i].n}
              </text>
              <Lines block={title} x={tx} y={top} slot={items[i].slot} />
              <Lines
                block={text}
                x={tx}
                y={top + title.height}
                fill={P.soft}
                slot={`${items[i].slot}-text`}
              />
            </g>
          );
        })}
      </g>
    );
  }
  const all = cols(
    box,
    items.map(() => 1),
    3 * u,
  );
  // Measure the tallest step, then centre the row in its box.
  const tallest = Math.max(
    ...all.map((b, i) => {
      const r = Math.min(b.w * 0.16, b.h * (compact ? 0.24 : 0.2), 4.6 * u);
      const t = fitBlock(P, {
        text: items[i].title,
        w: b.w,
        h: compact ? b.h - 2 * r - 1.2 * u : b.h * 0.34,
        size: [1.8 * u, 4.2 * u],
        lines: 1,
      });
      const d = compact
        ? 0
        : fitBlock(P, {
            text: items[i].text,
            w: b.w * 0.94,
            h: Math.max(4 * u, b.h - 2 * r - t.height - 2 * u),
            font: 'body',
            size: [1.6 * u, 2.4 * u],
            lines: 3,
          }).height;
      return 2 * r + 1.6 * u + t.height + d;
    }),
  );
  const shift = Math.max(0, (box.h - tallest) / 2);
  const parts = all.map((b) => ({ ...b, y: b.y + shift }));
  return (
    <g>
      {parts.map((b, i) => {
        const r = Math.min(b.w * 0.16, b.h * (compact ? 0.24 : 0.2), 4.6 * u);
        const cx = b.x + b.w / 2;
        const cy = b.y + r;
        const title = fitBlock(P, {
          text: items[i].title,
          w: b.w,
          h: compact ? b.h - 2 * r - 1.2 * u : b.h * 0.34,
          size: [1.8 * u, 4.2 * u],
          lines: 1,
        });
        const text = fitBlock(P, {
          text: compact ? '' : items[i].text,
          w: b.w * 0.94,
          h: Math.max(4 * u, b.h - 2 * r - title.height - 2 * u),
          font: 'body',
          size: [1.6 * u, 2.4 * u],
          lines: 3,
        });
        return (
          <g key={i}>
            {i < parts.length - 1 && (
              <line
                x1={cx - r - 1.2 * u}
                x2={parts[i + 1].x + parts[i + 1].w / 2 + r + 1.2 * u}
                y1={cy}
                y2={cy}
                stroke={P.line}
                strokeWidth={0.14 * u}
                strokeDasharray={`${0.5 * u} ${0.7 * u}`}
                opacity={0.7}
              />
            )}
            <Star cx={cx} cy={cy} r={r} fill={gold(id)} />
            <text
              x={cx}
              y={cy + r * 0.36}
              textAnchor="middle"
              fontFamily={`'${P.display}'`}
              fontWeight={700}
              fontSize={r * 1.02}
              fill={P.tone === 'dark' ? P.bg1 : '#ffffff'}
            >
              {items[i].n}
            </text>
            <Lines block={title} x={cx} y={cy + r + 1.6 * u} align="center" slot={items[i].slot} />
            <Lines
              block={text}
              x={cx}
              y={cy + r + 1.6 * u + title.height}
              align="center"
              fill={P.soft}
              slot={`${items[i].slot}-text`}
            />
          </g>
        );
      })}
    </g>
  );
}

// The populated north of the province (the southern desert has no cities): the map is cropped
// to it and fades out at the edges, so city lights read at poster size.
const MAP_WINDOW = { x: 40, y: 22, w: 520, h: 440 };
export function RegionMap({ box, F, labels }: { box: Box; F: MediaFacts; labels: boolean }) {
  const { P, L, id } = usePoster();
  const u = L.u;
  const win = MAP_WINDOW;
  const k = Math.min(box.w / win.w, box.h / win.h);
  const ox = box.x + (box.w - win.w * k) / 2 - win.x * k,
    oy = box.y + (box.h - win.h * k) / 2 - win.y * k;
  const at = (c: { x: number; y: number }) => ({ x: ox + c.x * k, y: oy + c.y * k });
  const counts = new Map(F.cities.map((c) => [c.name, c.total]));
  const max = Math.max(1, ...F.cities.map((c) => c.total));
  const ranked = F.cities
    .filter((c) => !isSmall(c.total))
    .slice(0, 6)
    .map((c) => c.name);
  const clip = id(`map-${Math.round(box.x)}-${Math.round(box.y)}`);
  const dark = P.tone === 'dark';
  const lights = regionCities.map((c) => {
    const n = counts.get(c.name) ?? 0;
    return { ...at(c), r: n ? 0.7 * u + Math.sqrt(n / max) * 2 * u : 0.45 * u };
  });
  // Place labels largest city first, each on the free side of its light; skip any that collide.
  const nameSize = 2.2 * u,
    countSize = 1.85 * u;
  const placed: { name: string; x: number; y: number; anchor: 'start' | 'end'; box: Box }[] = [];
  if (labels)
    for (const name of ranked) {
      const index = regionCities.findIndex((c) => c.name === name);
      if (index < 0) continue;
      const city = regionCities[index];
      const p = at(city);
      const gap = lights[index].r + 1.1 * u;
      const w = Math.max(measure(name, P.body, 700, nameSize), 4 * countSize);
      const h = nameSize * 1.25 + countSize * 1.3;
      const sides = city.flip ? ['west', 'east'] : ['east', 'west'];
      for (const side of sides) {
        for (const dy of [0, h * 0.75, -h * 0.75]) {
          const x0 = side === 'east' ? p.x + gap : p.x - gap - w;
          const b = { x: x0, y: p.y - h / 2 + dy, w, h };
          const inside =
            b.x >= box.x &&
            b.x + b.w <= box.x + box.w &&
            b.y >= box.y &&
            b.y + b.h <= box.y + box.h;
          const free =
            placed.every(
              (q) =>
                b.x > q.box.x + q.box.w ||
                b.x + b.w < q.box.x ||
                b.y > q.box.y + q.box.h ||
                b.y + b.h < q.box.y,
            ) &&
            lights.every(
              (d, j) =>
                j === index ||
                d.x + d.r < b.x ||
                d.x - d.r > b.x + b.w ||
                d.y + d.r < b.y ||
                d.y - d.r > b.y + b.h,
            );
          if (inside && free) {
            // In right-to-left text, "end" is the left edge and "start" the right edge.
            placed.push({
              name,
              x: side === 'east' ? b.x : b.x + b.w,
              y: b.y,
              anchor: side === 'east' ? 'end' : 'start',
              box: b,
            });
            break;
          }
        }
        if (placed.some((q) => q.name === name)) break;
      }
    }
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={2 * u} />
        </clipPath>
        <radialGradient id={`${clip}-f`} cx="0.48" cy="0.42" r="0.62">
          <stop offset="0.62" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask
          id={`${clip}-m`}
          maskUnits="userSpaceOnUse"
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
        >
          <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${clip}-f)`} />
        </mask>
      </defs>
      <g clipPath={`url(#${clip})`} mask={`url(#${clip}-m)`}>
        <g transform={`translate(${ox} ${oy}) scale(${k})`}>
          <path
            d={REGION_PATH}
            fill={dark ? 'rgba(255,255,255,0.06)' : P.chip}
            stroke={gold(id)}
            strokeWidth={(0.24 * u) / k}
            strokeLinejoin="round"
          />
          <path
            d={REGION_PATH}
            fill="none"
            stroke={P.line}
            strokeWidth={(1.6 * u) / k}
            opacity={0.08}
          />
        </g>
      </g>
      {regionCities.map((c, i) => {
        const n = counts.get(c.name) ?? 0;
        const p = at(c);
        const r = lights[i].r;
        return (
          <g key={c.name}>
            {n > 0 && <circle cx={p.x} cy={p.y} r={r * 2.2} fill={`url(#${id('halo')})`} />}
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={n ? P.goldHi : P.line}
              opacity={n ? 0.95 : 0.45}
            />
            {n > 0 && <circle cx={p.x} cy={p.y} r={r * 0.42} fill="#fff" opacity={0.85} />}
          </g>
        );
      })}
      {placed.map((l) => (
        <g key={`l-${l.name}`}>
          <text
            x={l.x}
            y={l.y + nameSize}
            textAnchor={l.anchor}
            direction="rtl"
            fontFamily={`'${P.body}'`}
            fontWeight={700}
            fontSize={nameSize}
            fill={P.ink}
            stroke={dark ? P.bg1 : P.bg0}
            strokeWidth={0.45 * u}
            paintOrder="stroke"
          >
            {l.name}
          </text>
          <text
            x={l.x}
            y={l.y + nameSize * 1.25 + countSize}
            textAnchor={l.anchor}
            direction="rtl"
            fontFamily={`'${P.body}'`}
            fontWeight={500}
            fontSize={countSize}
            fill={P.gold}
            stroke={dark ? P.bg1 : P.bg0}
            strokeWidth={0.45 * u}
            paintOrder="stroke"
          >
            {publicCount(counts.get(l.name) ?? 0)}
          </text>
        </g>
      ))}
    </g>
  );
}
