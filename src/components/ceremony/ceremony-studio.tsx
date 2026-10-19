'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../ui';
// Loaded only with this page: the ceremony styles are large and nothing else uses them.
import '@/app/ceremony.css';
import { STAGE_H, STAGE_W, type CeremonyHandle, type Step } from './ceremony-kit';
import { GateDesign } from './gate-design';
import { LettersDesign } from './letters-design';
import { RegionDesign } from './region-design';

const designs = [
  {
    id: 'gate',
    name: 'بوابة النور',
    note: 'ضغط مطوّل على الختم، فتضيء الأقواس وتنفتح البوابة',
    Comp: GateDesign,
  },
  {
    id: 'letters',
    name: 'حروف من نور',
    note: 'لمسة على النور، فتكتب الحروف اسم المسابقة',
    Comp: LettersDesign,
  },
  {
    id: 'region',
    name: 'الشرقية تتوهّج',
    note: 'ضغطة تنطلق من الدمام فتضيء مدن المنطقة',
    Comp: RegionDesign,
  },
] as const;
type DesignId = (typeof designs)[number]['id'];
const steps: { id: Step; label: string }[] = [
  { id: 'idle', label: 'الانتظار' },
  { id: 'launch', label: 'التدشين' },
  { id: 'video', label: 'الفيلم' },
  { id: 'ending', label: 'الختام' },
];
const filmLengths = [8, 12, 30, 60, 90];
const SWAP_MS = 520;

// The launch ceremony page: three designs on one stage, for the team to compare and choose. Each
// design is drawn at 1600×900 and scaled to fit; switching passes through a short dark curtain so
// only one design runs at a time. Nothing here opens the competition.
export function CeremonyStudio({ screen = false }: { screen?: boolean }) {
  const [shown, setShown] = useState<DesignId>('gate');
  const [chosen, setChosen] = useState<DesignId>('gate');
  const [curtain, setCurtain] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [videoSeconds, setVideoSeconds] = useState(12);
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(0.5);
  const [rail, setRail] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<CeremonyHandle>(null);
  const swap = useRef(0);
  const railTimer = useRef(0);

  const choose = useCallback(
    (id: DesignId) => {
      if (id === chosen) return;
      setChosen(id);
      setCurtain(true);
      window.clearTimeout(swap.current);
      swap.current = window.setTimeout(() => {
        setShown(id);
        setStep('idle');
        // Lift the curtain once the new design has painted, or after a short wait at the latest.
        const reveal = () => setCurtain(false);
        requestAnimationFrame(() => requestAnimationFrame(reveal));
        swap.current = window.setTimeout(reveal, 450);
      }, SWAP_MS);
    },
    [chosen],
  );
  const go = useCallback((next: Step) => handle.current?.go(next), []);
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.().catch(() => {});
  }, []);
  const showRail = useCallback(() => {
    setRail(true);
    window.clearTimeout(railTimer.current);
    railTimer.current = window.setTimeout(() => setRail(false), 2800);
  }, []);

  useEffect(() => {
    // A projector window opened from the admin page carries the design it should start on.
    const wanted = new URLSearchParams(window.location.search).get('design');
    if (designs.some((d) => d.id === wanted)) {
      setShown(wanted as DesignId);
      setChosen(wanted as DesignId);
    }
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      document.removeEventListener('fullscreenchange', onFull);
      window.clearTimeout(swap.current);
      window.clearTimeout(railTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setScale(Math.min(r.width / STAGE_W, r.height / STAGE_H));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [full, screen]);

  useEffect(() => {
    // Presenter keys: 1 2 3 choose a design, N the next part, R back to the start, F full screen.
    const keys = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        target?.isContentEditable ||
        target?.closest('input, textarea, select')
      )
        return;
      const digit = ['1', '2', '3', '١', '٢', '٣'].indexOf(e.key);
      if (digit >= 0) choose(designs[digit % 3].id);
      else if (e.key === 'n' || e.key === 'N') {
        const i = steps.findIndex((s) => s.id === step);
        go(steps[Math.min(steps.length - 1, i + 1)].id);
      } else if (e.key === 'r' || e.key === 'R') go('idle');
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [choose, go, step, toggleFull]);

  const Design = designs.find((d) => d.id === shown)!.Comp;
  const immersive = screen || full;
  const controls = (compact: boolean) => (
    <>
      <div className="cs-designs" role="group" aria-label="التصميم">
        {designs.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className={chosen === d.id ? 'on' : ''}
            aria-pressed={chosen === d.id}
            onClick={() => choose(d.id)}
          >
            <span className="cs-num">{['١', '٢', '٣'][i]}</span>
            <span className="cs-name">
              {d.name}
              {!compact && <small>{d.note}</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="cs-steps" role="group" aria-label="أجزاء الحفل">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            className={step === s.id ? 'on' : ''}
            aria-pressed={step === s.id}
            onClick={() => go(s.id)}
          >
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => go('idle')} aria-label="إعادة الحفل من البداية">
          <Icon name="refresh" size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div
      ref={wrap}
      className={`cs-studio${screen ? ' screen' : ''}${full ? ' full' : ''}`}
      onPointerMove={
        immersive
          ? (e) => {
              // Only near the bottom edge, so the Emir's pointer never summons the controls.
              if (e.clientY > window.innerHeight - 110) showRail();
            }
          : undefined
      }
    >
      {!immersive && (
        <div className="cs-toolbar">
          {controls(false)}
          <div className="cs-tools">
            <label>
              مدة الفيلم التجريبي
              <select
                value={videoSeconds}
                onChange={(e) => setVideoSeconds(Number(e.target.value))}
              >
                {filmLengths.map((n) => (
                  <option key={n} value={n}>
                    {n} ثانية
                  </option>
                ))}
              </select>
            </label>
            <Link
              className="button outline"
              href={`/admin/ceremony?design=${chosen}`}
              target="nbc-ceremony-screen"
            >
              نافذة العرض <Icon name="arrow" size={16} />
            </Link>
            <button type="button" className="button primary" onClick={toggleFull}>
              ملء الشاشة
            </button>
          </div>
          <p className="cs-note">
            عرض للتصاميم فقط، ولا يفتح المسابقة فعليًا. مفاتيح العرض: ١ ٢ ٣ لاختيار التصميم، N للجزء
            التالي، R للبداية، F لملء الشاشة.
          </p>
        </div>
      )}
      <div ref={stage} className="cs-stage">
        <div className="cs-frame" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <Design key={shown} ref={handle} videoSeconds={videoSeconds} onStep={setStep} />
        </div>
        <div className={`cs-curtain${curtain ? ' on' : ''}`} aria-hidden="true" />
        {immersive && (
          <div className={`cs-rail${rail ? ' show' : ''}`} onPointerEnter={showRail}>
            {controls(true)}
            <button
              type="button"
              className="cs-exit"
              onClick={toggleFull}
              aria-label={full ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            >
              <Icon name={full ? 'close' : 'pages'} size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
