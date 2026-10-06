'use client';
import { useEffect, useId, useState } from 'react';
import { closingPhrase, riyadhDateTime } from '@/lib/format';

export function CompetitionClosingTime({ closesAt }: { closesAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [closesAt]);
  const exact = `${riyadhDateTime(closesAt)}، بتوقيت الرياض`;
  return (
    <div className="competition-closing-time">
      <button
        type="button"
        className="text-link"
        title={exact}
        aria-expanded={expanded}
        aria-controls={id}
        onFocus={() => setExpanded(true)}
        onClick={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
      >
        {now === null ? 'موعد إغلاق المسابقة' : closingPhrase(closesAt, now)}
      </button>
      <time id={id} dateTime={closesAt} hidden={!expanded}>
        {exact}
      </time>
    </div>
  );
}
