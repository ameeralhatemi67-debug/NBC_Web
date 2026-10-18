'use client';
import { useEffect, useState } from 'react';
import { arDigits } from '@/lib/format';

export const ROLL_MS = 2600;
const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The drawn number settles digit by digit, right to left in reading order. `play` changes start a
// new roll; without it, or with reduced motion, the number simply shows.
export function PrizeDrawRoll({
  value,
  play,
  onDone,
}: {
  value: string | null;
  play: number;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!value || !play || reduced()) {
      setShown(value);
      if (value && play) onDone?.();
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = performance.now() - t0;
      if (t >= ROLL_MS) {
        setShown(value);
        onDone?.();
        return;
      }
      const settled = Math.floor((t / ROLL_MS) * value.length);
      setShown(
        value.slice(0, settled) +
          [...value.slice(settled)].map(() => Math.floor(Math.random() * 10)).join(''),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // onDone is a callback for this roll only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, play]);
  return (
    <span className="draw-roll" dir="ltr" data-empty={!shown || undefined}>
      {shown ? arDigits(shown) : '— — — — — —'}
    </span>
  );
}
