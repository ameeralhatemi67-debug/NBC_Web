'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CompetitionState } from '@/lib/competition-domain';
import { registeredStage } from '@/lib/competition-domain';
import { resultSentence } from '@/lib/format';
import {
  copyWithFallback,
  leaderboardModeLines,
  resultHiddenLine,
  resultReceivedTitle,
} from '@/lib/result-presentation';
import { Icon } from './ui';
import { Leaderboard } from './leaderboard';
import { BookStage } from './book-stage';
export function CompetitionResult({
  data,
  banner,
  testRunId,
  examView,
}: {
  data: CompetitionState;
  banner: ReactNode;
  testRunId?: string;
  examView: boolean;
}) {
  const attempt = data.attempt!;
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const manual = useRef<HTMLInputElement>(null);
  const mode = data.competition.leaderboardMode;
  const hidden = attempt.score === null;
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copy() {
    const okay = await copyWithFallback(
      attempt.participantNumber,
      (text) => navigator.clipboard.writeText(text),
      (text) => {
        const focused = document.activeElement as HTMLElement | null;
        const input = document.createElement('textarea');
        input.value = text;
        Object.assign(input.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
        document.body.append(input);
        input.select();
        try {
          return document.execCommand('copy');
        } finally {
          input.remove();
          focused?.focus();
        }
      },
    );
    setCopied(okay);
    setManualCopy(!okay);
    if (!okay)
      requestAnimationFrame(() => {
        manual.current?.focus();
        manual.current?.select();
      });
  }
  return (
    <section className={`receipt-card result-screen ${examView ? 'exam-receipt' : ''}`}>
      {banner}
      <div className="result-main">
        <div className="result-top">
          <div className="result-headline">
            <h1>
              <Icon name="check" size={22} />
              {resultReceivedTitle}
            </h1>
            <p className={hidden ? 'result-hidden' : 'result-sentence'}>
              {hidden ? resultHiddenLine : resultSentence(attempt.score!, attempt.maxScore)}
            </p>
          </div>
          <div className="result-book">
            <BookStage book={data.book} initial="open" closeWhenReady />
          </div>
        </div>
        <div className="receipt-number result-ticket">
          <div>
            <span>رقم المشارك</span>
            <bdi dir="ltr">{attempt.participantNumber}</bdi>
          </div>
          <button className="button outline" onClick={() => void copy()}>
            <Icon name={copied ? 'check' : 'copy'} size={18} />
            <span aria-live="polite">{copied ? 'تم النسخ' : 'نسخ الرقم'}</span>
          </button>
          {manualCopy && (
            <div className="manual-number-copy">
              <label>
                انسخ الرقم يدويًا
                <input
                  ref={manual}
                  value={attempt.participantNumber}
                  readOnly
                  aria-label="رقم المشارك للنسخ اليدوي"
                  dir="ltr"
                />
              </label>
            </div>
          )}
        </div>
        <p className="result-policy">{leaderboardModeLines[mode]}</p>
        {!hidden &&
          (mode === 'public_live' || (mode === 'publish_after_close' && data.published)) && (
            <Leaderboard
              competitionId={data.competition.id}
              stage={registeredStage(data.participant.stage)}
              testRunId={testRunId}
              participantNumber={mode === 'public_live' ? attempt.participantNumber : undefined}
            />
          )}
        <Link className="button outline result-continue" href="/book">
          واصل القراءة <Icon name="book" size={18} />
        </Link>
      </div>
    </section>
  );
}
