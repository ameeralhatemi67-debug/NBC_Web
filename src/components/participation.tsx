'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, ErrorMessage, Icon, Loading } from './ui';
import { BookReader } from './book-reader';
import { Leaderboard } from './leaderboard';
import {
  hintEligible,
  hintTarget,
  registeredStage,
  stageNames,
  type CompetitionState,
  type WriteEvent,
} from '@/lib/competition-domain';
import {
  DurableCompetitionSession,
  localRead,
  localWrite,
  overlayPending,
  type LocalCompetition,
} from '@/lib/competition-offline';

export function Participation({
  testRunId,
  initialState,
  simulateOffline = false,
}: {
  testRunId?: string;
  initialState?: CompetitionState;
  simulateOffline?: boolean;
}) {
  const [data, setData] = useState<CompetitionState | null>(initialState ?? null);
  const [loading, setLoading] = useState(!initialState);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [maxPage, setMaxPage] = useState(1);
  const [saveState, setSaveState] = useState<'saved' | 'local' | 'syncing' | 'error'>('saved');
  const [pending, setPending] = useState(0);
  const [bookOpen, setBookOpen] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const controller = useRef<DurableCompetitionSession | null>(null);
  const offline = useRef(simulateOffline);
  offline.current = simulateOffline;
  const heading = useRef<HTMLHeadingElement>(null);
  const bookPanel = useRef<HTMLDivElement>(null);
  const questionArea = useRef<HTMLDivElement>(null);
  const bookButton = useRef<HTMLButtonElement>(null);
  const readPath = testRunId ? `admin/test-run?id=${encodeURIComponent(testRunId)}` : 'participant';
  const writePath = testRunId ? 'admin/test-run/event' : 'attempt/event';
  async function attach(state: CompetitionState) {
    setData(state);
    if (!state.attempt) {
      controller.current = null;
      if (!testRunId) await localWrite('participant-active', null);
      return;
    }
    const key = `${testRunId ? 'test' : 'participant'}:${state.attempt.id}`;
    const service = new DurableCompetitionSession(
      key,
      {
        state: () =>
          api<CompetitionState>(
            readPath +
              (!testRunId ? `?competitionId=${encodeURIComponent(state.competition.id)}` : ''),
            undefined,
            AbortSignal.timeout(12000),
          ),
        write: (event) => api<CompetitionState>(writePath, event, AbortSignal.timeout(12000)),
      },
      (record, status, message) => {
        setData(overlayPending(record.state, record.events));
        setPending(record.events.length);
        setSaveState(status);
        if (message) setError(message);
        else if (status === 'saved') setError('');
      },
    );
    controller.current = service;
    await service.init(state);
    setIndex(Math.min(service.record.index, state.attempt.questions.length - 1));
    setPage(service.record.page);
    setMaxPage(service.record.maxPage);
    if (!testRunId) await localWrite('participant-active', key);
    void service.sync(offline.current);
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const state = initialState ?? (await api<CompetitionState>(readPath));
        if (alive) await attach(state);
      } catch (e) {
        if (!(e instanceof ApiError) && !testRunId) {
          const key = await localRead<string>('participant-active').catch(() => undefined);
          const old = key
            ? await localRead<LocalCompetition>(key).catch(() => undefined)
            : undefined;
          if (old && alive) {
            await attach(old.state);
            setSaveState('local');
            setError('تعمل من النسخة المحلية. يلزم تسجيل دخول صالح عند عودة الاتصال.');
            return;
          }
        }
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const mq = matchMedia('(max-width: 900px)');
    setNarrow(mq.matches);
    setBookOpen(!mq.matches);
    const resize = () => setNarrow(mq.matches);
    mq.addEventListener('change', resize);
    const sync = () => void controller.current?.sync(offline.current);
    const lost = () => setSaveState('local');
    window.addEventListener('online', sync);
    window.addEventListener('offline', lost);
    const interval = setInterval(sync, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
      mq.removeEventListener('change', resize);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', lost);
    };
  }, [testRunId]);
  useEffect(() => {
    if (!simulateOffline) void controller.current?.sync();
    else setSaveState('local');
  }, [simulateOffline]);
  useEffect(() => {
    if (bookOpen && narrow) {
      bookPanel.current?.focus();
      document.body.style.overflow = 'hidden';
      if (questionArea.current) questionArea.current.inert = true;
    }
    return () => {
      document.body.style.overflow = '';
      if (questionArea.current) questionArea.current.inert = false;
    };
  }, [bookOpen, narrow]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (busy) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [busy]);
  async function start() {
    setBusy(true);
    setError('');
    try {
      await attach(await api<CompetitionState>('attempt/start', {}));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function write(kind: WriteEvent['kind'], selected?: number[]) {
    if (!data?.attempt || !controller.current) return;
    setBusy(true);
    setError('');
    try {
      await controller.current.enqueue({
        clientEventId: crypto.randomUUID(),
        attemptId: data.attempt.id,
        kind,
        ...(kind === 'SUBMIT' ? {} : { questionId: data.attempt.questions[index].id, selected }),
        revision: data.attempt.revision,
      });
      void controller.current.sync(offline.current);
    } catch (e) {
      setError((e as Error).message);
      setSaveState('error');
    } finally {
      setBusy(false);
    }
  }
  function go(i: number) {
    setIndex(i);
    void controller.current?.remember(i, page, maxPage).catch((e) => setError(e.message));
    requestAnimationFrame(() => heading.current?.focus());
  }
  function readPage(n: number) {
    setPage(n);
    const max = Math.max(maxPage, n);
    setMaxPage(max);
    void controller.current?.remember(index, n, max).catch((e) => setError(e.message));
  }
  function openBook(n?: number) {
    if (n) readPage(n);
    setBookOpen(true);
  }
  function closeBook() {
    setBookOpen(false);
    requestAnimationFrame(() => bookButton.current?.focus());
  }
  const banner = testRunId ? (
    <div className="test-run-banner" role="status">
      وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة
    </div>
  ) : data?.competition.fixture ? (
    <div className="notice">محتوى اصطناعي محلي للاختبار، وليس بنك أسئلة الكتاب المعتمد.</div>
  ) : null;
  if (loading) return <Loading />;
  if (!data)
    return (
      <section className="empty-state">
        <h1>مساحة المشاركة</h1>
        <ErrorMessage message={error} />
        <Link className="button primary" href="/register?mode=login">
          تسجيل الدخول
        </Link>
      </section>
    );
  const a = data.attempt;
  if (!a)
    return (
      <section className="participation-intro">
        {banner}
        <span className="eyebrow">{data.competition.title}</span>
        <h1>أهلًا {data.participant.name.split(' ')[0]}</h1>
        <p>{data.participant.stage} · 20 سؤالًا من الكتاب، دون مؤقت لكل سؤال</p>
        <p>بعد «تحقق من الإجابة» تُثبت إجابتك نهائيًا. يمكنك مراجعة الكتاب والتنقل بين الأسئلة.</p>
        <p>
          {data.competition.feedbackMode === 'educational'
            ? 'هذه مسابقة تعليمية: يُعرض التصحيح بعد تثبيت الإجابة.'
            : 'الوضع الرسمي: لا تُعرض الإجابات الصحيحة.'}
        </p>
        <p>
          حالة المسابقة: {data.competition.state}{' '}
          {data.competition.opensAt &&
            `· تفتح ${new Date(data.competition.opensAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}`}
        </p>
        <ErrorMessage message={error} />
        <button
          className="button primary"
          disabled={busy || data.competition.state !== 'OPEN'}
          onClick={start}
        >
          ابدأ المشاركة <Icon />
        </button>
      </section>
    );
  if (a.submittedAt)
    return (
      <section className="receipt-card">
        {banner}
        <div className="receipt-icon">
          <Icon name="check" size={38} />
        </div>
        <h1>تم استلام مشاركتك</h1>
        <p>يمكنك الاحتفاظ برقم المشارك. لا يمكن بدء محاولة ثانية لهذه المسابقة.</p>
        <div className="receipt-number">
          <span>رقم المشارك</span>
          <bdi>{a.participantNumber}</bdi>
          <button
            className="text-link"
            onClick={() =>
              navigator.clipboard
                .writeText(a.participantNumber)
                .catch(() => setError('انسخ الرقم يدويًا.'))
            }
          >
            نسخ الرقم
          </button>
        </div>
        {a.score !== null ? (
          <div className="result-box">
            <strong>{a.percentage}%</strong>
            <p>
              {a.score} / {a.maxScore}
            </p>
          </div>
        ) : (
          <p>النتيجة محجوبة وفق سياسة المسابقة.</p>
        )}
        <ErrorMessage message={error} />
        <p>الترتيب والجوائز يخضعان لاعتماد اللجنة، والتعادل لا يُحسم بسرعة المشاركة.</p>
        <Leaderboard
          competitionId={data.competition.id}
          stage={registeredStage(data.participant.stage)}
          testRunId={testRunId}
        />
        <Link className="button outline" href="/book">
          واصل القراءة
        </Link>
      </section>
    );
  const q = a.questions[index];
  const answer = a.answers[q.id];
  const count = a.questions.filter((q) => a.answers[q.id]?.locked).length;
  const feedback = a.feedback[q.id];
  return (
    <>
      {banner}
      <div className="competition-heading">
        <div>
          <span className="eyebrow">{data.competition.title}</span>
          <h1>{stageNames[q.stage]}</h1>
        </div>
        <span>
          {count} / {a.questions.length} إجابات مثبتة
        </span>
      </div>
      <div className={`competition-grid ${bookOpen ? 'with-book' : ''}`}>
        <div ref={questionArea}>
          <section className="question-card">
            <header className="question-toolbar">
              <span>
                السؤال {index + 1} من {a.questions.length}
              </span>
              <span className={`save-status ${saveState}`} role="status" aria-live="polite">
                {saveState === 'saved'
                  ? 'محفوظ على الخادم'
                  : saveState === 'syncing'
                    ? `جارٍ مزامنة ${pending} أحداث…`
                    : saveState === 'local'
                      ? 'محفوظ محليًا، ينتظر الاتصال'
                      : 'تعذرت المزامنة، أعد المحاولة'}
              </span>
            </header>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="الإجابات المثبتة"
              aria-valuemin={0}
              aria-valuemax={a.questions.length}
              aria-valuenow={count}
            >
              <span style={{ width: `${(count / a.questions.length) * 100}%` }} />
            </div>
            <ErrorMessage message={error} />
            {(pending > 0 || saveState === 'error') && (
              <button
                className="text-link"
                onClick={() => void controller.current?.sync(offline.current)}
              >
                إعادة المزامنة ({pending})
              </button>
            )}
            <div className="question-body">
              <span className="eyebrow">صفحة الكتاب المطبوعة {q.printedPage}</span>
              <h2 ref={heading} tabIndex={-1}>
                {q.title}
              </h2>
              <fieldset className="answer-options" disabled={busy || answer?.locked}>
                <legend className="sr-only">
                  {q.type === 'multi_select' ? 'حدد جميع الإجابات الصحيحة' : 'اختر إجابة واحدة'}
                </legend>
                {q.options.map((option, i) => (
                  <label
                    key={`${q.id}-${i}`}
                    className={`answer-option ${answer?.selected.includes(i) ? 'selected' : ''}`}
                  >
                    <input
                      type={q.type === 'multi_select' ? 'checkbox' : 'radio'}
                      name={q.id}
                      checked={answer?.selected.includes(i) ?? false}
                      onChange={() => {
                        const selected =
                          q.type === 'single_choice'
                            ? [i]
                            : answer?.selected.includes(i)
                              ? answer.selected.filter((v) => v !== i)
                              : [...(answer?.selected ?? []), i];
                        void write('SELECT', selected);
                      }}
                    />
                    <span className="answer-letter">{['أ', 'ب', 'ج', 'د', 'هـ', 'و'][i]}</span>
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
              {answer?.locked ? (
                <div className="notice" role="status">
                  <strong>تم تثبيت الإجابة ولا يمكن تغييرها.</strong>
                  {answer.checkedAt === 'local-pending' && (
                    <p>تنتظر تأكيد الخادم. أي إجابة مثبتة سابقًا على الخادم لها الأولوية.</p>
                  )}
                  {feedback && (
                    <>
                      <p>
                        {feedback.isCorrect ? 'إجابتك صحيحة' : 'إجابتك غير صحيحة'} · الإجابة
                        الصحيحة: {feedback.correctAnswers.map((i) => q.options[i]).join('، ')}
                      </p>
                      <p>{feedback.explanation}</p>
                    </>
                  )}
                  {!feedback && <p>سياسة المسابقة لا تعرض التصحيح هنا.</p>}
                </div>
              ) : (
                <button
                  className="button primary"
                  disabled={busy || !answer?.selected.length}
                  onClick={() => write('CHECK', answer?.selected)}
                >
                  تحقق من الإجابة وثبتها
                </button>
              )}
              <div className="question-tip">
                <button ref={bookButton} className="text-link" onClick={() => openBook(q.pdfPage)}>
                  <Icon name="book" /> المصدر: الصفحة المطبوعة {q.printedPage}
                </button>
                {hintEligible(maxPage, q) && (
                  <button className="text-link" onClick={() => openBook(hintTarget(q)[0])}>
                    تلميح: راجع صفحات PDF {hintTarget(q).join('–')}
                  </button>
                )}
              </div>
              <div className="question-navigation">
                <button
                  className="button outline"
                  disabled={index === 0}
                  onClick={() => go(index - 1)}
                >
                  السابق
                </button>
                <button
                  className="button primary"
                  disabled={index === a.questions.length - 1}
                  onClick={() => go(index + 1)}
                >
                  السؤال التالي <Icon />
                </button>
              </div>
              {count === a.questions.length && (
                <div className="submit-confirm">
                  <p>جميع الإجابات مثبتة. تُحسب النتيجة على الخادم بعد المزامنة.</p>
                  <button
                    className="button primary"
                    disabled={
                      busy || controller.current?.record.events.some((e) => e.kind === 'SUBMIT')
                    }
                    onClick={() => write('SUBMIT')}
                  >
                    إرسال المشاركة النهائية
                  </button>
                </div>
              )}
              {a.recoveryUntil && (
                <p>
                  المهلة التقنية حتى{' '}
                  {new Date(a.recoveryUntil).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
                </p>
              )}
            </div>
          </section>
          <nav className="question-map" aria-label="التنقل بين الأسئلة">
            {a.questions.map((item, i) => (
              <button
                key={item.id}
                aria-current={i === index ? 'step' : undefined}
                aria-label={`السؤال ${i + 1}${a.answers[item.id]?.locked ? '، مثبت' : ''}`}
                className={`${i === index ? 'current' : ''} ${a.answers[item.id]?.locked ? 'answered' : ''}`}
                onClick={() => go(i)}
              >
                {i + 1}
              </button>
            ))}
          </nav>
          <button
            className="text-link"
            aria-expanded={bookOpen}
            onClick={() => (bookOpen ? closeBook() : openBook())}
          >
            {bookOpen ? 'إغلاق الكتاب' : 'افتح الكتاب'} <Icon name="book" />
          </button>
        </div>
        {bookOpen && (
          <div
            ref={bookPanel}
            tabIndex={-1}
            className="book-panel"
            role={narrow ? 'dialog' : 'region'}
            aria-modal={narrow || undefined}
            aria-label="كتاب المسابقة"
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeBook();
              if (e.key === 'Tab' && narrow) {
                const items = Array.from(
                  bookPanel.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled),a,input',
                  ) ?? [],
                );
                const first = items[0],
                  last = items.at(-1);
                if (
                  e.shiftKey &&
                  (document.activeElement === first || document.activeElement === bookPanel.current)
                ) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <BookReader
              book={data.book}
              page={page}
              onPageChange={readPage}
              embedded
              onClose={closeBook}
            />
          </div>
        )}
      </div>
    </>
  );
}
