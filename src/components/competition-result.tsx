'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CompetitionState } from '@/lib/competition-domain';
import { registeredStage, stageNames, type Standing } from '@/lib/competition-domain';
import { arDigits, resultSentence } from '@/lib/format';
import {
  copyWithFallback,
  leaderboardModeLines,
  resultHiddenLine,
  resultReceivedTitle,
} from '@/lib/result-presentation';
import { api, Icon } from './ui';
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
            {!hidden && <ScoreSplit score={attempt.score!} maxScore={attempt.maxScore} />}
          </div>
          <div className="result-book">
            <BookStage book={data.book} initial="open" closeWhenReady />
          </div>
        </div>
        <div className="receipt-number result-ticket">
          <div>
            <span>رقم المشارك</span>
            <bdi dir="ltr">
              <span className="result-hash" aria-hidden="true">
                #
              </span>
              {attempt.participantNumber}
            </bdi>
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
        {!data.practice && !hidden && (
          <ResultStanding
            competitionId={data.competition.id}
            testRunId={testRunId}
            submittedAt={attempt.submittedAt}
          />
        )}
        <p className="result-policy">
          {data.practice
            ? 'نتيجة التجربة خاصة بك ولا تدخل في ترتيب المسابقة أو جوائزها.'
            : leaderboardModeLines[mode]}
        </p>
        {!data.practice &&
          !hidden &&
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

// Share of right and wrong answers only: which questions were right stays undisclosed.
function ScoreSplit({ score, maxScore }: { score: number; maxScore: number }) {
  const right = maxScore ? Math.round((score / maxScore) * 100) : 0;
  return (
    <div className="score-split">
      <div className="score-split-bar" aria-hidden="true">
        <span className="right" style={{ inlineSize: `${right}%` }} />
        <span className="wrong" style={{ inlineSize: `${100 - right}%` }} />
      </div>
      <dl>
        <div className="right">
          <dt>إجابات صحيحة</dt>
          <dd>{arDigits(right)}٪</dd>
        </div>
        <div className="wrong">
          <dt>إجابات غير صحيحة</dt>
          <dd>{arDigits(100 - right)}٪</dd>
        </div>
      </dl>
    </div>
  );
}

function ResultStanding({
  competitionId,
  testRunId,
  submittedAt,
}: {
  competitionId: string;
  testRunId?: string;
  submittedAt: string | null;
}) {
  const [standing, setStanding] = useState<Standing | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Standing | null>(
        testRunId
          ? `admin/test-run/standing?id=${encodeURIComponent(testRunId)}`
          : `standing?competitionId=${encodeURIComponent(competitionId)}`,
      )
        .then((value) => alive && setStanding(value))
        .catch(() => alive && setStanding((old) => old ?? null));
    void load();
    // Other participants keep submitting, so the position is refreshed while the page is open.
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [competitionId, testRunId, submittedAt]);
  if (standing === undefined)
    return (
      <p className="result-standing-loading" role="status">
        جارٍ حساب ترتيبك…
      </p>
    );
  if (!standing) return null;
  const rows = [
    { label: `على مستوى ${stageNames[standing.stage]}`, ...standing.overall },
    { label: `في ${standing.city.name}`, ...standing.city },
  ];
  return (
    <section className="result-standing" aria-label="ترتيبك الحالي">
      <h2>ترتيبك الحالي</h2>
      <div className="result-standing-grid">
        {rows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>
              <bdi>{arDigits(row.rank)}</bdi>
            </strong>
            <small>من أصل {arDigits(row.total)}</small>
          </div>
        ))}
      </div>
      <p>يتغير ترتيبك مع وصول مشاركات أخرى. تعتمد اللجنة النتائج الرسمية وتعلنها.</p>
    </section>
  );
}
