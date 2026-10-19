'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { educationalPartners, successPartners } from '@/lib/organizations';

// Shared machinery for the launch ceremony designs. Every design is drawn on a fixed 1600×900
// stage that the studio scales to the screen, and moves through the same four parts.
export const STAGE_W = 1600;
export const STAGE_H = 900;
export type Step = 'idle' | 'launch' | 'video' | 'ending';
export type CeremonyHandle = { go: (step: Step) => void };
export type DesignProps = { videoSeconds: number; onStep: (step: Step) => void };

export function useTimers() {
  const ids = useRef<number[]>([]);
  const clear = useCallback(() => {
    ids.current.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    ids.current = [];
  }, []);
  const later = useCallback((ms: number, fn: () => void) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
  const every = useCallback((ms: number, fn: () => void) => {
    ids.current.push(window.setInterval(fn, ms));
  }, []);
  useEffect(() => clear, [clear]);
  return { clear, later, every };
}

type PointerOptions = {
  magnet?: RefObject<HTMLElement | null>;
  radius?: number;
  wander?: (seconds: number) => [number, number];
  onFrame?: (dt: number, time: number) => void;
};
export type StagePointer = { x: number; y: number; inside: boolean; moved: number };

// Eases the cursor into --mx/--my (-1..1) on the stage root, and a magnetic pull toward one control
// into --bx/--by. With no cursor movement for a while, a slow path keeps every layer drifting, so
// the screen is never still even when nobody touches it.
export function useStagePointer(root: RefObject<HTMLElement | null>, options: PointerOptions = {}) {
  const opts = useRef(options);
  opts.current = options;
  const pointer = useRef<StagePointer>({
    x: STAGE_W / 2,
    y: STAGE_H / 2,
    inside: false,
    moved: -1e9,
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const mag = { x: 0, y: 0 };
    const magT = { x: 0, y: 0 };
    let last = 0;
    let frame = 0;
    const written: Record<string, string> = {};
    const set = (name: string, value: string) => {
      if (written[name] === value) return;
      written[name] = value;
      el.style.setProperty(name, value);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      const k = STAGE_W / r.width;
      pointer.current = {
        x: (e.clientX - r.left) * k,
        y: (e.clientY - r.top) * k,
        inside: true,
        moved: performance.now(),
      };
      const anchor = opts.current.magnet?.current;
      if (anchor) {
        const b = anchor.getBoundingClientRect();
        const dx = (e.clientX - (b.left + b.width / 2)) * k;
        const dy = (e.clientY - (b.top + b.height / 2)) * k;
        const radius = opts.current.radius ?? 280;
        const f = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
        magT.x = (dx / radius) * f * 1.6;
        magT.y = (dy / radius) * f * 1.6;
      }
    };
    const leave = () => {
      pointer.current = { ...pointer.current, inside: false, moved: -1e9 };
      magT.x = 0;
      magT.y = 0;
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    const tick = (t: number) => {
      const dt = Math.min(64, t - (last || t));
      last = t;
      let tx = target.x;
      let ty = target.y;
      if (t - pointer.current.moved > 2600) {
        const s = t / 1000;
        [tx, ty] = opts.current.wander?.(s) ?? [
          Math.sin(s * 0.27) * 0.6 + Math.sin(s * 0.61) * 0.15,
          Math.cos(s * 0.21) * 0.35 - 0.1,
        ];
      }
      cur.x += (tx - cur.x) * 0.05;
      cur.y += (ty - cur.y) * 0.05;
      mag.x += (magT.x - mag.x) * 0.12;
      mag.y += (magT.y - mag.y) * 0.12;
      // Three decimals are below a pixel of movement; unchanged values skip the style work.
      set('--mx', cur.x.toFixed(3));
      set('--my', cur.y.toFixed(3));
      set('--bx', mag.x.toFixed(3));
      set('--by', mag.y.toFixed(3));
      opts.current.onFrame?.(dt, t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [root]);
  return pointer;
}

// Deterministic, so the server render and the browser agree on every particle.
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const arNum = (n: number, min = 1) =>
  n.toLocaleString('ar-SA-u-nu-arab', { minimumIntegerDigits: min, useGrouping: false });
export const clock = (seconds: number) =>
  `${arNum(Math.floor(seconds / 60), 2)}:${arNum(Math.max(0, seconds) % 60, 2)}`;

export function launchLines(at: number) {
  const when = new Date(at || Date.now());
  const fmt = (locale: string, o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Riyadh', ...o }).format(when);
    } catch {
      return '';
    }
  };
  return {
    date: `${fmt('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' })} · ${fmt('ar-SA-u-ca-gregory-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    time: fmt('ar-SA-u-ca-gregory-nu-arab', { hour: 'numeric', minute: '2-digit' }),
  };
}

// The film's countdown: seconds left, then the ending.
export function useFilm(active: boolean, seconds: number, onDone: () => void) {
  const done = useRef(onDone);
  done.current = onDone;
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    let remaining = seconds;
    setLeft(remaining);
    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(id);
        done.current();
      } else setLeft(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [active, seconds]);
  return left;
}

// Ticks once a second while the ending shows "time since launch".
export function useSince(launchedAt: number, active: boolean) {
  const [now, setNow] = useState(() => launchedAt || 0);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return launchedAt ? Math.max(0, Math.floor((now - launchedAt) / 1000)) : 0;
}

export const partnerLogos = [...successPartners, ...educationalPartners];
export function PartnerTrack({ className }: { className: string }) {
  // Two copies side by side; the track moves by half its width for a seamless loop.
  return (
    <div className={className}>
      {[0, 1].flatMap((copy) =>
        partnerLogos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${copy}-${p.src}`} src={p.src} alt={copy ? '' : p.name} />
        )),
      )}
    </div>
  );
}

export function Grain({ id, className }: { id: string; className: string }) {
  return (
    <div className="ceremony-grainbox" aria-hidden="true">
      <div className={className}>
        <svg>
          <filter id={id}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${id})`} />
        </svg>
      </div>
    </div>
  );
}

export const QR_SRC = '/images/ceremony/register-qr.svg';
export const REGISTER_URL = 'nbc-web-two.vercel.app/register';
export const AUTHORITY_LOGO = '/images/identity/authority-logo.png';
export const VISION_LOGO = '/images/ceremony/vision2030-ivory.png';
export const TITLE_IMAGES = [
  '/images/competition/type-ivory-0.png',
  '/images/competition/type-ivory-1.png',
];
