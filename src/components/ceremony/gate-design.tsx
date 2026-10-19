'use client';
/* eslint-disable @next/next/no-img-element */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  AUTHORITY_LOGO,
  Grain,
  PartnerTrack,
  QR_SRC,
  REGISTER_URL,
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
} from './ceremony-kit';

type Phase = 'idle' | 'ignite' | 'video' | 'ending';
const HOLD_MS = 2200;
const IGNITE_MS = 3400;

// Design 1, the gate of light: nested arches around lattice doors. The Emir holds the seal until
// its ring closes, the arches light from the inside out, the doors open and the light floods in.
export const GateDesign = forwardRef<CeremonyHandle, DesignProps>(function GateDesign(
  { videoSeconds, onStep },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [holding, setHolding] = useState(false);
  const [hover, setHover] = useState(false);
  const [hint, setHint] = useState(false);
  const [launchedAt, setLaunchedAt] = useState(0);
  const hold = useRef(0);
  const live = useRef({ phase, holding });
  live.current = { phase, holding };
  const downAt = useRef(0);
  const holdFrom = useRef(0);
  const holdTimer = useRef(0);
  const holdShown = useRef('');
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);
  const timers = useTimers();

  const particles = useMemo(() => {
    const rnd = seeded(1448);
    return {
      dust: Array.from({ length: 46 }, (_, i) => ({
        x: rnd() * 100,
        y: 22 + rnd() * 78,
        s: 1.3 + rnd() * 2.9,
        dur: 9 + rnd() * 13,
        del: -rnd() * 22,
        k: `k${i % 3}`,
      })),
      bokeh: Array.from({ length: 7 }, () => ({
        x: Math.round(rnd() * 1500 - 60),
        y: Math.round(rnd() * 800 - 60),
        s: Math.round(90 + rnd() * 220),
        del: -rnd() * 26,
      })),
      leaves: Array.from({ length: 30 }, (_, i) => ({
        x: rnd() * 100,
        dur: 8 + rnd() * 8,
        del: -rnd() * 14,
        k: `k${i % 3}`,
      })),
    };
  }, []);

  function launch() {
    if (live.current.phase !== 'idle') return;
    // The frame loop may fire again before React re-renders; mark the launch at once.
    live.current = { phase: 'ignite', holding: false };
    window.clearTimeout(holdTimer.current);
    timers.clear();
    setPhase('ignite');
    setHolding(false);
    setHover(false);
    setHint(false);
    setLaunchedAt(Date.now());
    onStep('launch');
    timers.later(IGNITE_MS, video);
  }
  function video() {
    timers.clear();
    setPhase('video');
    setHolding(false);
    setLaunchedAt((at) => at || Date.now());
    onStep('video');
  }
  function ending() {
    timers.clear();
    setPhase('ending');
    setHolding(false);
    setLaunchedAt((at) => at || Date.now());
    onStep('ending');
  }
  function restart() {
    timers.clear();
    hold.current = 0;
    setPhase('idle');
    setHolding(false);
    setHover(false);
    setHint(false);
    setLaunchedAt(0);
    onStep('idle');
  }
  useImperativeHandle(ref, () => ({
    go: (step) => {
      if (step === 'idle') restart();
      else if (step === 'launch') {
        restart();
        live.current = { phase: 'idle', holding: false };
        launch();
      } else if (step === 'video') video();
      else ending();
    },
  }));

  useStagePointer(root, {
    magnet: anchor,
    radius: 300,
    onFrame: (dt) => {
      const { phase: p, holding: h } = live.current;
      const active = h && p === 'idle';
      // Wall-clock time, so a slow frame rate never makes the hold longer.
      hold.current = active
        ? Math.min(1, (performance.now() - holdFrom.current) / HOLD_MS)
        : Math.max(0, hold.current - dt / 520);
      const value = p === 'idle' ? hold.current.toFixed(3) : '1';
      if (value !== holdShown.current) {
        holdShown.current = value;
        root.current?.style.setProperty('--hold', value);
      }
      if (active && hold.current >= 1) launch();
    },
  });

  function press() {
    if (live.current.phase !== 'idle' || live.current.holding) return;
    downAt.current = performance.now();
    holdFrom.current = downAt.current - hold.current * HOLD_MS;
    live.current = { ...live.current, holding: true };
    setHolding(true);
    setHint(false);
    // The ring is drawn by the frame loop; this timer guarantees the launch even if frames stall.
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(
      () => {
        if (live.current.holding && live.current.phase === 'idle') launch();
      },
      (1 - hold.current) * HOLD_MS + 30,
    );
  }
  function release() {
    window.clearTimeout(holdTimer.current);
    if (!live.current.holding) return;
    live.current = { ...live.current, holding: false };
    const quick = performance.now() - downAt.current < 600 && hold.current < 0.35;
    setHolding(false);
    if (quick) {
      setHint(true);
      timers.later(2800, () => setHint(false));
    }
  }

  const left = useFilm(phase === 'video', videoSeconds, ending);
  const since = useSince(launchedAt, phase === 'ending');
  const lines = launchLines(launchedAt);

  return (
    <div
      ref={root}
      className={`cg-root phase-${phase}${hover ? ' is-hover' : ''}${holding ? ' is-holding' : ''}`}
    >
      <div className="cg-layer cg-ground" />
      <div className="cg-layer cg-lat" />
      <div className="cg-spotwrap" aria-hidden="true">
        <div className="cg-spot" />
        <div className="cg-spotlat" />
      </div>
      <div className="cg-layer" aria-hidden="true">
        <div className="cg-shaft" />
        <div className="cg-shaft s2" />
        <div className="cg-shaft s3" />
      </div>
      <div className="cg-layer" aria-hidden="true">
        {particles.bokeh.map((b, i) => (
          <div
            key={i}
            className="cg-bokeh"
            style={{ left: b.x, top: b.y, width: b.s, height: b.s }}
          >
            <i style={{ animationDelay: `${b.del}s` }} />
          </div>
        ))}
      </div>

      <div className="cg-world">
        <div className="cg-layer cg-floor" aria-hidden="true" />
        <div className="cg-layer cg-horizon" aria-hidden="true" />
        <div className="cg-arch i0" aria-hidden="true" />
        <div className="cg-arch i1" aria-hidden="true">
          <span className="cg-run r2" />
        </div>
        <div className="cg-arch i2" aria-hidden="true" />
        <div className="cg-arch i3" aria-hidden="true">
          <span className="cg-run" />
        </div>
        <div className="cg-arch i4" aria-hidden="true">
          <span className="cg-run r2" />
        </div>
        <div className="cg-arch i5" aria-hidden="true">
          <div className="cg-core" />
          <div className="cg-door l" />
          <div className="cg-door r" />
          <div className="cg-seam" />
          <span className="cg-run r3" />
        </div>
        <div className="cg-anchor" ref={anchor}>
          <div className="cg-sealwrap">
            <span className="cg-ripple" />
            <span className="cg-ripple r2" />
            <svg className="cg-orbit" viewBox="0 0 266 266" aria-hidden="true">
              <path
                id="cg-orbit-path"
                d="M133,133 m-118,0 a118,118 0 1,1 236,0 a118,118 0 1,1 -236,0"
                fill="none"
              />
              <text>
                <textPath href="#cg-orbit-path">
                  مسابقة الانتماء واللحمة الوطنية · ١٤٤٨هـ · المنطقة الشرقية · مسابقة الانتماء
                  واللحمة الوطنية · ١٤٤٨هـ ·
                </textPath>
              </text>
            </svg>
            <svg className="cg-dash" viewBox="0 0 202 202" aria-hidden="true">
              <circle cx="101" cy="101" r="99" />
            </svg>
            <span className="cg-ring" aria-hidden="true" />
            <div className="cg-bezel">
              <button
                type="button"
                className="cg-seal"
                aria-label="اضغط مطوّلًا لتدشين المسابقة"
                onPointerDown={(e) => {
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                  press();
                }}
                onPointerUp={release}
                onPointerCancel={release}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                    e.preventDefault();
                    press();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') release();
                }}
                onMouseEnter={() => live.current.phase === 'idle' && setHover(true)}
                onMouseLeave={() => setHover(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg className="cg-face" viewBox="-40 -40 80 80" aria-hidden="true">
                  <path className="cg-star" d="M0,-33L33,0L0,33L-33,0Z M-23,-23H23V23H-23Z" />
                  <circle className="cg-starin" cx="0" cy="0" r="12" />
                  <circle className="cg-starin" cx="0" cy="0" r="4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="cg-layer cg-dustfield" aria-hidden="true">
        {particles.dust.map((p, i) => (
          <span
            key={i}
            className={`cg-dust ${p.k}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.s,
              height: p.s,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.del}s`,
            }}
          />
        ))}
      </div>

      <header className="cg-head">
        <div className="cg-logo">
          <img
            src={AUTHORITY_LOGO}
            alt="شعار الرئاسة العامة لهيئة الأمر بالمعروف والنهي عن المنكر"
          />
        </div>
        <img className="cg-v2030" src={VISION_LOGO} alt="رؤية المملكة ٢٠٣٠" />
        <div className="cg-eyebrow">
          <i />
          حفل التدشين الرسمي
          <i />
        </div>
        <h1 className="cg-title" aria-label="مسابقة الانتماء واللحمة الوطنية">
          <span className="cg-word">
            <img src={TITLE_IMAGES[0]} alt="" />
            <span className="cg-sheen w0" />
          </span>
          <span className="cg-word">
            <img src={TITLE_IMAGES[1]} alt="" />
            <span className="cg-sheen w1" />
          </span>
        </h1>
        <p className="cg-patron">برعاية صاحب السمو الملكي أمير المنطقة الشرقية</p>
      </header>
      <p className="cg-cta">
        {holding
          ? 'استمرّ… حتى يكتمل الطوق الذهبي فتنفتح البوابة'
          : hint
            ? 'أبقِ إصبعك على الختم لحظات حتى يكتمل الطوق'
            : 'اضغط مطوّلًا على الختم لتدشين المسابقة'}
      </p>
      <span className="cg-year">١٤٤٨هـ · ٢٠٢٦م</span>

      <span className="cg-spill" aria-hidden="true" />
      {phase === 'ignite' && (
        <>
          <span className="cg-shock" />
          <span className="cg-shock s2" />
        </>
      )}
      <div className="cg-layer cg-white" />

      <div className="cg-cinema" aria-hidden={phase !== 'video'}>
        {phase === 'video' && (
          <>
            <div className="cg-screenshell">
              <div className="cg-screen">
                <div className="cg-leak l1" />
                <div className="cg-leak l2" />
                <div className="cg-leak l3" />
                <div className="cg-filmlat" />
                <span className="cg-corner c1" />
                <span className="cg-corner c2" />
                <span className="cg-corner c3" />
                <span className="cg-corner c4" />
                <div className="cg-filmcenter">
                  <div className="cg-play">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 4.5v15l13-7.5z" />
                    </svg>
                  </div>
                  <span className="cg-filmbadge">الفيلم الافتتاحي</span>
                  <span className="cg-filmtitle">[ يُعرض هنا الفيلم المعدّ من فريق الإنتاج ]</span>
                  <span className="cg-filmsub">
                    ملف فيديو بنسبة ١٦:٩ يبدأ تلقائيًا لحظة انفتاح البوابة، وينتقل العرض إلى الختام
                    عند انتهائه
                  </span>
                </div>
                <div className="cg-bar">
                  <i style={{ animationDuration: `${videoSeconds}s` }} />
                </div>
              </div>
            </div>
            <div className="cg-filmmeta">
              <span className="dot" />
              يُعرض الآن · المتبقي <bdi>{clock(left)}</bdi>
            </div>
            <button type="button" className="cg-skip" onClick={ending}>
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
        <div className="cg-end">
          <div className="cg-layer" aria-hidden="true">
            {particles.leaves.map((l, i) => (
              <span
                key={i}
                className={`cg-leaf ${l.k}`}
                style={{
                  left: `${l.x}%`,
                  animationDuration: `${l.dur}s`,
                  animationDelay: `${l.del}s`,
                }}
              />
            ))}
          </div>
          <span className="cg-endpill cg-in">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            دُشّنت رسميًا
          </span>
          <div className="cg-endhwrap cg-in">
            <h1 className="cg-endh">انطلقت المسابقة</h1>
          </div>
          <div className="cg-endtitle cg-in" style={{ animationDelay: '.3s' }}>
            <img src={TITLE_IMAGES[0]} alt="مسابقة الانتماء" />
            <img src={TITLE_IMAGES[1]} alt="واللحمة الوطنية" />
          </div>
          <p className="cg-enddate cg-in" style={{ animationDelay: '.45s' }}>
            <b>{lines.time}</b> · {lines.date}
          </p>
          <div className="cg-stats">
            {[
              ['٣', 'مراحل دراسية'],
              ['١٢', 'مدينة في المنطقة الشرقية'],
              ['٥٢٬٠٠٠', 'ريال جوائز'],
            ].map(([n, label], i) => (
              <div
                key={label}
                className="cg-shell cg-in"
                style={{ animationDelay: `${0.6 + i * 0.12}s` }}
              >
                <div className="cg-card">
                  <b>{n}</b>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
          <aside className="cg-qr cg-in" style={{ animationDelay: '.95s' }}>
            <div className="cg-shell" style={{ borderRadius: 30 }}>
              <div className="cg-qrcard">
                <h3>سجّل الآن</h3>
                <div className="cg-qrimg">
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
          <aside className="cg-live cg-in" style={{ animationDelay: '1.05s' }}>
            <div className="cg-shell">
              <div className="cg-livecard">
                <small>منذ لحظة التدشين</small>
                <strong>{clock(since)}</strong>
              </div>
            </div>
            <div className="cg-open">
              <i />
              باب التسجيل مفتوح الآن
            </div>
            <div className="cg-open muted">المتوسطة · الثانوية · الجامعية</div>
          </aside>
          <div className="cg-partners cg-in" style={{ animationDelay: '1.2s' }}>
            <div className="cg-partners-in">
              <PartnerTrack className="cg-track" />
            </div>
          </div>
        </div>
      )}

      <div className="cg-layer cg-vignette" aria-hidden="true" />
      <Grain id="cg-noise" className="cg-grain" />
    </div>
  );
});
