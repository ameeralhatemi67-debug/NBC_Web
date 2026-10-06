'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CompetitionState } from '@/lib/competition-domain';
import { registeredStage } from '@/lib/competition-domain';
import { resultSentence } from '@/lib/format';
import { questionStatus, questionStatusLabels } from '@/lib/exam-presentation';
import {
  copyWithFallback,
  leaderboardModeLines,
  missedQuestions,
  resultHiddenLine,
  resultReceivedTitle,
  revisitPages,
  selectedAnswerText,
} from '@/lib/result-presentation';
import { Icon } from './ui';
import { Leaderboard } from './leaderboard';
import { BookStage } from './book-stage';
import { ResultBookDialog } from './result-book-dialog';
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
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [allPages, setAllPages] = useState(false);
  const missed = missedQuestions(attempt),
    pages = revisitPages(attempt);
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
  function openPage(n: number, target: HTMLElement) {
    opener.current = target;
    setPage(n);
    setOpen(true);
  }
  return (
    <section className={`receipt-card result-screen ${examView ? 'exam-receipt' : ''}`}>
      {banner}
      <div className="result-layout">
        <div className="result-main">
          <div className="result-top">
            <div className="result-headline">
              <h1>
                <Icon name="check" size={22} /> {resultReceivedTitle}
              </h1>
              {!hidden ? (
                <div className="result-sentence-line">
                  <p className="result-sentence">
                    {resultSentence(attempt.score!, attempt.maxScore)}
                  </p>
                  {attempt.percentage !== null && (
                    <small>
                      <bdi dir="ltr">{attempt.percentage}%</bdi>
                    </small>
                  )}
                </div>
              ) : (
                <p className="result-hidden">{resultHiddenLine}</p>
              )}
            </div>
            <div className="result-book">
              <BookStage book={data.book} initial="open" closeWhenReady />
            </div>
          </div>
          {!hidden && (
            <div className="result-strip" role="list" aria-label="نتيجة الأسئلة">
              {attempt.questions.map((question, index) => {
                const status = questionStatus(attempt, question.id);
                return (
                  <span
                    key={question.id}
                    className={`result-segment ${status}`}
                    role="listitem"
                    aria-label={`السؤال ${index + 1}، ${questionStatusLabels[status]}`}
                    style={{ '--segment-delay': `${index * 40}ms` } as React.CSSProperties}
                  >
                    <Icon
                      name={
                        status === 'correct' ? 'check' : status === 'incorrect' ? 'close' : 'lock'
                      }
                      size={10}
                    />
                  </span>
                );
              })}
            </div>
          )}
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
          {!hidden && attempt.score === attempt.maxScore && (
            <p className="result-all-correct">
              <Icon name="check" size={18} />
              أجبت عن كل الأسئلة إجابة صحيحة.
            </p>
          )}
          <Link className="button outline result-continue" href="/book">
            واصل القراءة <Icon name="book" size={18} />
          </Link>
        </div>
        {missed.length > 0 && (
          <aside className="result-review">
            <div className="result-revisit">
              <h2>اقرأ مرة أخرى:</h2>
              <div className="result-page-chips">
                {(allPages ? pages : pages.slice(0, 6)).map((n) => (
                  <button
                    key={n}
                    className="source-page-chip"
                    onClick={(event) => openPage(n, event.currentTarget)}
                  >
                    <Icon name="book" size={16} />
                    صفحة <bdi dir="ltr">{n}</bdi>
                  </button>
                ))}
                {pages.length > 6 && (
                  <button
                    className="text-link result-page-toggle"
                    aria-expanded={allPages}
                    onClick={() => setAllPages((value) => !value)}
                  >
                    {allPages ? (
                      'عرض أقل'
                    ) : (
                      <>
                        عرض كل الصفحات (<bdi dir="ltr">{pages.length}</bdi>)
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <h2>الأسئلة التي تحتاج مراجعة</h2>
            <div className="result-review-list">
              {missed.map((question) => (
                <details key={question.id}>
                  <summary>{question.title}</summary>
                  <div className="result-review-answer incorrect">
                    <Icon name="close" size={16} />
                    <p>
                      <strong>إجابتك:</strong>{' '}
                      {selectedAnswerText(question, attempt.answers[question.id]?.selected ?? [])}
                    </p>
                  </div>
                  <div className="result-review-answer correct">
                    <Icon name="check" size={16} />
                    <p>
                      <strong>الصحيحة:</strong>{' '}
                      {selectedAnswerText(question, attempt.feedback[question.id].correctAnswers)}
                    </p>
                  </div>
                  <p className="result-explanation">{attempt.feedback[question.id].explanation}</p>
                  <button
                    className="source-page-chip"
                    onClick={(event) => openPage(question.pdfPage, event.currentTarget)}
                  >
                    <Icon name="book" size={16} />
                    افتح الصفحة <bdi dir="ltr">{question.pdfPage}</bdi>
                  </button>
                </details>
              ))}
            </div>
          </aside>
        )}
        {hidden && Object.keys(attempt.feedback).length === 0 && (
          <aside className="result-own-answers">
            <h2>إجاباتك</h2>
            {attempt.questions.map((question) => (
              <details key={question.id}>
                <summary>{question.title}</summary>
                <p>
                  إجابتك:{' '}
                  {selectedAnswerText(question, attempt.answers[question.id]?.selected ?? [])}
                </p>
              </details>
            ))}
          </aside>
        )}
      </div>
      <ResultBookDialog
        book={data.book}
        page={page}
        onPageChange={setPage}
        open={open}
        onClose={() => setOpen(false)}
        opener={opener}
      />
    </section>
  );
}
