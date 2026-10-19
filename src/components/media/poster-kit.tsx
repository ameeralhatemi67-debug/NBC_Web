'use client';
import { createContext, useContext, useId, useMemo, type ReactNode } from 'react';
import type { PosterFormat, Shape } from '@/lib/media/formats';
import { qrLevel, qrMatrix, qrPaths, type QrStyle } from '@/lib/media/qr';
import { displayLink } from '@/lib/media/codes';
import { fitText, measure, type Fit } from './text-fit';
import { FRUTIGER, NASKH, SANS } from './fonts';

// The poster design system: identity palettes, the layout grid per format, and the site's motifs
// (arch, eight-point star, weave, gold numerals) as SVG. Templates compose these; nothing here
// knows about any one template.
export type Identity = 'original' | 'official' | 'hybrid';
export type Tone = 'dark' | 'light';
export type Box = { x: number; y: number; w: number; h: number };
export const identities: { id: Identity; name: string; swatch: [string, string] }[] = [
  { id: 'original', name: 'الأصلي', swatch: ['#18523f', '#cfb779'] },
  { id: 'official', name: 'الرسمي', swatch: ['#074572', '#00a4e0'] },
  { id: 'hybrid', name: 'المزيج', swatch: ['#1b573f', '#7fd0a4'] },
];

export type Palette = {
  identity: Identity;
  tone: Tone;
  bg0: string;
  bg1: string;
  glow: string;
  glow2: string;
  ink: string;
  soft: string;
  faint: string;
  gold: string;
  goldHi: string;
  goldLo: string;
  line: string;
  weave: string;
  weaveOpacity: number;
  grain: number;
  tile: string;
  qrInk: string;
  chip: string;
  mark1: string;
  mark2: string;
  display: string;
  displayWeight: number;
  body: string;
  shade: string;
};

const PALETTES: Record<Identity, Record<Tone, Omit<Palette, 'identity' | 'tone'>>> = {
  original: {
    dark: {
      bg0: '#1d5843',
      bg1: '#0b2f26',
      glow: '#3f7d5f',
      glow2: '#d9b968',
      ink: '#f7f3e8',
      soft: '#c9d8cc',
      faint: 'rgba(247,243,232,0.58)',
      gold: '#d6bd7c',
      goldHi: '#f5e3ad',
      goldLo: '#a9853f',
      line: '#cfb779',
      weave: '#ddc991',
      weaveOpacity: 0.13,
      grain: 0.08,
      tile: '#fbf7ec',
      qrInk: '#0f3a2e',
      chip: 'rgba(247,243,232,0.07)',
      mark1: '#d9b968',
      mark2: '#f7f3e8',
      display: NASKH,
      displayWeight: 700,
      body: SANS,
      shade: 'rgba(4,20,15,0.55)',
    },
    light: {
      bg0: '#fbf8ef',
      bg1: '#ebe2cb',
      glow: '#ffffff',
      glow2: '#d9b968',
      ink: '#15392e',
      soft: '#56665c',
      faint: 'rgba(21,57,46,0.5)',
      gold: '#a8843f',
      goldHi: '#cda75b',
      goldLo: '#76561f',
      line: '#b49250',
      weave: '#b49250',
      weaveOpacity: 0.15,
      grain: 0.06,
      tile: '#ffffff',
      qrInk: '#123f33',
      chip: 'rgba(24,82,63,0.07)',
      mark1: '#b49250',
      mark2: '#18543f',
      display: NASKH,
      displayWeight: 700,
      body: SANS,
      shade: 'rgba(60,45,15,0.22)',
    },
  },
  official: {
    dark: {
      bg0: '#0b5a8f',
      bg1: '#032c47',
      glow: '#1b8fca',
      glow2: '#00a4e0',
      ink: '#ffffff',
      soft: '#cfe4f1',
      faint: 'rgba(255,255,255,0.6)',
      gold: '#43c4f1',
      goldHi: '#b4ebfc',
      goldLo: '#0a8bc4',
      line: '#5cc8f2',
      weave: '#a6defa',
      weaveOpacity: 0.1,
      grain: 0.06,
      tile: '#ffffff',
      qrInk: '#053655',
      chip: 'rgba(255,255,255,0.08)',
      mark1: '#00a4e0',
      mark2: '#ffffff',
      display: FRUTIGER,
      displayWeight: 700,
      body: FRUTIGER,
      shade: 'rgba(2,20,35,0.5)',
    },
    light: {
      bg0: '#ffffff',
      bg1: '#e3f0f8',
      glow: '#ffffff',
      glow2: '#00a4e0',
      ink: '#0f3550',
      soft: '#4d687b',
      faint: 'rgba(15,53,80,0.5)',
      gold: '#0876a2',
      goldHi: '#00a4e0',
      goldLo: '#065a80',
      line: '#00a4e0',
      weave: '#0876a2',
      weaveOpacity: 0.07,
      grain: 0.04,
      tile: '#ffffff',
      qrInk: '#074572',
      chip: 'rgba(7,69,114,0.06)',
      mark1: '#00a4e0',
      mark2: '#074572',
      display: FRUTIGER,
      displayWeight: 700,
      body: FRUTIGER,
      shade: 'rgba(7,40,70,0.2)',
    },
  },
  hybrid: {
    dark: {
      bg0: '#20614a',
      bg1: '#0c372b',
      glow: '#4d9e78',
      glow2: '#7fd0a4',
      ink: '#ffffff',
      soft: '#d5ebde',
      faint: 'rgba(255,255,255,0.6)',
      gold: '#93dbb3',
      goldHi: '#dcf6e7',
      goldLo: '#4c9971',
      line: '#7fd0a4',
      weave: '#bfe8d0',
      weaveOpacity: 0.1,
      grain: 0.06,
      tile: '#ffffff',
      qrInk: '#113f33',
      chip: 'rgba(255,255,255,0.08)',
      mark1: '#7fd0a4',
      mark2: '#ffffff',
      display: SANS,
      displayWeight: 700,
      body: SANS,
      shade: 'rgba(3,22,16,0.5)',
    },
    light: {
      bg0: '#ffffff',
      bg1: '#e5f1e9',
      glow: '#ffffff',
      glow2: '#4c9971',
      ink: '#173a2e',
      soft: '#506a5c',
      faint: 'rgba(23,58,46,0.5)',
      gold: '#367356',
      goldHi: '#4c9971',
      goldLo: '#245a42',
      line: '#4c9971',
      weave: '#4c9971',
      weaveOpacity: 0.08,
      grain: 0.04,
      tile: '#ffffff',
      qrInk: '#113f33',
      chip: 'rgba(24,82,63,0.06)',
      mark1: '#4c9971',
      mark2: '#18523f',
      display: SANS,
      displayWeight: 700,
      body: SANS,
      shade: 'rgba(10,40,30,0.18)',
    },
  },
};
export function palette(identity: Identity, tone: Tone): Palette {
  return { identity, tone, ...PALETTES[identity][tone] };
}

// ---------- layout ----------
export type Layout = {
  w: number;
  h: number;
  shape: Shape;
  u: number;
  m: number;
  // Type scale: taller canvases carry larger type for the same unit.
  k: number;
  wide: boolean;
  header: Box;
  content: Box;
  visual: Box | null;
  footer: Box;
  qr: Box | null;
};
export function layout(format: PosterFormat, qrOn: boolean): Layout {
  const { w, h, shape } = format;
  const u = Math.min(w, h) / 100;
  const m = (shape === 'wide' ? 6.4 : 7) * u;
  const top = Math.max(m, (format.safe?.top ?? 0) + 2 * u);
  const bottom = Math.max(m, (format.safe?.bottom ?? 0) + 2 * u);
  if (shape === 'wide') {
    const split = w * 0.44;
    const textX = split + 3 * u;
    const header = { x: textX, y: top, w: w - m - textX, h: 10 * u };
    const footer = { x: textX, y: h - bottom - 13 * u, w: w - m - textX, h: 13 * u };
    const q = qrOn ? Math.min(31 * u, h * 0.3) : 0;
    const col = { x: m, y: top, w: split - m - 3 * u, h: h - top - bottom };
    return {
      w,
      h,
      shape,
      u,
      m,
      k: 1,
      wide: true,
      header,
      footer,
      content: {
        x: textX,
        y: header.y + header.h + 3 * u,
        w: header.w,
        h: footer.y - 3 * u - (header.y + header.h + 3 * u),
      },
      visual: qrOn ? { ...col, h: col.h - q - 3 * u } : col,
      qr: qrOn ? { x: m, y: h - bottom - q, w: q, h: q } : null,
    };
  }
  const q = qrOn ? (shape === 'tall' ? 21 : shape === 'portrait' ? 17.5 : 16.5) * u : 0;
  const headerH = (shape === 'tall' ? 11 : 9.5) * u;
  const header = { x: m, y: top, w: w - 2 * m, h: headerH };
  const footH = qrOn ? q : 11 * u;
  const footer = { x: m, y: h - bottom - footH, w: w - 2 * m, h: footH };
  const gap = (shape === 'tall' ? 6 : 4.2) * u;
  return {
    w,
    h,
    shape,
    u,
    m,
    k: shape === 'tall' ? 1.22 : shape === 'portrait' ? 1.08 : 1,
    wide: false,
    header,
    footer,
    content: {
      x: m,
      y: header.y + header.h + gap,
      w: w - 2 * m,
      h: footer.y - gap - (header.y + header.h + gap),
    },
    visual: null,
    qr: qrOn ? { x: m, y: footer.y, w: q, h: q } : null,
  };
}
export const inset = (b: Box, d: number): Box => ({
  x: b.x + d,
  y: b.y + d,
  w: b.w - 2 * d,
  h: b.h - 2 * d,
});
// Split a box into rows by weight (top to bottom) or columns (right to left, reading order).
export function rows(b: Box, weights: number[], gap = 0): Box[] {
  const total = weights.reduce((s, n) => s + n, 0);
  const free = b.h - gap * (weights.length - 1);
  let y = b.y;
  return weights.map((wt) => {
    const box = { x: b.x, y, w: b.w, h: (free * wt) / total };
    y += box.h + gap;
    return box;
  });
}
export function cols(b: Box, weights: number[], gap = 0): Box[] {
  const total = weights.reduce((s, n) => s + n, 0);
  const free = b.w - gap * (weights.length - 1);
  let x = b.x + b.w;
  return weights.map((wt) => {
    const w = (free * wt) / total;
    x -= w;
    const box = { x, y: b.y, w, h: b.h };
    x -= gap;
    return box;
  });
}

// ---------- context ----------
type PosterCtx = { P: Palette; L: Layout; id: (name: string) => string; editable: boolean };
const Ctx = createContext<PosterCtx | null>(null);
export function usePoster() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Poster parts must be inside <PosterFrame>.');
  return c;
}

// ---------- text ----------
export type TextSpec = {
  text: string;
  w: number;
  h: number;
  font?: 'display' | 'body';
  weight?: number;
  size: [number, number];
  lines?: number;
  lh?: number;
};
export type Block = Fit & {
  font: string;
  weight: number;
  lh: number;
  height: number;
  width: number;
};
export function fitBlock(P: Palette, s: TextSpec): Block {
  const font = s.font === 'body' ? P.body : P.display;
  const weight = s.weight ?? (s.font === 'body' ? 500 : P.displayWeight);
  const lh = s.lh ?? (s.font === 'body' ? 1.55 : font === NASKH ? 1.42 : 1.3);
  const fit = fitText({
    text: s.text,
    width: s.w,
    height: s.h,
    family: font,
    weight,
    max: s.size[1],
    min: s.size[0],
    maxLines: s.lines ?? 2,
    lineHeight: lh,
  });
  return {
    ...fit,
    font,
    weight,
    lh,
    height: fit.lines.length * fit.size * lh,
    width: Math.max(0, ...fit.widths),
  };
}
export type Align = 'right' | 'center' | 'left';
// Draws a fitted block with its top at y. `x` is the right edge, centre or left edge per align.
export function Lines({
  block,
  x,
  y,
  align = 'right',
  fill,
  slot,
  opacity,
  glow,
}: {
  block: Block;
  x: number;
  y: number;
  align?: Align;
  fill?: string;
  slot?: string;
  opacity?: number;
  glow?: boolean;
}) {
  const { P, id, editable } = usePoster();
  const anchor = align === 'right' ? 'start' : align === 'center' ? 'middle' : 'end';
  const lineBox = block.size * block.lh;
  const text = (
    <text
      direction="rtl"
      textAnchor={anchor}
      fontFamily={`'${block.font}'`}
      fontWeight={block.weight}
      fontSize={block.size}
      fill={fill ?? P.ink}
      opacity={opacity}
    >
      {block.lines.map((line, i) => (
        <tspan key={i} x={x} y={y + i * lineBox + lineBox / 2 + block.size * 0.34}>
          {line}
        </tspan>
      ))}
    </text>
  );
  const left = align === 'right' ? x - block.width : align === 'center' ? x - block.width / 2 : x;
  return (
    <g
      data-slot={slot}
      data-overflow={block.ok ? undefined : 'true'}
      className={slot && editable ? 'poster-slot' : undefined}
    >
      {slot && editable && (
        <rect
          className="poster-slot-hit"
          x={left - block.size * 0.25}
          y={y - block.size * 0.1}
          width={block.width + block.size * 0.5}
          height={block.height + block.size * 0.2}
          rx={block.size * 0.2}
          fill="transparent"
        />
      )}
      {glow && (
        <g filter={`url(#${id('soft-glow')})`} opacity={0.55}>
          {text}
        </g>
      )}
      {text}
    </g>
  );
}
// A fitted block inside a box, aligned horizontally and vertically.
export function Txt({
  box,
  text,
  slot,
  font = 'display',
  weight,
  size,
  lines = 2,
  lh,
  align = 'right',
  valign = 'top',
  fill,
  opacity,
  glow,
}: {
  box: Box;
  text: string;
  slot?: string;
  font?: 'display' | 'body';
  weight?: number;
  size: [number, number];
  lines?: number;
  lh?: number;
  align?: Align;
  valign?: 'top' | 'middle' | 'bottom';
  fill?: string;
  opacity?: number;
  glow?: boolean;
}) {
  const { P } = usePoster();
  const block = fitBlock(P, { text, w: box.w, h: box.h, font, weight, size, lines, lh });
  const x = align === 'right' ? box.x + box.w : align === 'center' ? box.x + box.w / 2 : box.x;
  const y =
    valign === 'top'
      ? box.y
      : valign === 'middle'
        ? box.y + (box.h - block.height) / 2
        : box.y + box.h - block.height;
  return (
    <Lines
      block={block}
      x={x}
      y={y}
      align={align}
      fill={fill}
      slot={slot}
      opacity={opacity}
      glow={glow}
    />
  );
}

// ---------- motifs ----------
export function archPath(x: number, y: number, w: number, h: number, rise = w / 2) {
  const r = w / 2;
  const ry = Math.min(rise, h);
  const spring = y + ry;
  return `M${x} ${y + h}V${spring}A${r} ${ry} 0 0 1 ${x + w} ${spring}V${y + h}Z`;
}
export function starPath(cx: number, cy: number, r: number, rot = 0) {
  const inner = r * 0.7654;
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = rot + (i * Math.PI) / 8 - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return d + 'Z';
}
export function Star({
  cx,
  cy,
  r,
  fill,
  stroke,
  sw,
  opacity,
}: {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  stroke?: string;
  sw?: number;
  opacity?: number;
}) {
  return (
    <path
      d={starPath(cx, cy, r, Math.PI / 8)}
      fill={fill ?? 'none'}
      stroke={stroke}
      strokeWidth={sw}
      opacity={opacity}
      strokeLinejoin="round"
    />
  );
}
export function Mark({ x, y, size }: { x: number; y: number; size: number }) {
  const { P } = usePoster();
  const k = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path fill={P.mark1} d="M13 20h18l37 43 19-3v17l-26 6-36-44-12 2Z" />
      <path fill={P.mark2} d="M87 20H69L32 63l-19-3v17l26 6 36-44 12 2Z" />
      <path
        d="M13 87c14 0 23 2 37 9 14-7 23-9 37-9"
        fill="none"
        stroke={P.mark2}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path fill={P.mark2} d="m41 28 9-11 9 11-9 11Z" />
    </g>
  );
}
// An image used as a stencil: the title lettering and the Vision 2030 mark take the ink colour.
export function Stencil({
  href,
  x,
  y,
  w,
  h,
  fill,
  opacity,
}: {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity?: number;
}) {
  const { id } = usePoster();
  const key = id(`st-${href.replace(/[^a-z0-9]/gi, '')}-${Math.round(x)}-${Math.round(y)}`);
  return (
    <g opacity={opacity}>
      <mask
        id={key}
        maskUnits="userSpaceOnUse"
        x={x}
        y={y}
        width={w}
        height={h}
        style={{ maskType: 'alpha' }}
      >
        <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
      </mask>
      <rect x={x} y={y} width={w} height={h} fill={fill} mask={`url(#${key})`} />
    </g>
  );
}
export const LETTERING = [
  { href: '/images/competition/type-ivory-0.png', ratio: 168 / 877 },
  { href: '/images/competition/type-ivory-1.png', ratio: 170 / 894 },
];
// The two-line competition title in its calligraphic lettering, right-aligned at x.
export function Lettering({ x, y, w, fill }: { x: number; y: number; w: number; fill?: string }) {
  const { P } = usePoster();
  const h0 = w * LETTERING[0].ratio,
    w1 = w * 0.94,
    h1 = w1 * LETTERING[1].ratio;
  return (
    <g>
      <Stencil href={LETTERING[0].href} x={x - w} y={y} w={w} h={h0} fill={fill ?? P.ink} />
      <Stencil
        href={LETTERING[1].href}
        x={x - w1}
        y={y + h0 * 0.92}
        w={w1}
        h={h1}
        fill={fill ?? P.ink}
      />
    </g>
  );
}
export const letteringHeight = (w: number) =>
  w * LETTERING[0].ratio * 0.92 + w * 0.94 * LETTERING[1].ratio;

export function GoldDefs() {
  const { P, id } = usePoster();
  return (
    <>
      <linearGradient id={id('gold')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.goldHi} />
        <stop offset="0.55" stopColor={P.gold} />
        <stop offset="1" stopColor={P.goldLo} />
      </linearGradient>
      <linearGradient id={id('gold-h')} x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor={P.goldLo} />
        <stop offset="0.5" stopColor={P.goldHi} />
        <stop offset="1" stopColor={P.gold} />
      </linearGradient>
      <radialGradient id={id('halo')} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={P.glow2} stopOpacity="0.55" />
        <stop offset="0.45" stopColor={P.glow2} stopOpacity="0.16" />
        <stop offset="1" stopColor={P.glow2} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('light')} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={P.tone === 'dark' ? '#fff8df' : '#ffffff'} stopOpacity="0.9" />
        <stop offset="0.4" stopColor={P.glow2} stopOpacity="0.28" />
        <stop offset="1" stopColor={P.glow2} stopOpacity="0" />
      </radialGradient>
      <filter id={id('soft-glow')} x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
      <filter id={id('lift')} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" floodColor={P.shade} floodOpacity="1" />
      </filter>
      <filter id={id('lift-sm')} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="9" floodColor={P.shade} floodOpacity="0.85" />
      </filter>
    </>
  );
}
export const gold = (id: (n: string) => string) => `url(#${id('gold')})`;

// Background: identity gradient, light, weave lattice, grain, vignette and the gold frame.
function Backdrop({ frame }: { frame: boolean }) {
  const { P, L, id } = usePoster();
  const { w, h, u } = L;
  const t = 14 * u;
  const fi = 2.6 * u;
  const dark = P.tone === 'dark';
  return (
    <>
      <defs>
        <linearGradient id={id('bg')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.bg0} />
          <stop offset="1" stopColor={P.bg1} />
        </linearGradient>
        <radialGradient id={id('bg-glow')} cx="0.78" cy="0.16" r="0.75">
          <stop offset="0" stopColor={P.glow} stopOpacity={dark ? 0.75 : 0.9} />
          <stop offset="1" stopColor={P.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('bg-gold')} cx="0.12" cy="0.92" r="0.6">
          <stop offset="0" stopColor={P.glow2} stopOpacity={dark ? 0.16 : 0.12} />
          <stop offset="1" stopColor={P.glow2} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('vignette')} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={dark ? 0.38 : 0.06} />
        </radialGradient>
        <pattern
          id={id('weave')}
          width="120"
          height="120"
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${t / 120})`}
        >
          <g fill="none" stroke={P.weave} strokeWidth="0.8">
            <path d="m0 30 30-30 60 60 30-30M0 90l30 30 60-60 30 30M0 34 30 4l60 60 30-30M0 86l30 30 60-60 30 30" />
            <path d="m30 0 30 30-60 60 30 30M90 0 60 30l60 60-30 30" opacity=".5" />
            <path d="m56 60 4-4 4 4-4 4Z" fill={P.weave} stroke="none" />
          </g>
        </pattern>
        <filter id={id('noise')} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            values={
              dark
                ? '0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.86  0 0 0 0.9 0'
                : '0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.12  0 0 0 0.9 0'
            }
          />
        </filter>
        <pattern id={id('grain')} width="220" height="220" patternUnits="userSpaceOnUse">
          <rect width="220" height="220" filter={`url(#${id('noise')})`} />
        </pattern>
        <radialGradient id={id('weave-fade')} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </radialGradient>
        <mask id={id('weave-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
          <rect width={w} height={h} fill={`url(#${id('weave-fade')})`} />
        </mask>
      </defs>
      <rect width={w} height={h} fill={`url(#${id('bg')})`} />
      <rect width={w} height={h} fill={`url(#${id('bg-glow')})`} />
      <rect width={w} height={h} fill={`url(#${id('bg-gold')})`} />
      <rect
        width={w}
        height={h}
        fill={`url(#${id('weave')})`}
        opacity={P.weaveOpacity}
        mask={`url(#${id('weave-mask')})`}
      />
      <rect width={w} height={h} fill={`url(#${id('grain')})`} opacity={P.grain} />
      <rect width={w} height={h} fill={`url(#${id('vignette')})`} />
      {L.shape === 'tall' &&
        (() => {
          const top = L.header.y + L.header.h + 1.5 * u;
          const x = 5 * u,
            aw = w - 10 * u;
          return (
            <g opacity={dark ? 0.55 : 0.65}>
              <path
                d={archPath(x, top, aw, h - 5 * u - top, aw * 0.26)}
                fill="none"
                stroke={P.line}
                strokeWidth={0.18 * u}
              />
              <path
                d={archPath(x + 1.4 * u, top + 1.4 * u, aw - 2.8 * u, h - 7.8 * u - top, aw * 0.25)}
                fill="none"
                stroke={P.line}
                strokeWidth={0.08 * u}
                opacity={0.6}
              />
              <Star cx={w / 2} cy={top} r={1.4 * u} fill={P.line} />
            </g>
          );
        })()}
      {frame && (
        <g>
          <rect
            x={fi}
            y={fi}
            width={w - 2 * fi}
            height={h - 2 * fi}
            rx={1.2 * u}
            fill="none"
            stroke={P.line}
            strokeWidth={Math.max(1.4, 0.16 * u)}
            opacity={dark ? 0.42 : 0.5}
          />
          {[
            [fi, fi],
            [w - fi, fi],
            [fi, h - fi],
            [w - fi, h - fi],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <Star cx={cx} cy={cy} r={1.5 * u} fill={P.tone === 'dark' ? P.bg1 : P.bg0} />
              <Star
                cx={cx}
                cy={cy}
                r={1.5 * u}
                stroke={P.line}
                sw={Math.max(1.2, 0.14 * u)}
                opacity={0.85}
              />
              <circle cx={cx} cy={cy} r={0.35 * u} fill={P.line} opacity={0.9} />
            </g>
          ))}
        </g>
      )}
    </>
  );
}

// Brand lockup (right) and Vision 2030 (left).
function Header() {
  const { P, L } = usePoster();
  const { header: b, u } = L;
  const markSize = b.h;
  const right = b.x + b.w;
  const letterW = Math.min(b.w * 0.42, b.h * 3.9);
  const lettersH = letteringHeight(letterW);
  const visionH = b.h * 0.78;
  const visionW = visionH * (480 / 321);
  return (
    <g>
      {P.identity === 'official' ? (
        <image
          href="/images/identity/authority-logo.png"
          x={right - markSize}
          y={b.y}
          width={markSize}
          height={markSize}
        />
      ) : (
        <Mark x={right - markSize} y={b.y} size={markSize} />
      )}
      <Lettering x={right - markSize - 1.6 * u} y={b.y + (b.h - lettersH) / 2} w={letterW} />
      <Stencil
        href="/images/ceremony/vision2030-ivory.png"
        x={b.x}
        y={b.y + (b.h - visionH) / 2}
        w={visionW}
        h={visionH}
        fill={P.ink}
        opacity={0.82}
      />
    </g>
  );
}

// ---------- QR tile ----------
export function QrTile({ box, link, style }: { box: Box; link: string; style: QrStyle }) {
  const { P, L, id } = usePoster();
  const paths = useMemo(() => qrPaths(qrMatrix(link, qrLevel(style)), style), [link, style]);
  const n = paths.size;
  const unit = box.w / (n + 4);
  const inner = 2 * unit;
  const r = 1.6 * L.u;
  return (
    <g data-qr="true" data-x={box.x} data-y={box.y} data-size={box.w}>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={r}
        fill={P.tile}
        filter={`url(#${id('lift-sm')})`}
      />
      <g transform={`translate(${box.x + inner} ${box.y + inner}) scale(${unit})`}>
        <path d={paths.modules} fill={P.qrInk} />
        <path d={paths.eyes} fill={P.qrInk} fillRule="evenodd" />
        {paths.seal && (
          <g>
            <circle
              cx={paths.seal.start + paths.seal.size / 2}
              cy={paths.seal.start + paths.seal.size / 2}
              r={paths.seal.size / 2 - 0.3}
              fill={P.tile}
              stroke={P.qrInk}
              strokeWidth={0.22}
            />
            <g
              transform={`translate(${paths.seal.start + 1.35} ${paths.seal.start + 1.25}) scale(${(paths.seal.size - 2.7) / 100})`}
            >
              <path
                fill={P.identity === 'official' ? '#00a4e0' : '#b49250'}
                d="M13 20h18l37 43 19-3v17l-26 6-36-44-12 2Z"
              />
              <path fill={P.qrInk} d="M87 20H69L32 63l-19-3v17l26 6 36-44 12 2Z" />
              <path fill={P.qrInk} d="m41 28 9-11 9 11-9 11Z" />
            </g>
          </g>
        )}
      </g>
    </g>
  );
}

// Call to action, link and freshness stamp; the QR tile sits beside them when shown.
function Footer({
  link,
  cta,
  stamp,
  qrStyle,
}: {
  link: string | null;
  cta: string;
  stamp: string | null;
  qrStyle: QrStyle;
}) {
  const { P, L } = usePoster();
  const { footer: f, u, qr } = L;
  const textRight = f.x + f.w;
  const textLeft = qr && !L.wide ? qr.x + qr.w + 4 * u : f.x;
  const tw = textRight - textLeft;
  const ctaBlock = fitBlock(P, {
    text: cta,
    w: tw,
    h: 9 * u,
    font: 'body',
    weight: 700,
    size: [2.6 * u, 3.6 * u],
    lines: 1,
  });
  const linkSize = (L.wide ? 2.3 : 2.25) * u;
  const linkText = link ? displayLink(link) : '';
  const linkW = link ? measure(linkText, SANS, 500, linkSize) : 0;
  const stampSize = 1.85 * u;
  const linkH = link ? linkSize * 1.75 : 0;
  const stampH = stamp ? stampSize * 1.9 : 0;
  const total = ctaBlock.height + linkH + stampH;
  const ctaY = qr && !L.wide ? f.y + (f.h - total) / 2 : f.y + f.h - total;
  const linkY = ctaY + ctaBlock.height;
  const stampY = linkY + linkH;
  const ruleY = f.y - 2.2 * u;
  return (
    <g>
      {!L.wide && (
        <g opacity={0.7}>
          <line
            x1={f.x}
            x2={f.x + f.w / 2 - 2.4 * u}
            y1={ruleY}
            y2={ruleY}
            stroke={P.line}
            strokeWidth={Math.max(1, 0.12 * u)}
          />
          <line
            x1={f.x + f.w / 2 + 2.4 * u}
            x2={f.x + f.w}
            y1={ruleY}
            y2={ruleY}
            stroke={P.line}
            strokeWidth={Math.max(1, 0.12 * u)}
          />
          <Star
            cx={f.x + f.w / 2}
            cy={ruleY}
            r={1.1 * u}
            stroke={P.line}
            sw={Math.max(1, 0.12 * u)}
          />
        </g>
      )}
      <Lines block={ctaBlock} x={textRight} y={ctaY} slot="cta" />
      {link && (
        <text
          x={textRight}
          y={linkY + linkSize * 1.2}
          direction="ltr"
          textAnchor="end"
          fontFamily={`'${SANS}'`}
          fontWeight={500}
          fontSize={linkW > tw ? linkSize * (tw / linkW) : linkSize}
          fill={P.gold}
        >
          {linkText}
        </text>
      )}
      {stamp && (
        <text
          x={textRight}
          y={stampY + stampSize * 1.3}
          direction="rtl"
          textAnchor="start"
          fontFamily={`'${P.body}'`}
          fontWeight={400}
          fontSize={stampSize}
          fill={P.faint}
        >
          {stamp}
        </text>
      )}
      {qr && link && <QrTile box={qr} link={link} style={qrStyle} />}
    </g>
  );
}

function Watermark() {
  const { L } = usePoster();
  const { w, h, u } = L;
  const band = 9 * u;
  const text = Array.from({ length: 6 }, () => 'معاينة · بيانات محاكاة · لا تُنشر').join('     ');
  return (
    <g transform={`rotate(-18 ${w / 2} ${h / 2})`} pointerEvents="none" data-watermark="true">
      <rect x={-w} y={h / 2 - band / 2} width={w * 3} height={band} fill="#9a3328" opacity={0.86} />
      <text
        x={w / 2}
        y={h / 2 + band * 0.14}
        textAnchor="middle"
        direction="rtl"
        fontFamily={`'${SANS}'`}
        fontWeight={700}
        fontSize={band * 0.38}
        fill="#fff"
      >
        {text}
      </text>
    </g>
  );
}

export type FrameSpec = {
  format: PosterFormat;
  identity: Identity;
  tone: Tone;
  qr: { on: boolean; style: QrStyle };
  link: string | null;
  cta: string;
  stamp: string | null;
  frame?: boolean;
  // Simulation previews carry a band that keeps them from being mistaken for real numbers.
  watermark?: boolean;
};
// The whole poster: an SVG at the format's native size with the shared chrome and the body.
export function PosterFrame({
  spec,
  editable = false,
  children,
  label,
}: {
  spec: FrameSpec;
  editable?: boolean;
  children: (ctx: { P: Palette; L: Layout; id: (n: string) => string }) => ReactNode;
  label: string;
}) {
  const raw = useId();
  const prefix = 'p' + raw.replace(/[^a-zA-Z0-9]/g, '');
  const P = palette(spec.identity, spec.tone);
  const L = layout(spec.format, spec.qr.on && !!spec.link);
  const id = (name: string) => `${prefix}-${name}`;
  const value = { P, L, id, editable };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${L.w} ${L.h}`}
      width={L.w}
      height={L.h}
      role="img"
      aria-label={label}
      className="poster-svg"
      data-poster="true"
    >
      <Ctx.Provider value={value}>
        <defs>
          <GoldDefs />
        </defs>
        <Backdrop frame={spec.frame !== false} />
        <Header />
        {children({ P, L, id })}
        <Footer link={spec.link} cta={spec.cta} stamp={spec.stamp} qrStyle={spec.qr.style} />
        {spec.watermark && <Watermark />}
      </Ctx.Provider>
    </svg>
  );
}
