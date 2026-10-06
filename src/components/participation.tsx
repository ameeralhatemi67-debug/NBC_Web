'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError, ErrorMessage, Icon, Loading } from './ui';
import { BookReader } from './book-reader';
import { Leaderboard } from './leaderboard';
import { CompetitionClosingTime } from './competition-closing-time';
import { ExamDialog, ExamReview, QuestionStrip } from './exam-controls';
import {
  arPlural,
  competitionStateLabels,
  NumPair,
  resultSentence,
  riyadhDateTime,
} from '@/lib/format';
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
  onExit,
  examView = true,
  onStateChange,
}: {
  testRunId?: string;
  initialState?: CompetitionState;
  simulateOffline?: boolean;
  onExit?: () => void;
  examView?: boolean;
  onStateChange?: (state: CompetitionState) => void;
}) {
  const [data, setData] = useState<CompetitionState | null>(initialState ?? null);
  const [loading, setLoading] = useState(!initialState);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [maxPage, setMaxPage] = useState(1);
  const [saveState, setSaveState] = useState<'saved' | 'local' | 'syncing' | 'error'>('saved');
  const [pendingAnswers, setPendingAnswers] = useState(0);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [readerMounted, setReaderMounted] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(false);
  const dockButton = useRef<HTMLButtonElement>(null);
  const readerOpener = useRef<HTMLElement | null>(null);
  const readerOpenerId = useRef('');
  const openerId = useId();
  const readerHistory = useRef(false);
  const readerHistoryId = useId();
  const dockId = useId();
  const [narrow, setNarrow] = useState(false);
  const [hintPages, setHintPages] = useState<number[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [inputOrigin, setInputOrigin] = useState<'pointer' | 'keyboard'>('pointer');
  const [sourceFlash, setSourceFlash] = useState<{ page: number; request: number } | null>(null);
  const flashRequest = useRef(0);
  const mainAction = useRef<HTMLButtonElement>(null);
  const priorLocks = useRef({ attemptId: '', count: 0 });
  const hintDescription = useId();
  const lockedCount =
    data?.attempt?.questions.filter((q) => data.attempt?.answers[q.id]?.locked).length ?? 0;
  const isOffline = simulateOffline || !connected;
  const controller = useRef<DurableCompetitionSession | null>(null);
  const offline = useRef(simulateOffline);
  offline.current = simulateOffline;
  const heading = useRef<HTMLHeadingElement>(null);
  const bookPanel = useRef<HTMLDivElement>(null);
  const examShell = useRef<HTMLDivElement>(null);
  const questionArea = useRef<HTMLDivElement>(null);
  const bookButton = useRef<HTMLButtonElement>(null);
  const readPath = testRunId ? `admin/test-run?id=${encodeURIComponent(testRunId)}` : 'participant';
  const writePath = testRunId ? 'admin/test-run/event' : 'attempt/event';
  useEffect(() => {
    if (data) onStateChange?.(data);
  }, [data, onStateChange]);
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
        setPendingAnswers(
          new Set(record.events.flatMap((e) => (e.questionId ? [e.questionId] : []))).size,
        );
        setPendingSubmit(record.events.some((e) => e.kind === 'SUBMIT'));
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
    const mq = matchMedia('(max-width: 819px)');
    setNarrow(mq.matches);
    setBookOpen(!mq.matches);
    setConnected(navigator.onLine);
    const sync = () => {
      setConnected(navigator.onLine);
      void controller.current?.sync(offline.current);
    };
    const lost = () => {
      setConnected(false);
      setSaveState('local');
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', lost);
    const interval = setInterval(sync, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', lost);
    };
  }, [testRunId]);
  useEffect(() => {
    if (!examShell.current) return;
    let first = true;
    const observer = new ResizeObserver(([entry]) => {
      const phone = entry.contentRect.width < 820;
      setNarrow(phone);
      if (first) setBookOpen(!phone);
      first = false;
    });
    observer.observe(examShell.current);
    return () => observer.disconnect();
  }, [data?.attempt?.id, data?.attempt?.submittedAt, loading, examView]);
  useEffect(() => {
    if (!simulateOffline) void controller.current?.sync();
    else setSaveState('local');
  }, [simulateOffline]);
  useEffect(() => {
    const attempt = data?.attempt;
    if (!attempt) return;
    const previous = priorLocks.current.attemptId === attempt.id ? priorLocks.current.count : 0;
    if (
      !attempt.submittedAt &&
      lockedCount === attempt.questions.length &&
      previous < lockedCount
    ) {
      mainAction.current?.focus();
      setReviewOpen(true);
    }
    priorLocks.current = { attemptId: attempt.id, count: lockedCount };
  }, [data?.attempt?.id, data?.attempt?.submittedAt, lockedCount]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const attempt = data?.attempt;
      const target = event.target as HTMLElement | null;
      if (
        !attempt ||
        attempt.submittedAt ||
        reviewOpen ||
        mapOpen ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (
        target?.isContentEditable ||
        target?.closest('textarea,select,input:not([type="radio"]):not([type="checkbox"])')
      )
        return;
      if (event.key === 'Escape' && bookOpen && narrow) {
        event.preventDefault();
        closeBook();
        return;
      }
      if (bookOpen && narrow && !dockExpanded) return;
      if (target?.closest('.reader')) return;
      const question = attempt.questions[index];
      const answer = attempt.answers[question.id];
      if (/^[1-6]$/.test(event.key) && Number(event.key) <= question.options.length) {
        event.preventDefault();
        setInputOrigin('keyboard');
        selectOption(Number(event.key) - 1);
      } else if (event.key === 'Enter' && !target?.closest('button,a')) {
        event.preventDefault();
        setInputOrigin('keyboard');
        if (!busy && !answer?.locked && answer?.selected.length)
          void write('CHECK', answer.selected);
        else if (answer?.locked && !busy) advance(true);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (target?.closest('.answer-options')) return;
        event.preventDefault();
        go(index + (event.key === 'ArrowLeft' ? 1 : -1), true);
      } else if (event.key === 'Escape' && hintPages) {
        event.preventDefault();
        setHintPages(null);
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  });
  useEffect(() => {
    if (examView && data?.attempt && !data.attempt.submittedAt)
      document.body.style.overflow = 'hidden';
    if (bookOpen && narrow) {
      bookPanel.current?.focus();
      document.body.style.overflow = 'hidden';
      if (questionArea.current) questionArea.current.inert = true;
    }
    return () => {
      document.body.style.overflow = '';
      if (questionArea.current) questionArea.current.inert = false;
    };
  }, [bookOpen, narrow, examView, data?.attempt?.id, data?.attempt?.submittedAt]);
  useEffect(() => {
    if (bookOpen) setReaderMounted(true);
    if (!narrow) setDockExpanded(false);
    if (bookOpen && narrow && !readerHistory.current) {
      history.pushState({ ...history.state, nbcReaderId: readerHistoryId }, '', location.href);
      readerHistory.current = true;
    }
  }, [bookOpen, narrow]);
  useEffect(() => {
    const back = () => {
      if (readerHistory.current && history.state?.nbcReaderId !== readerHistoryId) {
        readerHistory.current = false;
        setBookOpen(false);
        setDockExpanded(false);
        setSourceFlash(null);
        requestAnimationFrame(restoreReaderFocus);
      }
    };
    window.addEventListener('popstate', back);
    return () => {
      window.removeEventListener('popstate', back);
      if (readerHistory.current && history.state?.nbcReaderId === readerHistoryId) history.back();
    };
  }, []);
  useEffect(() => {
    if (dockExpanded) requestAnimationFrame(() => heading.current?.focus());
  }, [dockExpanded]);
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
    if (kind === 'CHECK') setHintPages(null);
    try {
      await controller.current.enqueue({
        clientEventId: crypto.randomUUID(),
        attemptId: data.attempt.id,
        kind,
        ...(kind === 'SUBMIT' ? {} : { questionId: data.attempt.questions[index].id, selected }),
        revision: data.attempt.revision,
      });
      void controller.current.sync(offline.current);
      return true;
    } catch (e) {
      setError((e as Error).message);
      setSaveState('error');
    } finally {
      setBusy(false);
    }
  }
  function go(i: number, keyboard = false) {
    if (!data?.attempt || i < 0 || i >= data.attempt.questions.length) return;
    setInputOrigin(keyboard ? 'keyboard' : 'pointer');
    setIndex(i);
    setHintPages(null);
    void controller.current?.remember(i, page, maxPage).catch((e) => setError(e.message));
    requestAnimationFrame(() => heading.current?.focus());
  }
  function selectOption(option: number) {
    const attempt = data?.attempt;
    const question = attempt?.questions[index];
    if (
      !attempt ||
      !question ||
      busy ||
      attempt.answers[question.id]?.locked ||
      option >= question.options.length
    )
      return;
    const chosen = attempt.answers[question.id]?.selected ?? [];
    const selected =
      question.type === 'single_choice'
        ? [option]
        : chosen.includes(option)
          ? chosen.filter((i) => i !== option)
          : [...chosen, option];
    void write('SELECT', selected);
  }
  function advance(keyboard = false) {
    const attempt = data?.attempt;
    if (!attempt) return;
    if (index < attempt.questions.length - 1) go(index + 1, keyboard);
    else if (lockedCount === attempt.questions.length) setReviewOpen(true);
    else
      go(
        attempt.questions.findIndex((q) => !attempt.answers[q.id]?.locked),
        keyboard,
      );
  }
  function openSource(n: number, opener: HTMLElement) {
    openBook(n, opener);
    setSourceFlash({ page: n, request: ++flashRequest.current });
  }
  function readPage(n: number) {
    setPage(n);
    const max = Math.max(maxPage, n);
    setMaxPage(max);
    void controller.current?.remember(index, n, max).catch((e) => setError(e.message));
  }
  function showBook(opener?: HTMLElement) {
    if (!bookOpen) {
      readerOpener.current = opener ?? (document.activeElement as HTMLElement | null);
      readerOpenerId.current = readerOpener.current?.id ?? '';
    }
    setReaderMounted(true);
    setBookOpen(true);
  }
  function openBook(n?: number, opener?: HTMLElement) {
    setSourceFlash(null);
    setHintPages(null);
    if (n) readPage(n);
    showBook(opener);
  }
  function closeBook() {
    if (readerHistory.current && history.state?.nbcReaderId === readerHistoryId) {
      history.back();
      return;
    }
    setDockExpanded(false);
    setSourceFlash(null);
    setBookOpen(false);
    requestAnimationFrame(restoreReaderFocus);
  }
  function restoreReaderFocus() {
    const opener = readerOpenerId.current ? document.getElementById(readerOpenerId.current) : null;
    if (opener) opener.focus();
    else if (readerOpener.current?.isConnected) readerOpener.current.focus();
    else bookButton.current?.focus();
  }
  const banner = testRunId ? (
    <div className="test-run-banner">
      <span>وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة</span>
      {onExit && (
        <button className="button outline" onClick={onExit} disabled={busy}>
          خروج من الاختبار
        </button>
      )}
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
        <p>
          {stageNames[registeredStage(data.participant.stage)]} · 20 سؤالًا من الكتاب، دون مؤقت لكل
          سؤال
        </p>
        <p>بعد تثبيت الإجابة لا يمكنك تغييرها. يمكنك مراجعة الكتاب والتنقل بين الأسئلة.</p>
        <p>تظهر الإجابة الصحيحة والتوضيح بعد تثبيت إجابتك، ولا يمكن تغييرها بعد ذلك.</p>
        <p>
          {competitionStateLabels[data.competition.state]}{' '}
          {data.competition.opensAt &&
            `· تفتح ${riyadhDateTime(data.competition.opensAt)}، بتوقيت الرياض`}
        </p>
        <ErrorMessage message={error} />
        <div className="participation-start-actions">
          <button
            className="button primary"
            disabled={busy || data.competition.state !== 'OPEN'}
            onClick={start}
          >
            ابدأ المشاركة <Icon />
          </button>
          {data.competition.closesAt && (
            <CompetitionClosingTime closesAt={data.competition.closesAt} />
          )}
        </div>
      </section>
    );
  if (a.submittedAt)
    return (
      <section className={`receipt-card ${examView ? 'exam-receipt' : ''}`}>
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
            <p className="result-sentence">{resultSentence(a.score, a.maxScore)}</p>
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
  const feedback = answer?.locked ? a.feedback[q.id] : undefined;
  const eligible = hintEligible(maxPage, q, data.book.pageCount);
  const pendingText = pendingSubmit
    ? 'المشاركة بانتظار الإرسال'
    : pendingAnswers
      ? arPlural(pendingAnswers, [
          'إجابة واحدة بانتظار الإرسال',
          'إجابتان بانتظار الإرسال',
          'إجابات بانتظار الإرسال',
          'إجابة بانتظار الإرسال',
        ])
      : 'دون اتصال';
  const questionCard = (
    <section className="question-card">
      <header className="question-toolbar">
        <span>
          السؤال {index + 1} من {a.questions.length}
        </span>
      </header>
      <div className="question-body" key={q.id}>
        <ErrorMessage message={!isOffline && saveState !== 'error' ? error : ''} />
        <h2 ref={heading} tabIndex={-1}>
          {q.title}
        </h2>
        <p className="answer-instruction">
          {q.type === 'multi_select' ? 'حدد كل الإجابات الصحيحة' : 'اختر إجابة واحدة'}
        </p>
        <fieldset className="answer-options" disabled={busy || answer?.locked}>
          <legend className="sr-only">
            {q.type === 'multi_select' ? 'حدد كل الإجابات الصحيحة' : 'اختر إجابة واحدة'}
          </legend>
          {q.options.map((option, i) => (
            <label
              key={`${q.id}-${i}`}
              className={`answer-option ${answer?.selected.includes(i) ? 'selected' : ''} ${feedback?.correctAnswers.includes(i) ? 'correct' : feedback && answer?.selected.includes(i) ? 'incorrect' : feedback ? 'dimmed' : ''}`}
            >
              <input
                type={q.type === 'multi_select' ? 'checkbox' : 'radio'}
                name={q.id}
                checked={answer?.selected.includes(i) ?? false}
                onChange={() => selectOption(i)}
              />
              <span className="answer-letter">{['أ', 'ب', 'ج', 'د', 'هـ', 'و'][i]}</span>
              <span className="answer-text">{option}</span>
              {feedback?.correctAnswers.includes(i) ? (
                <span className="answer-result">
                  <Icon name="check" size={16} />
                  <span className="answer-result-label">
                    {answer?.selected.includes(i) ? 'إجابتك صحيحة' : 'الصحيحة'}
                  </span>
                </span>
              ) : feedback && answer?.selected.includes(i) ? (
                <span className="answer-result">
                  <Icon name="close" size={16} />
                  <span className="answer-result-label">غير صحيحة</span>
                </span>
              ) : null}
            </label>
          ))}
        </fieldset>
        {answer?.locked && (
          <div
            className={`answer-feedback ${feedback ? (feedback.isCorrect ? 'correct' : 'incorrect') : ''}`}
            role="status"
          >
            <strong>
              <Icon name={feedback ? (feedback.isCorrect ? 'check' : 'close') : 'lock'} size={18} />
              {feedback
                ? feedback.isCorrect
                  ? 'إجابتك صحيحة'
                  : 'إجابتك غير صحيحة'
                : 'تم تثبيت إجابتك'}
            </strong>
            <p>{feedback ? feedback.explanation : 'ستظهر النتيجة عند عودة الاتصال.'}</p>
            {feedback && (
              <button
                id={`${openerId}-source`}
                className="source-page-chip"
                onClick={(event) => openSource(q.pdfPage, event.currentTarget)}
              >
                <Icon name="book" size={16} />
                افتح الصفحة {q.pdfPage}
              </button>
            )}
          </div>
        )}
        <div className="question-tip">
          <button
            ref={bookButton}
            id={`${openerId}-book`}
            className="text-link"
            aria-expanded={bookOpen}
            onClick={(event) => (bookOpen ? closeBook() : openBook(undefined, event.currentTarget))}
          >
            <Icon name="book" />
            {bookOpen ? 'إغلاق الكتاب' : 'افتح الكتاب'}
          </button>
          <div className="hint-control">
            {hintPages ? (
              <>
                <span>التلميح مفتوح: صفحتان فقط</span>
                <button className="text-link" onClick={() => setHintPages(null)}>
                  الكتاب كاملًا
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-link"
                  disabled={!eligible}
                  id={`${openerId}-hint`}
                  aria-describedby={hintDescription}
                  onClick={(event) => {
                    setHintPages(hintTarget(q));
                    readPage(q.pdfPage);
                    showBook(event.currentTarget);
                  }}
                >
                  <Icon name={eligible ? 'book' : 'lock'} size={16} />
                  {eligible ? 'اعرض التلميح' : 'التلميح'}
                </button>
                <span id={hintDescription}>
                  {eligible
                    ? 'يعرض صفحتين فقط من الكتاب'
                    : 'يُفتح بعد أن تتصفّح الكتاب إلى ما بعد موضع الإجابة.'}
                </span>
              </>
            )}
          </div>
        </div>
        {a.recoveryUntil && <p>المهلة التقنية حتى {riyadhDateTime(a.recoveryUntil)}</p>}
      </div>
      <footer className="question-footer">
        <button
          className="button outline"
          disabled={index === 0 || busy}
          onClick={() => go(index - 1)}
        >
          السابق
        </button>
        {!answer?.locked ? (
          <button
            ref={mainAction}
            className="button primary"
            disabled={busy || !answer?.selected.length}
            onClick={() => void write('CHECK', answer?.selected)}
          >
            ثبّت إجابتي<kbd>Enter</kbd>
          </button>
        ) : (
          <button
            ref={mainAction}
            className="button primary"
            disabled={busy}
            onClick={(event) => advance(event.detail === 0)}
          >
            {index < a.questions.length - 1
              ? 'السؤال التالي'
              : lockedCount === a.questions.length
                ? 'راجع وأرسل'
                : 'إلى أول سؤال لم يُثبَّت'}
            <Icon />
          </button>
        )}
      </footer>
    </section>
  );
  return (
    <div
      ref={examShell}
      className={`exam-shell ${examView ? 'exam-preview' : ''} ${narrow ? 'phone-exam' : ''}`}
      data-input={inputOrigin}
      onPointerDownCapture={() => setInputOrigin('pointer')}
      onKeyDownCapture={() => setInputOrigin('keyboard')}
    >
      {banner}
      <div className="competition-heading">
        <h1>{stageNames[q.stage]}</h1>
        <QuestionStrip
          attempt={a}
          index={index}
          onJump={go}
          onCompactOpen={() => setMapOpen(true)}
        />
        <span
          className={`save-status ${isOffline ? 'local' : saveState}`}
          role="status"
          aria-live="polite"
        >
          <Icon
            name={
              isOffline || saveState === 'local'
                ? 'wifi-off'
                : saveState === 'saved'
                  ? 'cloud-check'
                  : saveState === 'syncing'
                    ? 'refresh'
                    : 'close'
            }
            size={16}
          />
          {isOffline || saveState === 'local'
            ? pendingText
            : saveState === 'saved'
              ? 'محفوظ'
              : saveState === 'syncing'
                ? 'جارٍ الحفظ'
                : 'تعذرت المزامنة'}
        </span>
      </div>
      {(isOffline || saveState === 'error') && (
        <div className="exam-connection-banner">
          <span>
            {isOffline
              ? 'أنت دون اتصال. إجاباتك محفوظة على جهازك وتُرسل تلقائيًا عند عودة الاتصال.'
              : error || 'تعذرت المزامنة. إجاباتك محفوظة على جهازك.'}
          </span>
          <button
            className="text-link"
            onClick={() => void controller.current?.sync(offline.current)}
          >
            أعد المحاولة
          </button>
        </div>
      )}
      <div className={`competition-grid ${bookOpen ? 'with-book' : ''}`}>
        <div ref={questionArea} className="question-panel">
          {(!narrow || !bookOpen || !dockExpanded) && questionCard}
          {narrow && !bookOpen && (
            <button
              className="phone-book-bar"
              id={`${openerId}-bar`}
              onClick={(event) => openBook(undefined, event.currentTarget)}
            >
              <Icon name="book" size={18} />
              الكتاب · صفحة {page}
              <Icon name="arrow" size={18} />
            </button>
          )}
        </div>
        {(bookOpen || readerMounted) && (
          <div
            ref={bookPanel}
            hidden={!bookOpen}
            tabIndex={-1}
            className="book-panel"
            role={narrow ? 'dialog' : 'region'}
            aria-modal={narrow || undefined}
            aria-label="كتاب المسابقة"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeBook();
              }
              if (event.key === 'Tab' && narrow) {
                const items = Array.from(
                  bookPanel.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled),a,input,[tabindex="0"]',
                  ) ?? [],
                ).filter(
                  (item) => !item.closest('[inert],[hidden]') && item.getClientRects().length > 0,
                );
                const first = items[0],
                  last = items.at(-1);
                if (
                  event.shiftKey &&
                  (document.activeElement === first || document.activeElement === bookPanel.current)
                ) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
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
              hintPages={hintPages ?? undefined}
              onClearHint={() => setHintPages(null)}
              sourceFlash={sourceFlash}
              phone={narrow}
            />
            {narrow && bookOpen && (
              <>
                {dockExpanded && (
                  <div id={dockId} className="question-dock-sheet">
                    {questionCard}
                  </div>
                )}
                <button
                  ref={dockButton}
                  className="question-dock"
                  aria-expanded={dockExpanded}
                  aria-controls={dockId}
                  onClick={() => {
                    setDockExpanded(!dockExpanded);
                    if (dockExpanded) requestAnimationFrame(() => dockButton.current?.focus());
                  }}
                >
                  <span>
                    سؤال {index + 1} من {a.questions.length}: {q.title.slice(0, 60)}
                    {q.title.length > 60 ? '…' : ''}
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <ExamDialog
        open={reviewOpen && lockedCount === a.questions.length}
        title="راجع إجاباتك قبل الإرسال"
        onClose={() => setReviewOpen(false)}
        returnFocus={() => mainAction.current?.focus()}
      >
        <ExamReview
          attempt={a}
          index={index}
          busy={busy}
          pendingSubmit={pendingSubmit}
          onJump={(i, keyboard) => {
            setReviewOpen(false);
            go(i, keyboard);
          }}
          onClose={() => setReviewOpen(false)}
          onSubmit={() => {
            void write('SUBMIT').then((ok) => {
              if (ok) setReviewOpen(false);
            });
          }}
        />
      </ExamDialog>
      <ExamDialog
        open={mapOpen}
        title="انتقل إلى سؤال"
        onClose={() => setMapOpen(false)}
        returnFocus={() => mainAction.current?.focus()}
      >
        <QuestionStrip
          attempt={a}
          index={index}
          grid
          onJump={(i, keyboard) => {
            setMapOpen(false);
            go(i, keyboard);
          }}
        />
        <button data-autofocus className="button outline" onClick={() => setMapOpen(false)}>
          العودة إلى السؤال
        </button>
      </ExamDialog>
    </div>
  );
}
