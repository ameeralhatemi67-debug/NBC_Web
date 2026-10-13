'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CompetitionState } from '@/lib/competition-domain';
import {
  registeredStage,
  stageNames,
  questionCount,
  finalSubmission,
} from '@/lib/competition-domain';
import { competitionStateLabels, riyadhDateTime } from '@/lib/format';
import type { BookReadiness } from './book-cover';
import { BookStage, type BookStageHandle } from './book-stage';
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
  // The promise settles when the book has opened; the exam appears after it.
  onStart: (opened?: Promise<void>) => void;
}) {
  const [readiness, setReadiness] = useState<BookReadiness>({
    sha: '',
    verified: false,
    cached: false,
  });
  const stage = useRef<BookStageHandle>(null);
  const opened = useRef(false);
  useEffect(() => {
    // A failed start leaves the intro on screen: close the book again.
    if (!busy && opened.current) {
      opened.current = false;
      void stage.current?.close();
    }
  }, [busy]);
  const verified = readiness.sha === data.book.sha256 && readiness.verified;
  const cached = verified && readiness.cached;
  return (
    <section className="participation-intro">
      {banner}
      <div className="intro-layout">
        <div className="intro-copy">
          <span className="eyebrow">{data.competition.title}</span>
          <h1>أهلًا {data.participant.name.trim().split(/\s+/)[0]}</h1>
          <div className="intro-registration">
            <span>
              <Icon name="check" size={16} /> اكتمل تسجيلك
            </span>
            <span className="intro-stage">
              {stageNames[registeredStage(data.participant.stage)]}
            </span>
          </div>
          <p className="intro-message">
            {data.competition.state === 'OPEN'
              ? 'حان وقت المشاركة. اقرأ بتأنٍّ، واجعل معرفتك دليلك.'
              : ['CLOSED', 'RESULTS_PUBLISHED'].includes(data.competition.state)
                ? 'انتهت المسابقة. يبقى الكتاب متاحًا لتواصل القراءة.'
                : 'لكل رحلة بداية، وبدايتك مع الكتاب. اغتنم وقت الانتظار في القراءة حتى يحين موعد المشاركة.'}
          </p>
          <ul className="intro-facts">
            {[
              [
                'book',
                `${questionCount(data.competition, registeredStage(data.participant.stage))} سؤالًا`,
              ],
              ['clock', 'بلا مؤقّت لكل سؤال، خذ وقتك'],
              [
                'lock',
                finalSubmission(data.competition)
                  ? 'تُعتمد إجاباتك بعد الإرسال النهائي، ويمكنك تعديلها قبله'
                  : 'الإجابة نهائية بعد تثبيتها',
              ],
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
              onClick={() => {
                opened.current = true;
                onStart(stage.current?.open());
              }}
            >
              {busy
                ? 'جارٍ فتح مساحة الأسئلة…'
                : ['CLOSED', 'RESULTS_PUBLISHED'].includes(data.competition.state)
                  ? 'انتهت المسابقة'
                  : data.competition.state !== 'OPEN'
                    ? 'بانتظار انطلاق المسابقة'
                    : !verified
                      ? 'جارٍ تجهيز الكتاب…'
                      : 'انتقل إلى الأسئلة'}
              <Icon name={data.competition.state === 'OPEN' ? 'arrow' : 'clock'} />
            </button>
            {data.competition.state !== 'OPEN' && (
              <Link href="/book" className="button outline">
                <Icon name="book" /> استعدّ بقراءة الكتاب
              </Link>
            )}
            {data.competition.closesAt && (
              <CompetitionClosingTime closesAt={data.competition.closesAt} />
            )}
          </div>
        </div>
        <BookStage ref={stage} book={data.book} onReadiness={setReadiness} />
      </div>
    </section>
  );
}
