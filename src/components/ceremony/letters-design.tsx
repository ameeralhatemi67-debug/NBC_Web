'use client';
/* eslint-disable @next/next/no-img-element */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AUTHORITY_LOGO,
  Grain,
  PartnerTrack,
  QR_SRC,
  REGISTER_URL,
  STAGE_H,
  STAGE_W,
  TITLE_IMAGES,
  VISION_LOGO,
  clock,
  launchLines,
  seeded,
  useFilm,
  useSince,
  useStagePointer,
  useTimers,
  type CeremonyHandle,
  type DesignProps,
  type StagePointer,
} from './ceremony-kit';

type Phase = 'idle' | 'write' | 'video' | 'ending';
type Rect = { x: number; y: number; w: number; h: number };
const WRITE_MS = 4800;
const BURST_AT = 3700;
const ORB = { x: 800, y: 668 };
// Where the two title lines sit while the letters are written, and smaller above the ending.
const TITLE_RECTS: Rect[] = [
  { x: 370, y: 150, w: 860, h: 165 },
  { x: 362, y: 334, w: 876, h: 167 },
];
const ENDING_RECTS: Rect[] = [
  { x: 560, y: 104, w: 480, h: 92 },
  { x: 555, y: 202, w: 490, h: 93 },
];
const COUNT = 2700;
const TITLE_MAX = 2350;

// Design 2, letters of light: gold particles drift right to left like a line being read. The Emir
// touches the orb; the particles write the competition's name, hold, and burst into the film.
export const LettersDesign = forwardRef<CeremonyHandle, DesignProps>(function LettersDesign(
  { videoSeconds, onStep },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [hover, setHover] = useState(false);
  const [launchedAt, setLaunchedAt] = useState(0);
  const engine = useRef({ phase: 'idle' as Phase, since: 0, hover: false });
  const timers = useTimers();

  function setMode(next: Phase) {
    engine.current = { ...engine.current, phase: next, since: performance.now() };
    setPhase(next);
  }
  function start() {
    if (engine.current.phase !== 'idle') return;
    timers.clear();
    setMode('write');
    setHover(false);
    engine.current.hover = false;
    setLaunchedAt(Date.now());
    onStep('launch');
    timers.later(WRITE_MS, video);
  }
  function video() {
    timers.clear();
    setMode('video');
    setLaunchedAt((at) => at || Date.now());
    onStep('video');
  }
  function ending() {
    timers.clear();
    setMode('ending');
    setLaunchedAt((at) => at || Date.now());
    onStep('ending');
  }
  function restart() {
    timers.clear();
    setMode('idle');
    setHover(false);
    engine.current.hover = false;
    setLaunchedAt(0);
    onStep('idle');
  }
  useImperativeHandle(ref, () => ({
    go: (step) => {
      if (step === 'idle') restart();
      else if (step === 'launch') {
        restart();
        start();
      } else if (step === 'video') video();
      else ending();
    },
  }));

  const pointer = useStagePointer(root, {
    magnet: anchor,
    radius: 300,
    wander: (s) => [
      Math.sin(s * 0.19) * 0.5 + Math.sin(s * 0.47) * 0.14,
      Math.cos(s * 0.23) * 0.32 - 0.08,
    ],
  });
  useParticles(canvas, engine, pointer);

  const left = useFilm(phase === 'video', videoSeconds, ending);
  const since = useSince(launchedAt, phase === 'ending');
  const lines = launchLines(launchedAt);

  return (
    <div ref={root} className={`cl-root phase-${phase}${hover ? ' is-hover' : ''}`}>
      <div className="cl-layer cl-ground" />
      <div className="cl-layer cl-lat" />
      <div className="cl-layer cl-pools" aria-hidden="true">
        <span className="p1" />
        <span className="p2" />
        <span className="p3" />
      </div>
      <svg className="cl-star s1" viewBox="-100 -100 200 200" aria-hidden="true">
        <path d="M0,-96L96,0L0,96L-96,0Z M-68,-68H68V68H-68Z" />
        <circle r="40" />
        <circle r="64" />
      </svg>
      <svg className="cl-star s2" viewBox="-100 -100 200 200" aria-hidden="true">
        <path d="M0,-96L96,0L0,96L-96,0Z M-68,-68H68V68H-68Z" />
      </svg>
      <div className="cl-layer cl-lines" aria-hidden="true" />

      <div className="cl-ghost" aria-hidden="true">
        {TITLE_RECTS.map((r, i) => (
          <span
            key={i}
            className={`cl-ghostword w${i}`}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          >
            <img src={TITLE_IMAGES[i]} alt="" />
            <span className="cl-sheen" />
          </span>
        ))}
      </div>
      <span className="cl-underline" aria-hidden="true" />
      <canvas ref={canvas} className="cl-canvas" aria-hidden="true" />

      <header className="cl-head">
        <div className="cl-logo">
          <img
            src={AUTHORITY_LOGO}
            alt="شعار الرئاسة العامة لهيئة الأمر بالمعروف والنهي عن المنكر"
          />
        </div>
        <img className="cl-v2030" src={VISION_LOGO} alt="رؤية المملكة ٢٠٣٠" />
        <div className="cl-eyebrow">
          <i />
          حفل التدشين الرسمي
          <i />
        </div>
        <p className="cl-patron">برعاية صاحب السمو الملكي أمير المنطقة الشرقية</p>
        <h1 className="sr-only">مسابقة الانتماء واللحمة الوطنية</h1>
      </header>

      <div className="cl-anchor" ref={anchor}>
        <div className="cl-orbwrap">
          <span className="cl-gyro g1" />
          <span className="cl-gyro g2" />
          <span className="cl-gyro g3" />
          <span className="cl-halo" />
          <button
            type="button"
            className="cl-orb"
            aria-label="المس النور لتكتمل حروف المسابقة وتنطلق"
            onClick={start}
            onMouseEnter={() => {
              if (engine.current.phase !== 'idle') return;
              engine.current.hover = true;
              setHover(true);
            }}
            onMouseLeave={() => {
              engine.current.hover = false;
              setHover(false);
            }}
            onFocus={() => {
              if (engine.current.phase !== 'idle') return;
              engine.current.hover = true;
              setHover(true);
            }}
            onBlur={() => {
              engine.current.hover = false;
              setHover(false);
            }}
          >
            <span className="cl-swirl" />
            <span className="cl-glass" />
          </button>
        </div>
      </div>
      <p className="cl-cta">
        المس النور لتكتمل حروف المسابقة
        <small>تكتب الحروف اسم المسابقة من اليمين إلى اليسار، ثم يبدأ الفيلم</small>
      </p>
      <span className="cl-year">١٤٤٨هـ · ٢٠٢٦م</span>

      <div className="cl-layer cl-white" />

      <div className="cl-cinema" aria-hidden={phase !== 'video'}>
        {phase === 'video' && (
          <>
            <div className="cl-screen">
              <div className="cl-leak l1" />
              <div className="cl-leak l2" />
              <span className="cl-orn o1" />
              <span className="cl-orn o2" />
              <span className="cl-orn o3" />
              <span className="cl-orn o4" />
              <div className="cl-filmcenter">
                <div className="cl-play">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                </div>
                <span className="cl-filmbadge">الفيلم الافتتاحي</span>
                <span className="cl-filmtitle">[ يُعرض هنا الفيلم المعدّ من فريق الإنتاج ]</span>
                <span className="cl-filmsub">
                  يبدأ بعد أن تكتب الحروف اسم المسابقة، وينتقل العرض إلى الختام عند انتهائه
                </span>
              </div>
              <div className="cl-bar">
                <i style={{ animationDuration: `${videoSeconds}s` }} />
                <b style={{ animationDuration: `${videoSeconds}s` }} />
              </div>
            </div>
            <div className="cl-filmmeta">
              <span className="dot" />
              يُعرض الآن · المتبقي <bdi>{clock(left)}</bdi>
            </div>
            <button type="button" className="cl-skip" onClick={ending}>
              تخطّي إلى الختام
              <span>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3 5 8l5 5" />
                </svg>
              </span>
            </button>
          </>
        )}
      </div>

      {phase === 'ending' && (
        <div className="cl-end">
          <span className="cl-endpill cl-in">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            دُشّنت رسميًا
          </span>
          <div className="cl-endhwrap cl-in" style={{ animationDelay: '.9s' }}>
            <h2 className="cl-endh">انطلقت المسابقة</h2>
          </div>
          <p className="cl-enddate cl-in" style={{ animationDelay: '1.05s' }}>
            <b>{lines.time}</b> · {lines.date}
          </p>
          <div className="cl-stats">
            {[
              ['٣', 'مراحل دراسية', 'المتوسطة · الثانوية · الجامعية'],
              ['١٢', 'مدينة', 'في المنطقة الشرقية'],
              ['٥٢٬٠٠٠', 'ريال', 'جوائز المسابقة'],
            ].map(([n, unit, note], i) => (
              <div
                key={unit}
                className="cl-shell cl-in"
                style={{ animationDelay: `${1.15 + i * 0.12}s` }}
              >
                <div className="cl-card">
                  <b>
                    {n} <small>{unit}</small>
                  </b>
                  <span>{note}</span>
                </div>
              </div>
            ))}
          </div>
          <aside className="cl-qr cl-in" style={{ animationDelay: '1.5s' }}>
            <div className="cl-shell" style={{ borderRadius: 30 }}>
              <div className="cl-qrcard">
                <h3>سجّل الآن</h3>
                <div className="cl-qrimg">
                  <img src={QR_SRC} alt="رمز الاستجابة السريعة لصفحة التسجيل" />
                </div>
                <p>
                  امسح الرمز بكاميرا الجوال
                  <br />
                  <code>{REGISTER_URL}</code>
                </p>
              </div>
            </div>
          </aside>
          <aside className="cl-live cl-in" style={{ animationDelay: '1.6s' }}>
            <div className="cl-shell">
              <div className="cl-livecard">
                <small>منذ لحظة التدشين</small>
                <strong>{clock(since)}</strong>
              </div>
            </div>
            <div className="cl-open">
              <i />
              باب التسجيل مفتوح الآن
            </div>
          </aside>
          <div className="cl-partners cl-in" style={{ animationDelay: '1.75s' }}>
            <div className="cl-partners-in">
              <PartnerTrack className="cl-track" />
            </div>
          </div>
        </div>
      )}

      <div className="cl-layer cl-vignette" aria-hidden="true" />
      <Grain id="cl-noise" className="cl-grain" />
    </div>
  );
});

type Engine = { phase: Phase; since: number; hover: boolean };

// The particle field, drawn on one canvas. Positions are in stage pixels; the canvas renders at
// the device's pixel density so the letters stay sharp when the stage is scaled up.
function useParticles(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  engine: React.RefObject<Engine>,
  pointer: React.RefObject<StagePointer>,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let alive = true;
    let frame = 0;
    const dpr = Math.min(1.75, (window.devicePixelRatio || 1) * 1.25);
    canvas.width = Math.round(STAGE_W * dpr);
    canvas.height = Math.round(STAGE_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rnd = seeded(2026);
    const x = new Float32Array(COUNT);
    const y = new Float32Array(COUNT);
    const vx = new Float32Array(COUNT);
    const vy = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const base = new Float32Array(COUNT);
    const twinkle = new Float32Array(COUNT);
    const tx = new Float32Array(COUNT);
    const ty = new Float32Array(COUNT);
    const ex = new Float32Array(COUNT);
    const ey = new Float32Array(COUNT);
    const delay = new Float32Array(COUNT);
    let titled = 0;
    for (let i = 0; i < COUNT; i++) {
      x[i] = rnd() * STAGE_W;
      // Denser across the band where the title will be written.
      y[i] = rnd() < 0.6 ? 110 + rnd() * 440 : rnd() * STAGE_H;
      size[i] = 1.6 + rnd() * rnd() * 4.4;
      base[i] = 0.3 + rnd() * 0.6;
      twinkle[i] = rnd() * Math.PI * 2;
    }

    // Sample the title lettering; each sampled point becomes one particle's place in the word.
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    Promise.all(TITLE_IMAGES.map(load))
      .then((images) => {
        if (!alive) return;
        const points: { u: number; v: number; line: number }[] = [];
        images.forEach((img, line) => {
          const r = TITLE_RECTS[line];
          const off = document.createElement('canvas');
          off.width = Math.round(r.w);
          off.height = Math.round(r.h);
          const o = off.getContext('2d');
          if (!o) return;
          o.drawImage(img, 0, 0, off.width, off.height);
          const data = o.getImageData(0, 0, off.width, off.height).data;
          for (let py = 0; py < off.height; py += 3)
            for (let px = 0; px < off.width; px += 3)
              if (data[(py * off.width + px) * 4 + 3] > 120)
                points.push({ u: px / off.width, v: py / off.height, line });
        });
        for (let i = points.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [points[i], points[j]] = [points[j], points[i]];
        }
        titled = Math.min(TITLE_MAX, points.length);
        for (let i = 0; i < titled; i++) {
          const p = points[i];
          const a = TITLE_RECTS[p.line];
          const b = ENDING_RECTS[p.line];
          tx[i] = a.x + p.u * a.w;
          ty[i] = a.y + p.v * a.h;
          ex[i] = b.x + p.u * b.w;
          ey[i] = b.y + p.v * b.h;
          // Right to left, the way Arabic is written, with a little scatter.
          delay[i] = ((a.x + a.w - tx[i]) / a.w) * 1250 + p.line * 260 + rnd() * 260;
          size[i] = 2.2 + rnd() * 2.6;
        }
      })
      .catch(() => {});

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const s = sprite.getContext('2d');
    if (s) {
      const g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,250,232,1)');
      g.addColorStop(0.22, 'rgba(244,222,160,.9)');
      g.addColorStop(0.55, 'rgba(207,183,121,.25)');
      g.addColorStop(1, 'rgba(207,183,121,0)');
      s.fillStyle = g;
      s.fillRect(0, 0, 32, 32);
    }

    let burst = false;
    let last = performance.now();
    const draw = (now: number) => {
      if (!alive) return;
      frame = requestAnimationFrame(draw);
      const dt = Math.min(2.2, (now - last) / 16.67);
      last = now;
      const { phase, since, hover } = engine.current;
      if (phase === 'video') {
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        burst = false;
        return;
      }
      const elapsed = now - since;
      const t = now;
      const pt = pointer.current;
      const writing = phase === 'write';
      if (writing && elapsed >= BURST_AT && !burst) {
        burst = true;
        for (let i = 0; i < COUNT; i++) {
          const dx = x[i] - 800;
          const dy = y[i] - 330;
          const d = Math.hypot(dx, dy) || 1;
          const speed = 9 + rnd() * 20;
          vx[i] = (dx / d) * speed;
          vy[i] = (dy / d) * speed * 0.8;
        }
      }
      if (!writing) burst = false;
      const fade = writing && burst ? Math.max(0, 1 - (elapsed - BURST_AT) / 900) : 1;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${writing && !burst ? 0.42 : phase === 'ending' ? 0.4 : 0.24})`;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.globalCompositeOperation = 'lighter';

      const sweep = writing && elapsed > 2500 ? 1320 - ((elapsed - 2500) / 1000) * 1150 : -9999;
      for (let i = 0; i < COUNT; i++) {
        const isTitle = i < titled;
        let glow = 1;
        if (writing && !burst && isTitle && elapsed > delay[i]) {
          // Spring toward the particle's place in the letters.
          vx[i] = (vx[i] + (tx[i] - x[i]) * 0.02 * dt) * 0.85;
          vy[i] = (vy[i] + (ty[i] - y[i]) * 0.02 * dt) * 0.85;
          if (Math.abs(x[i] - sweep) < 60) glow = 2.4 - Math.abs(x[i] - sweep) / 40;
        } else if (phase === 'ending' && isTitle) {
          const j = Math.sin(t * 0.0016 + twinkle[i]) * 0.7;
          vx[i] = (vx[i] + (ex[i] + j - x[i]) * 0.012 * dt) * 0.86;
          vy[i] = (vy[i] + (ey[i] - j - y[i]) * 0.012 * dt) * 0.86;
        } else if (burst) {
          vx[i] *= 0.965;
          vy[i] *= 0.965;
        } else {
          // Reading current: right to left, folded by a slow field.
          const a =
            Math.sin(x[i] * 0.0021 + t * 0.00011) * 1.3 +
            Math.cos(y[i] * 0.0034 - t * 0.00007) * 1.1 +
            Math.sin((x[i] + y[i]) * 0.0012 + t * 0.00005);
          const calm = phase === 'ending' ? 0.45 : writing ? 0.7 : 1;
          vx[i] += ((-0.6 + Math.cos(a) * 0.45) * calm - vx[i]) * 0.04 * dt;
          vy[i] += (Math.sin(a) * 0.5 * calm - vy[i]) * 0.04 * dt;
          if (phase === 'idle') {
            if (pt.inside) {
              const dx = x[i] - pt.x;
              const dy = y[i] - pt.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 32400) {
                const d = Math.sqrt(d2) || 1;
                const f = 1 - d / 180;
                vx[i] += ((-dy / d) * 0.9 + (dx / d) * 0.3) * f * dt;
                vy[i] += ((dx / d) * 0.9 + (dy / d) * 0.3) * f * dt;
                glow = 1 + f;
              }
            }
            const ox = x[i] - ORB.x;
            const oy = y[i] - ORB.y;
            const od = Math.hypot(ox, oy) || 1;
            const reach = hover ? 460 : 190;
            if (od < reach) {
              const f = 1 - od / reach;
              const pull = (od - 112) * -0.012 * f * (hover ? 1 : 0.35);
              vx[i] += ((ox / od) * pull + (-oy / od) * 0.55 * f) * dt;
              vy[i] += ((oy / od) * pull + (ox / od) * 0.55 * f) * dt;
              glow = Math.max(glow, 1 + f * (hover ? 1.4 : 0.6));
            }
          }
        }
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        if (!burst && !(writing && isTitle) && !(phase === 'ending' && isTitle)) {
          if (x[i] < -12) x[i] += STAGE_W + 24;
          else if (x[i] > STAGE_W + 12) x[i] -= STAGE_W + 24;
          if (y[i] < -12) y[i] += STAGE_H + 24;
          else if (y[i] > STAGE_H + 12) y[i] -= STAGE_H + 24;
        }
        let alpha = base[i] * (0.62 + 0.38 * Math.sin(t * 0.0021 + twinkle[i])) * glow * fade;
        if (writing && !isTitle) alpha *= 0.35;
        if (phase === 'ending' && !isTitle) alpha *= 0.3;
        if (alpha < 0.02) continue;
        ctx.globalAlpha = Math.min(1, alpha);
        const r = size[i] * (glow > 1 ? 1 + (glow - 1) * 0.35 : 1);
        ctx.drawImage(sprite, x[i] - r, y[i] - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [canvasRef, engine, pointer]);
}
