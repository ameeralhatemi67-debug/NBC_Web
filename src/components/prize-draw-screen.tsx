'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { stageNames } from '@/lib/competition-domain';
import { arDigits } from '@/lib/format';
import type { ScreenState } from '@/lib/prize-draw-service';
import { api, Icon } from './ui';
import { PrizeDrawRoll } from './prize-draw-roll';

const HOLD_MS = 2200;

// The projector view. Polls the committee's draw and reveals each winner in turn: number and first
// name only. A draw already made before the screen opened shows without the reveal.
export function PrizeDrawScreen() {
  const [screen, setScreen] = useState<ScreenState | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [play, setPlay] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const next = await api<ScreenState>('admin/prize-draw/screen');
        if (!alive) return;
        setError('');
        setScreen(next);
        const key = next.drawnAt ? `${next.drawId}:${next.drawnAt}` : null;
        if (seen.current === undefined) {
          seen.current = key;
          if (key) {
            setRevealed(next.winners.length);
            setStep(Math.max(0, next.winners.length - 1));
          }
        } else if (key && key !== seen.current) {
          seen.current = key;
          setRevealed(0);
          setStep(0);
          setPlay(Date.now());
        } else if (!key) {
          seen.current = null;
          setRevealed(0);
          setStep(0);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const winners = screen?.winners ?? [];
  const current = winners[step];
  function rolled() {
    setRevealed((r) => Math.max(r, step + 1));
    if (step + 1 < winners.length)
      setTimeout(() => {
        setStep(step + 1);
        setPlay(Date.now());
      }, HOLD_MS);
  }
  const stage = screen?.stage && screen.stage !== 'all' ? stageNames[screen.stage] : 'جميع المراحل';
  const waiting =
    screen?.phase === 'frozen'
      ? `القائمة مجمدة · ${arDigits(screen.poolSize)} مشاركًا مؤهلًا`
      : screen?.phase === 'committed'
        ? `البذرة مثبتة · ${arDigits(screen.poolSize)} مشاركًا مؤهلًا`
        : 'بانتظار بدء السحب';

  return (
    <main id="main" className="draw-screen">
      <div className="draw-screen-texture" aria-hidden />
      <header className="draw-screen-top">
        <h1 className="draw-screen-title">
          <span className="sr-only">مسابقة الانتماء واللحمة الوطنية</span>
          <img src="/images/competition/type-ivory-0.png" alt="" width={877} height={168} />
          <img src="/images/competition/type-ivory-1.png" alt="" width={894} height={170} />
        </h1>
        <span>سحب الجوائز · {stage}</span>
      </header>
      {error ? (
        <div className="draw-screen-error" role="alert">
          <p>{error}</p>
          <Link className="button cream" href="/admin">
            الدخول إلى مساحة اللجنة <Icon size={18} />
          </Link>
        </div>
      ) : (
        <section className="draw-screen-stage" aria-live="polite">
          <div className="draw-arch draw-arch-large">
            <span className="draw-arch-label">
              {current ? current.prize : 'سحب الجوائز'} · رقم المشارك
            </span>
            <PrizeDrawRoll
              key={`${seen.current}-${step}`}
              value={screen?.phase === 'drawn' ? (current?.number ?? null) : null}
              play={revealed > step ? 0 : play}
              onDone={rolled}
            />
            <span className="draw-who">{revealed > step ? current?.firstName : ''}</span>
          </div>
          {screen?.phase !== 'drawn' && <p className="draw-screen-wait">{waiting}</p>}
          {revealed > 0 && winners.length > 1 && (
            <ol className="draw-screen-list">
              {winners.slice(0, revealed).map((w, i) => (
                <li key={i}>
                  <span>{w.prize}</span>
                  <strong dir="ltr">{arDigits(w.number)}</strong>
                  <small>{w.firstName}</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      <footer className="draw-screen-foot">
        <button
          type="button"
          className="text-link"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.();
          }}
        >
          ملء الشاشة
        </button>
        {screen?.phase === 'drawn' && winners.length > 0 && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setRevealed(0);
              setStep(0);
              setPlay(Date.now());
            }}
          >
            إعادة العرض
          </button>
        )}
      </footer>
    </main>
  );
}
