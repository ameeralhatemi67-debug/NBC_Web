'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { api, DemoNote, ErrorMessage, Icon, Loading } from './ui';
import { BookReader } from './book-reader';
import type { Answers, PublicQuestion } from '@/lib/domain';
type State = {
  participant: { name: string; stage: string };
  attempt: null | {
    id: string;
    questions: PublicQuestion[];
    answers: Answers;
    revision: number;
    submittedAt: string | null;
    receipt: string | null;
    score: number | null;
  };
  published: boolean;
};
export function Participation() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [review, setReview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [book, setBook] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const bookButton = useRef<HTMLButtonElement>(null);
  const bookPanel = useRef<HTMLDivElement>(null);
  const questionArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api<State>('participant')
      .then((s) => {
        setData(s);
        setAnswers(s.attempt?.answers ?? {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const mq = matchMedia('(max-width: 900px)');
    setNarrow(mq.matches);
    const change = () => setNarrow(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (book && narrow) {
      bookPanel.current?.focus();
      document.body.style.overflow = 'hidden';
      if (questionArea.current) questionArea.current.inert = true;
    }
    return () => {
      document.body.style.overflow = '';
      if (questionArea.current) questionArea.current.inert = false;
    };
  }, [book, narrow]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState !== 'saved') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);
  const attempt = data?.attempt;
  async function start() {
    setBusy(true);
    setError('');
    try {
      const s = await api<State>('attempt/start', {});
      setData(s);
      setAnswers(s.attempt?.answers ?? {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(next: Answers) {
    if (!attempt) return;
    setAnswers(next);
    setSaveState('saving');
    setError('');
    try {
      const s = await api<State>('attempt/save', { answers: next, revision: attempt.revision });
      setData(s);
      setSaveState('saved');
    } catch (e) {
      setError((e as Error).message);
      setSaveState('error');
    }
  }
  async function submit() {
    if (!attempt) return;
    setBusy(true);
    setError('');
    try {
      const s = await api<State>('attempt/submit', { answers, revision: attempt.revision });
      setData(s);
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function go(i: number) {
    setIndex(i);
    setReview(false);
    requestAnimationFrame(() => questionHeading.current?.focus());
  }
  function closeBook() {
    setBook(false);
    requestAnimationFrame(() => bookButton.current?.focus());
  }
  if (loading) return <Loading />;
  if (!data)
    return (
      <div className="empty-state">
        <Icon name="user" size={40} />
        <h1>مساحتك تنتظرك.</h1>
        <ErrorMessage message={error} />
        <Link className="button primary" href="/register?mode=login">
          تسجيل الدخول <Icon />
        </Link>
      </div>
    );
  if (attempt?.submittedAt)
    return (
      <section className="receipt-card">
        <div className="receipt-icon">
          <Icon name="check" size={38} />
        </div>
        <span className="eyebrow">وصلت مشاركتك</span>
        <h1>
          شكرًا، {data.participant.name.split(' ')[0]}.<br />
          <em>لكل معرفة أثر.</em>
        </h1>
        <p>تم استلام مشاركتك بنجاح. يمكنك الاحتفاظ بمرجع المشاركة.</p>
        <div className="receipt-number">
          <span>مرجع المشاركة</span>
          <bdi>{attempt.receipt}</bdi>
        </div>
        {data.published ? (
          <div className="result-box">
            <span>الدرجة المعتمدة</span>
            <strong>
              {attempt.score} <small>/ {attempt.questions.length}</small>
            </strong>
            <p>
              نشر الدرجة لا يعني إعلان الفوز. حالات التعادل واختيار الفائزين تخضع لاعتماد اللجنة.
            </p>
          </div>
        ) : (
          <p className="pending-result">
            <Icon name="clock" /> النتائج بانتظار اعتماد اللجنة
          </p>
        )}
        <div className="button-row centered">
          <Link className="button outline" href="/book">
            <Icon name="book" /> واصل القراءة
          </Link>
          <Link className="text-link" href="/">
            العودة إلى الرئيسية <Icon />
          </Link>
        </div>
        <DemoNote />
      </section>
    );
  if (!attempt)
    return (
      <section className="participation-intro">
        <DemoNote />
        <span className="eyebrow">مساحة المشاركة</span>
        <h1>
          أهلًا {data.participant.name.split(' ')[0]}،<br />
          <em>لنجعل للقراءة أثرًا.</em>
        </h1>
        <p className="muted">{data.participant.stage} · مشاركتك لم تبدأ بعد</p>
        <div className="intro-rules">
          <div>
            <Icon name="book" />
            <h3>الكتاب معك</h3>
            <p>افتح النص في أي وقت، وعد إلى إجابتك.</p>
          </div>
          <div>
            <Icon name="clock" />
            <h3>على مهل</h3>
            <p>١٠ أسئلة تجريبية، دون مؤقت للإجابة.</p>
          </div>
          <div>
            <Icon name="shield" />
            <h3>راجع قبل الإرسال</h3>
            <p>تستطيع تعديل اختياراتك قبل الإرسال النهائي.</p>
          </div>
        </div>
        <ErrorMessage message={error} />
        <button className="button primary" onClick={start} disabled={busy}>
          {busy ? 'نجهّز مساحتك…' : 'ابدأ المشاركة التجريبية'}
          <Icon />
        </button>
        <p className="fine-print">الأسئلة مبنية على النص التجريبي، وليست أسئلة المسابقة الرسمية.</p>
      </section>
    );
  const q = attempt.questions[index];
  const count = Object.keys(answers).length;
  return (
    <>
      <div className="competition-heading">
        <div>
          <span className="eyebrow">مساحة المشاركة</span>
          <h1>{review ? 'نظرة أخيرة، قبل الإرسال.' : 'كل سؤال، مساحة للتأمل.'}</h1>
        </div>
        <DemoNote compact />
      </div>
      <div className={`competition-grid ${book ? 'with-book' : ''}`}>
        <motion.div layout ref={questionArea}>
          <section className="question-card">
            <header className="question-toolbar">
              <span>
                {review ? 'مراجعة المشاركة' : `السؤال ${index + 1} من ${attempt.questions.length}`}
              </span>
              <span className={`save-status ${saveState}`} role="status">
                {saveState === 'saving' ? (
                  <>
                    <span className="spinner small" /> جارٍ الحفظ
                  </>
                ) : saveState === 'error' ? (
                  'لم يتم الحفظ'
                ) : (
                  <>
                    <Icon name="check" size={16} /> تم الحفظ
                  </>
                )}
              </span>
            </header>
            <div className="progress-track">
              <span style={{ width: `${(count / attempt.questions.length) * 100}%` }} />
            </div>
            <ErrorMessage message={error} />
            {saveState === 'error' && (
              <div className="recovery-actions">
                <button className="text-link" onClick={() => save(answers)}>
                  إعادة محاولة الحفظ
                </button>
                <button className="text-link" onClick={() => window.location.reload()}>
                  تحميل النسخة المحفوظة بدل التعديلات المحلية
                </button>
              </div>
            )}
            {review ? (
              <div className="review-body">
                <span className="eyebrow">
                  {count} من {attempt.questions.length} إجابات مكتملة
                </span>
                <h2>مشاركتك بين يديك.</h2>
                <p>
                  يمكنك العودة إلى أي سؤال لتعديل إجابتك. بعد الإرسال النهائي، لن تتمكن من التعديل.
                </p>
                <div className="review-list">
                  {attempt.questions.map((item, i) => (
                    <button key={item.id} onClick={() => go(i)}>
                      <span>{i + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {answers[item.id] !== undefined
                            ? item.options[answers[item.id]]
                            : 'لم تُجب عن هذا السؤال'}
                        </small>
                      </div>
                      <Icon name={answers[item.id] !== undefined ? 'check' : 'arrow'} size={20} />
                    </button>
                  ))}
                </div>
                {count < attempt.questions.length && (
                  <div className="notice">
                    لديك {attempt.questions.length - count} أسئلة دون إجابة. في هذا العرض تُحتسب
                    الإجابة المتروكة بصفر.
                  </div>
                )}
                {confirm ? (
                  <div className="submit-confirm" role="group" aria-label="تأكيد الإرسال النهائي">
                    <h3>هل أنت مستعد لإرسال مشاركتك؟</h3>
                    <p>هذا الإجراء نهائي، ويشمل الإجابات الموضحة أعلاه.</p>
                    <div className="button-row">
                      <button
                        className="button primary"
                        disabled={busy || saveState !== 'saved'}
                        onClick={submit}
                      >
                        {busy ? 'جارٍ الإرسال…' : 'تأكيد الإرسال النهائي'}
                        <Icon name="check" />
                      </button>
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() => setConfirm(false)}
                      >
                        العودة للمراجعة
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="button primary"
                    disabled={saveState !== 'saved'}
                    onClick={() => setConfirm(true)}
                  >
                    إرسال المشاركة <Icon />
                  </button>
                )}
              </div>
            ) : (
              <div className="question-body">
                <span className="eyebrow">اقرأ. تأمل. اختر.</span>
                <h2 ref={questionHeading} tabIndex={-1}>
                  {q.title}
                </h2>
                <div className="answer-options" role="radiogroup" aria-label={q.title}>
                  {q.options.map((option, i) => (
                    <motion.button
                      key={`${q.id}-${i}`}
                      role="radio"
                      aria-checked={answers[q.id] === i}
                      aria-disabled={saveState === 'saving'}
                      tabIndex={
                        answers[q.id] === i || (answers[q.id] === undefined && i === 0) ? 0 : -1
                      }
                      className={`answer-option ${answers[q.id] === i ? 'selected' : ''}`}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => {
                        if (saveState !== 'saving') save({ ...answers, [q.id]: i });
                      }}
                      onKeyDown={(e) => {
                        const directions: Record<string, number> = {
                          ArrowDown: 1,
                          ArrowUp: -1,
                          ArrowLeft: 1,
                          ArrowRight: -1,
                        };
                        if (!(e.key in directions) && e.key !== 'Home' && e.key !== 'End') return;
                        e.preventDefault();
                        if (saveState === 'saving') return;
                        const next =
                          e.key === 'Home'
                            ? 0
                            : e.key === 'End'
                              ? q.options.length - 1
                              : (i + directions[e.key] + q.options.length) % q.options.length;
                        const buttons =
                          e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                            '[role="radio"]',
                          );
                        buttons?.[next].focus();
                        save({ ...answers, [q.id]: next });
                      }}
                    >
                      <span className="answer-letter">{['أ', 'ب', 'ج', 'د'][i]}</span>
                      <span>{option}</span>
                      <span className="radio-indicator">
                        {answers[q.id] === i && <Icon name="check" size={15} />}
                      </span>
                    </motion.button>
                  ))}
                </div>
                <div className="question-tip">
                  <Icon name="book" size={18} />
                  <span>يمكنك الرجوع إلى النص أثناء الإجابة.</span>
                </div>
                <div className="question-navigation">
                  <button
                    className="button outline"
                    disabled={index === 0 || saveState === 'saving'}
                    onClick={() => go(index - 1)}
                  >
                    <span className="reverse-icon">
                      <Icon />
                    </span>{' '}
                    السابق
                  </button>
                  <button
                    className="button primary"
                    disabled={saveState === 'saving'}
                    onClick={() =>
                      index === attempt.questions.length - 1 ? setReview(true) : go(index + 1)
                    }
                  >
                    {index === attempt.questions.length - 1 ? 'مراجعة المشاركة' : 'السؤال التالي'}
                    <Icon />
                  </button>
                </div>
              </div>
            )}
          </section>
          <div className="question-map" aria-label="التنقل بين الأسئلة">
            {attempt.questions.map((item, i) => (
              <button
                key={item.id}
                className={`${index === i && !review ? 'current' : ''} ${answers[item.id] !== undefined ? 'answered' : ''}`}
                disabled={saveState === 'saving'}
                onClick={() => go(i)}
                aria-label={`السؤال ${i + 1}${answers[item.id] !== undefined ? '، تمت الإجابة' : ''}`}
                aria-current={index === i && !review ? 'step' : undefined}
              >
                {i + 1}
              </button>
            ))}
            <button
              className={review ? 'current review-map' : 'review-map'}
              disabled={saveState === 'saving'}
              onClick={() => setReview(true)}
              aria-label="مراجعة جميع الإجابات"
            >
              <Icon name="check" size={18} />
            </button>
          </div>
          <div className="competition-bottom">
            <button
              ref={bookButton}
              className="text-link"
              onClick={() => setBook(!book)}
              aria-expanded={book}
            >
              <Icon name="book" /> {book ? 'إغلاق مساحة القراءة' : 'افتح النص بجانب الأسئلة'}
            </button>
            <span>لا يوجد مؤقت للإجابة</span>
          </div>
        </motion.div>
        {book && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            ref={bookPanel}
            tabIndex={-1}
            className="book-panel"
            role={narrow ? 'dialog' : 'region'}
            aria-modal={narrow ? true : undefined}
            aria-label="النص التجريبي أثناء المشاركة"
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeBook();
              if (e.key === 'Tab' && narrow) {
                const items = bookPanel.current?.querySelectorAll<HTMLElement>(
                  'button, a, [tabindex="0"]',
                );
                if (items?.length) {
                  const first = items[0],
                    last = items[items.length - 1];
                  if (
                    e.shiftKey &&
                    (document.activeElement === first ||
                      document.activeElement === bookPanel.current)
                  ) {
                    e.preventDefault();
                    last.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                  }
                }
              }
            }}
          >
            <BookReader embedded onClose={closeBook} />
          </motion.div>
        )}
      </div>
    </>
  );
}
