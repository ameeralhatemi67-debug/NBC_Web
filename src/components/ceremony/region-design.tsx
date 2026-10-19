'use client';
/* eslint-disable @next/next/no-img-element */
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { DAMMAM, REGION_PATH, graticule, regionCities } from '@/lib/ceremony-region';
import {
  AUTHORITY_LOGO,
  Grain,
  PartnerTrack,
  QR_SRC,
  REGISTER_URL,
  TITLE_IMAGES,
  VISION_LOGO,
  arNum,
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

type Phase = 'idle' | 'connect' | 'video' | 'ending';
const STEP = 0.34;
const CONNECT_MS = 6100;

// Design 3, the region glows: the Eastern Province drawn as a layered 3D map. One press sends a
// pulse from Dammam that lights the twelve cities in turn, then the whole region fills with light.
export const RegionDesign = forwardRef<CeremonyHandle, DesignProps>(function RegionDesign(
  { videoSeconds, onStep },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [hover, setHover] = useState(false);
  const [hot, setHot] = useState(-1);
  const [lit, setLit] = useState(0);
  const [launchedAt, setLaunchedAt] = useState(0);
  const live = useRef(phase);
  live.current = phase;
  const timers = useTimers();
  const stars = useMemo(() => {
    const rnd = seeded(1448);
    return Array.from({ length: 70 }, () => ({
      x: rnd() * 100,
      y: rnd() * 100,
      del: -rnd() * 6,
      dur: 2.5 + rnd() * 4,
    }));
  }, []);

  function start() {
    if (live.current !== 'idle') return;
    live.current = 'connect';
    timers.clear();
    setPhase('connect');
    setHover(false);
    setHot(-1);
    setLit(0);
    setLaunchedAt(Date.now());
    onStep('launch');
    regionCities.forEach((_, i) =>
      timers.later(Math.round((i * STEP + 0.4) * 1000), () => setLit(i + 1)),
    );
    timers.later(CONNECT_MS, video);
  }
  function video() {
    timers.clear();
    setPhase('video');
    setLit(regionCities.length);
    setLaunchedAt((at) => at || Date.now());
    onStep('video');
  }
  function ending() {
    timers.clear();
    setPhase('ending');
    setLit(regionCities.length);
    setLaunchedAt((at) => at || Date.now());
    onStep('ending');
  }
  function restart() {
    timers.clear();
    live.current = 'idle';
    setPhase('idle');
    setHover(false);
    setHot(-1);
    setLit(0);
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

  useStagePointer(root, {
    magnet: anchor,
    radius: 260,
    wander: (s) => [
      Math.sin(s * 0.21) * 0.55 + Math.sin(s * 0.53) * 0.12,
      Math.cos(s * 0.17) * 0.4 - 0.15,
    ],
  });

  const left = useFilm(phase === 'video', videoSeconds, ending);
  const since = useSince(launchedAt, phase === 'ending');
  const lines = launchLines(launchedAt);
  const cities = regionCities.map((c, i) => ({
    ...c,
    i,
    lit: i < lit,
    hot: hot === i,
  }));
  const cool = (i: number) => setHot((h) => (h === i ? -1 : h));

  return (
    <div ref={root} className={`cr-root phase-${phase}${hover ? ' is-hover' : ''}`}>
      <div className="cr-layer cr-ground" />
      <div className="cr-layer cr-lat" />
      <div className="cr-layer" aria-hidden="true">
        <div className="cr-aurora a1" />
        <div className="cr-aurora a2" />
      </div>
      <div className="cr-layer cr-starfield" aria-hidden="true">
        {[0, 1, 2].map((g) => (
          <div key={g} className={`cr-stargroup g${g}`}>
            {stars
              .filter((_, i) => i % 3 === g)
              .map((s, i) => (
                <span key={i} className="cr-star" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
              ))}
          </div>
        ))}
      </div>
      <div className="cr-rose" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="cr-mapshadow" aria-hidden="true" />

      <div className="cr-mapstage">
        <div className="cr-map">
          <svg className="cr-z cr-grat" viewBox="0 0 1000 1227" aria-hidden="true">
            {graticule.lat.map((g) => (
              <line key={`y${g.y}`} x1="0" y1={g.y} x2="1000" y2={g.y} />
            ))}
            {graticule.lon.map((g) => (
              <line key={`x${g.x}`} x1={g.x} y1="0" x2={g.x} y2="1227" />
            ))}
            {graticule.lat.map((g) => (
              <text key={`ty${g.y}`} className="lat" x="990" y={g.y - 8}>
                {g.label}
              </text>
            ))}
            {graticule.lon.map((g) => (
              <text key={`tx${g.x}`} x={g.x + 8} y="1215">
                {g.label}
              </text>
            ))}
          </svg>
          <svg className="cr-z cr-contour" viewBox="0 0 1000 1227" aria-hidden="true">
            {[1.05, 1.11, 1.18].map((scale, i) => (
              <g key={scale} transform={`translate(500 600) scale(${scale}) translate(-500 -600)`}>
                <path className={i ? `k${i + 1}` : undefined} d={REGION_PATH} />
              </g>
            ))}
          </svg>
          <div className="cr-z cr-mask cr-fill" aria-hidden="true" />
          <div className="cr-z cr-mask cr-latfill" aria-hidden="true">
            <span className="cr-lamp" />
          </div>
          <div className="cr-z cr-mask cr-radar" aria-hidden="true">
            <span className="cr-sweep" />
            <span className="cr-sweep fast" />
            <span className="cr-ringpulse">
              <span />
              <span />
              <span />
            </span>
          </div>
          <div className="cr-z cr-mask cr-flood" aria-hidden="true" />
          <svg className="cr-z cr-outline" viewBox="0 0 1000 1227" aria-hidden="true">
            <path className="glow" d={REGION_PATH} />
            <path className="line" pathLength={1} d={REGION_PATH} />
            <path className="comet" pathLength={1} d={REGION_PATH} />
          </svg>
          <svg className="cr-z cr-links" viewBox="0 0 1000 1227" aria-hidden="true">
            {cities.map((c) => (
              <g key={c.name}>
                <line
                  className="cr-link"
                  pathLength={1}
                  x1={DAMMAM.x}
                  y1={DAMMAM.y}
                  x2={c.x}
                  y2={c.y}
                  style={{ animationDelay: `${c.i * STEP}s` }}
                />
                <line
                  className="cr-pulse"
                  pathLength={1}
                  x1={DAMMAM.x}
                  y1={DAMMAM.y}
                  x2={c.x}
                  y2={c.y}
                  style={{ animationDelay: `${-c.i * 0.21}s` }}
                />
              </g>
            ))}
          </svg>
          <div className="cr-z cr-nodes">
            {cities.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`cr-node${c.lit ? ' lit' : ''}${c.hot ? ' hot' : ''}${c.label ? ' far' : ''}${c.i === 0 ? ' home' : ''}${c.flip ? ' flip' : ''}`}
                style={{ left: `${c.x / 10}%`, top: `${(c.y / 1227) * 100}%` }}
                aria-label={c.name}
                onMouseEnter={() => setHot(c.i)}
                onMouseLeave={() => cool(c.i)}
                onFocus={() => setHot(c.i)}
                onBlur={() => cool(c.i)}
              >
                <span className="halo" />
                <span className="dot" />
                <span className="lbl">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="cr-side" aria-label="دعوة التدشين">
        <div className="cr-logos">
          <span className="auth">
            <img
              src={AUTHORITY_LOGO}
              alt="شعار الرئاسة العامة لهيئة الأمر بالمعروف والنهي عن المنكر"
            />
          </span>
          <img className="v" src={VISION_LOGO} alt="رؤية المملكة ٢٠٣٠" />
        </div>
        <div className="cr-eyebrow">
          <i />
          حفل التدشين الرسمي
          <i />
        </div>
        <p className="cr-patron">برعاية صاحب السمو الملكي أمير المنطقة الشرقية</p>
        <h1 style={{ margin: 0 }} aria-label="مسابقة الانتماء واللحمة الوطنية">
          <span className="cr-word w0">
            <img src={TITLE_IMAGES[0]} alt="" />
            <span className="cr-sheen" />
          </span>
          <span className="cr-word w1">
            <img src={TITLE_IMAGES[1]} alt="" />
            <span className="cr-sheen" />
          </span>
        </h1>
        <div className="cr-rule" aria-hidden="true">
          <i className="f" />
          <i />
          <span />
        </div>
        <div className="cr-listhead">
          <strong>المدن المشاركة في المنطقة الشرقية</strong>
          <bdi dir="ltr">
            {arNum(lit, 2)} / {arNum(12)}
          </bdi>
        </div>
        <ul className="cr-list">
          {cities.map((c) => (
            <li
              key={c.name}
              className={`cr-item${c.lit ? ' lit' : ''}${c.hot ? ' hot' : ''}`}
              onMouseEnter={() => setHot(c.i)}
              onMouseLeave={() => cool(c.i)}
            >
              <i />
              {c.name}
            </li>
          ))}
        </ul>
        <div className="cr-cta">
          <div className="cr-anchor" ref={anchor}>
            <div className="cr-bwrap">
              <span className="cr-bripple" />
              <span className="cr-bripple r2" />
              {[80, 72, 64].map((r, i) => (
                <svg
                  key={r}
                  className={`cr-brings r${i + 1}`}
                  viewBox="0 0 164 164"
                  aria-hidden="true"
                >
                  <circle cx="82" cy="82" r={r} />
                </svg>
              ))}
              <button
                type="button"
                className="cr-beacon"
                aria-label="اضغط لإطلاق المسابقة في مدن المنطقة الشرقية"
                onClick={start}
                onMouseEnter={() => live.current === 'idle' && setHover(true)}
                onMouseLeave={() => setHover(false)}
                onFocus={() => live.current === 'idle' && setHover(true)}
                onBlur={() => setHover(false)}
              >
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <circle className="f" cx="24" cy="24" r="4" />
                  <path className="w1" d="M16 16a11 11 0 0 0 0 16M32 16a11 11 0 0 1 0 16" />
                  <path className="w2" d="M10 10a19 19 0 0 0 0 28M38 10a19 19 0 0 1 0 28" />
                </svg>
              </button>
            </div>
          </div>
          <div className="cr-ctatext">
            <strong>اضغط لإطلاق المسابقة</strong>
            <span>تنطلق من الدمام إلى مدن المنطقة الاثنتي عشرة</span>
          </div>
        </div>
      </section>

      {phase === 'connect' && (
        <>
          <span className="cr-wave" />
          <span className="cr-wave w2" />
          <span className="cr-wave w3" />
          <span className="cr-shock" />
        </>
      )}
      <div className="cr-layer cr-white" />

      <div className="cr-cinema" aria-hidden={phase !== 'video'}>
        {phase === 'video' && (
          <>
            <div className="cr-screen">
              <div className="cr-leak l1" />
              <div className="cr-leak l2" />
              <span className="cr-bug cr-mask" aria-hidden="true" />
              <div className="cr-filmcenter">
                <div className="cr-play">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                </div>
                <span className="cr-filmbadge">الفيلم الافتتاحي</span>
                <span className="cr-filmtitle">[ يُعرض هنا الفيلم المعدّ من فريق الإنتاج ]</span>
                <span className="cr-filmsub">
                  يبدأ بعد أن تضيء مدن المنطقة كلها، وينتقل العرض إلى الختام عند انتهائه
                </span>
              </div>
              <div className="cr-bar">
                <span>
                  <i style={{ animationDuration: `${videoSeconds}s` }} />
                </span>
              </div>
            </div>
            <div className="cr-filmmeta">
              <span className="dot" />
              يُعرض الآن · المتبقي <bdi>{clock(left)}</bdi>
            </div>
            <button type="button" className="cr-skip" onClick={ending}>
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
        <div className="cr-end">
          <span className="cr-endpill cr-in">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            دُشّنت رسميًا
          </span>
          <div className="cr-endhwrap cr-in">
            <h1 className="cr-endh">انطلقت المسابقة</h1>
          </div>
          <p className="cr-endsub cr-in" style={{ animationDelay: '.25s' }}>
            في اثنتي عشرة مدينة من مدن المنطقة الشرقية
          </p>
          <p className="cr-enddate cr-in" style={{ animationDelay: '.38s' }}>
            <b>{lines.time}</b> · {lines.date}
          </p>
          <div className="cr-stats">
            {[
              ['٣', 'مراحل دراسية'],
              ['١٢', 'مدينة مشاركة'],
              ['٥٢٬٠٠٠', 'ريال جوائز'],
            ].map(([n, label], i) => (
              <div
                key={label}
                className="cr-shell cr-in"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <div className="cr-card">
                  <b>{n}</b>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="cr-row">
            <div className="cr-shell cr-qr cr-in" style={{ animationDelay: '.82s' }}>
              <div className="cr-qrcard">
                <div className="cr-qrimg">
                  <img src={QR_SRC} alt="رمز الاستجابة السريعة لصفحة التسجيل" />
                </div>
                <div>
                  <h3>سجّل الآن</h3>
                  <p>امسح الرمز بكاميرا الجوال وسجّل في مرحلتك الدراسية</p>
                  <code>{REGISTER_URL}</code>
                </div>
              </div>
            </div>
            <div className="cr-live cr-in" style={{ animationDelay: '.92s' }}>
              <div className="cr-shell" style={{ flex: 1 }}>
                <div className="cr-mini">
                  <small>منذ لحظة التدشين</small>
                  <strong>{clock(since)}</strong>
                </div>
              </div>
              <div className="cr-open">
                <i />
                باب التسجيل مفتوح الآن
              </div>
            </div>
          </div>
          <div className="cr-partners cr-in" style={{ animationDelay: '1.05s' }}>
            <div className="cr-partners-in">
              <PartnerTrack className="cr-track" />
            </div>
          </div>
        </div>
      )}

      <div className="cr-layer cr-vignette" aria-hidden="true" />
      <Grain id="cr-noise" className="cr-grain" />
    </div>
  );
});
