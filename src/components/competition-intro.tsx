'use client';
import { useState, type ReactNode } from 'react';
import type { CompetitionState } from '@/lib/competition-domain';
import { registeredStage, stageNames } from '@/lib/competition-domain';
import { competitionStateLabels, riyadhDateTime } from '@/lib/format';
import { BookCover, type BookReadiness } from './book-cover';
import { CompetitionClosingTime } from './competition-closing-time';
import { ErrorMessage, Icon } from './ui';
export function CompetitionIntro({
  data,
  banner,
  error,
  busy,
  onStart,
}: {
  data: CompetitionState;
  banner: ReactNode;
  error: string;
  busy: boolean;
  onStart: () => void;
}) {
  const [readiness, setReadiness] = useState<BookReadiness>({
    sha: '',
    verified: false,
    cached: false,
  });
  const verified = readiness.sha === data.book.sha256 && readiness.verified;
  const cached = verified && readiness.cached;
  return (
    <section className="participation-intro">
      {banner}
      <div className="intro-layout">
        <div className="intro-copy">
          <span className="eyebrow">{data.competition.title}</span>
          <h1>أهلًا {data.participant.name.trim().split(/\s+/)[0]}</h1>
          <span className="intro-stage">{stageNames[registeredStage(data.participant.stage)]}</span>
          <ul className="intro-facts">
            {[
              ['book', '20 سؤالًا من الكتاب'],
              ['clock', 'بلا مؤقّت لكل سؤال، خذ وقتك'],
              ['lock', 'الإجابة نهائية بعد تثبيتها'],
              ['pages', 'الكتاب مفتوح بجانب السؤال'],
            ].map(([icon, text]) => (
              <li key={icon}>
                <span className="intro-fact-icon">
                  <Icon name={icon} size={18} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="intro-readiness" role="status">
            <Icon name={cached ? 'check' : 'book'} size={18} />
            {cached ? 'الكتاب جاهز دون اتصال، وتُحفظ إجاباتك تلقائيًا' : 'جارٍ تجهيز الكتاب'}
          </p>
          <p className="intro-window">
            {competitionStateLabels[data.competition.state]}{' '}
            {data.competition.opensAt &&
              `· تفتح ${riyadhDateTime(data.competition.opensAt)}، بتوقيت الرياض`}
          </p>
          <ErrorMessage message={error} />
          <div className="participation-start-actions">
            <button
              className="button primary"
              disabled={busy || data.competition.state !== 'OPEN' || !verified}
              onClick={onStart}
            >
              ابدأ المشاركة <Icon />
            </button>
            {data.competition.closesAt && (
              <CompetitionClosingTime closesAt={data.competition.closesAt} />
            )}
          </div>
        </div>
        <BookCover book={data.book} onReadiness={setReadiness} />
      </div>
    </section>
  );
}
