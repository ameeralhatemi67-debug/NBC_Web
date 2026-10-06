'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { HOLD_MS } from '@/lib/admin-launch';

// Press and hold (pointer, or Space/Enter) to confirm. Releasing early, losing focus or a
// cancelled pointer resets without calling onConfirm. A plain click never confirms.
export function HoldButton({
  children,
  onConfirm,
  disabled = false,
  danger = false,
  describedBy,
  duration = HOLD_MS,
  className = '',
}: {
  children: ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
  describedBy?: string;
  duration?: number;
  className?: string;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const frame = useRef(0);
  const started = useRef(0);
  const active = useRef(false);
  const confirm = useRef(onConfirm);
  useEffect(() => {
    confirm.current = onConfirm;
  });
  function reset() {
    cancelAnimationFrame(frame.current);
    active.current = false;
    button.current?.classList.remove('holding');
    button.current?.style.setProperty('--hold', '0');
  }
  function stop() {
    if (active.current) reset();
  }
  function tick() {
    const progress = Math.min(1, (performance.now() - started.current) / duration);
    button.current?.style.setProperty('--hold', String(progress));
    if (progress >= 1) {
      reset();
      confirm.current();
    } else frame.current = requestAnimationFrame(tick);
  }
  function start() {
    if (active.current || disabled) return;
    active.current = true;
    started.current = performance.now();
    button.current?.classList.add('holding');
    frame.current = requestAnimationFrame(tick);
  }
  useEffect(() => reset, []);
  useEffect(() => {
    if (disabled) reset();
  }, [disabled]);
  return (
    <button
      ref={button}
      type="button"
      className={`hold-button button ${danger ? 'danger' : 'primary'} ${className}`}
      disabled={disabled}
      aria-describedby={describedBy}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') stop();
      }}
      onBlur={stop}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-label">{children}</span>
    </button>
  );
}
