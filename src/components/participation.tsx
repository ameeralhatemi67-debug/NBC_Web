'use client';
import Link from 'next/link';
import {
  furthestPageRead,
  nextUnreadSourcePage,
  READING_MIN_SOURCE_SECONDS,
  readingGap,
  sourceReadingReady,
  sourceReadingShare,
  type ReadingGap,
  type ReadingProgress,
} from '@/lib/reading-progress';
import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError, ErrorMessage, Icon, Loading } from './ui';
import { BookReader } from './book-reader';
import { CompetitionIntro } from './competition-intro';
import { CompetitionResult } from './competition-result';
import { AnswerFeedback, AnswerOption } from './question-card-parts';
import { ExamDialog, ExamReview, QuestionStrip } from './exam-controls';
import { arDigits, arPlural, riyadhDateTime } from '@/lib/format';
import {
  hintEligible,
  completedAnswers,
  finalSubmission,
  hintTarget,
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
  practiceRunId,
  initialState,
  simulateOffline = false,
  onExit,
  examView = true,
  onStateChange,
}: {
  testRunId?: string;
  practiceRunId?: string;
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
  // Set when a reading rule stopped the student: the book is moved to the answer's page and the
  // choices open by themselves once the server credits the reading, so nobody is left stuck.
  const [guide, setGuide] = useState<{ questionId: string; gap: ReadingGap } | null>(null);
  const guideOpenedDock = useRef('');
  // "How it works" window, shown once per attempt before the first question.
  const [howOpen, setHowOpen] = useState(false);
  const nudgeId = useId();
  const flashRequest = useRef(0);
  const mainAction = useRef<HTMLButtonElement>(null);
  const priorLocks = useRef({ attemptId: '', count: 0 });
  const hintDescription = useId();
  const final = Boolean(data && finalSubmission(data.competition));
  const lockedCount = data?.attempt
    ? completedAnswers(data.attempt.questions, data.attempt.answers, final)
    : 0;
  const currentQuestionId = data?.attempt?.questions[index]?.id;
  const currentLocked = !!(currentQuestionId && data?.attempt?.answers[currentQuestionId]?.locked);
  const currentFeedback = !!(currentQuestionId && data?.attempt?.feedback[currentQuestionId]);
  const isOffline = simulateOffline || !connected;
  const currentSource = data?.attempt?.questions[index];
  const sourceReady =
    !data?.competition.readingRequired ||
    Boolean(currentSource && sourceReadingReady(data?.attempt?.reading, currentSource));
  const readingInFlight = useRef(false);
  const lastReadingActivity = useRef(Date.now());
  const readingContext = useRef({
    id: '',
    page: 1,
    active: false,
    offline: false,
    required: false,
    submitted: false,
  });
  readingContext.current = {
    id: data?.attempt?.id ?? '',
    page,
    active: bookOpen && (!narrow || !dockExpanded),
    offline: isOffline,
    required: Boolean(data?.competition.readingRequired),
    submitted: Boolean(data?.attempt?.submittedAt),
  };
  const controller = useRef<DurableCompetitionSession | null>(null);
  const offline = useRef(simulateOffline);
  offline.current = simulateOffline;
  const heading = useRef<HTMLHeadingElement>(null);
  const bookPanel = useRef<HTMLDivElement>(null);
  const examShell = useRef<HTMLDivElement>(null);
  const questionArea = useRef<HTMLDivElement>(null);
  const bookButton = useRef<HTMLButtonElement>(null);
  const activePointer = practiceRunId ? `simulation-active:${practiceRunId}` : 'participant-active';
  const readPath = practiceRunId
    ? `simulation/participant?runId=${encodeURIComponent(practiceRunId)}`
    : testRunId
      ? `admin/test-run?id=${encodeURIComponent(testRunId)}`
      : 'participant';
  const writePath = practiceRunId
    ? 'simulation/event'
    : testRunId
      ? 'admin/test-run/event'
      : 'attempt/event';
  async function reportReading() {
    const context = { ...readingContext.current };
    if (
      readingInFlight.current ||
      !context.id ||
      !context.required ||
      context.offline ||
      context.submitted
    )
      return;
    const canvas = bookPanel.current?.querySelector<HTMLCanvasElement>(
      `[data-page="${context.page}"] canvas`,
    );
    const rect = canvas?.getBoundingClientRect();
    const panel = bookPanel.current?.getBoundingClientRect();
    const visible =
      rect &&
      panel &&
      rect.bottom > Math.max(0, panel.top) &&
      rect.top < Math.min(innerHeight, panel.bottom);
    const active = Boolean(
      context.active &&
      visible &&
      document.visibilityState === 'visible' &&
      Date.now() - lastReadingActivity.current < 45000,
    );
    readingInFlight.current = true;
    try {
      const reading = await api<ReadingProgress>(
        practiceRunId
          ? 'simulation/reading'
          : testRunId
            ? 'admin/test-run/reading'
            : 'attempt/reading',
        {
          attemptId: context.id,
          clientEventId: crypto.randomUUID(),
          page: context.page,
          active,
        },
        AbortSignal.timeout(12000),
      );
      if (readingContext.current.id !== context.id) return;
      await controller.current?.rememberReading(reading);
      setData((state) =>
        state?.attempt && state.attempt.id === context.id
          ? { ...state, attempt: { ...state.attempt, reading } }
          : state,
      );
    } catch {
      // Answer synchronization keeps its own error state; new reading needs a server connection.
    } finally {
      readingInFlight.current = false;
    }
  }
  useEffect(() => {
    const touch = () => {
      lastReadingActivity.current = Date.now();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchmove'];
    events.forEach((name) =>
      window.addEventListener(name, touch, { capture: true, passive: true }),
    );
    const visible = () => {
      void reportReading();
    };
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 2000);
    void reportReading();
    return () => {
      clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, touch, { capture: true }));
      document.removeEventListener('visibilitychange', visible);
    };
  }, [data?.attempt?.id]);
  useEffect(() => {
    void reportReading();
  }, [page, bookOpen, dockExpanded, connected]);
  useEffect(() => {
    if (data) onStateChange?.(data);
  }, [data, onStateChange]);
  useEffect(() => {
    const attempt = data?.attempt;
    if (!attempt || attempt.submittedAt) return;
    let seen = false;
    try {
      seen = localStorage.getItem(`nbc-how-it-works:${attempt.id}`) === '1';
    } catch {
      // Storage can be blocked; the window then shows again, which is harmless.
    }
    if (!seen) setHowOpen(true);
  }, [data?.attempt?.id, data?.attempt?.submittedAt]);
  function closeHowItWorks() {
    setHowOpen(false);
    try {
      if (data?.attempt) localStorage.setItem(`nbc-how-it-works:${data.attempt.id}`, '1');
    } catch {
      // See above.
    }
  }
  async function attach(state: CompetitionState) {
    setData(state);
    if (!state.attempt) {
      controller.current = null;
      if (!testRunId) await localWrite(activePointer, null);
      return;
    }
    const key = `${practiceRunId ? `simulation:${practiceRunId}` : testRunId ? 'test' : 'participant'}:${state.attempt.id}`;
    const service = new DurableCompetitionSession(
      key,
      {
        state: () =>
          api<CompetitionState>(
            readPath +
              (!testRunId && !practiceRunId
                ? `?competitionId=${encodeURIComponent(state.competition.id)}`
                : ''),
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
    if (!testRunId) await localWrite(activePointer, key);
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
          const key = await localRead<string>(activePointer).catch(() => undefined);
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
  }, [testRunId, practiceRunId]);
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
    // With final submission, choosing the last answer must not pop the review over the question:
    // the student may still be changing it. The last question's button opens the review instead.
    if (
      !final &&
      !attempt.submittedAt &&
      lockedCount === attempt.questions.length &&
      previous < lockedCount
    ) {
      mainAction.current?.focus();
      setReviewOpen(true);
    }
    priorLocks.current = { attemptId: attempt.id, count: lockedCount };
  }, [data?.attempt?.id, data?.attempt?.submittedAt, lockedCount, final]);
  const guidedPage =
    guide && guide.questionId === currentQuestionId && currentSource
      ? nextUnreadSourcePage(data?.attempt?.reading, currentSource)
      : null;
  useEffect(() => {
    // A two-page source: once the first page has its reading time, turn to the second by itself.
    if (guidedPage !== null && guidedPage !== page && bookOpen)
      openSource(guidedPage, bookButton.current ?? document.body);
  }, [guidedPage]);
  useEffect(() => {
    // Guided reading finished: on a phone, bring the question back up so the student can answer.
    if (!guide || guide.questionId !== currentQuestionId || !sourceReady) return;
    if (narrow && bookOpen && guideOpenedDock.current !== guide.questionId) {
      guideOpenedDock.current = guide.questionId;
      setDockExpanded(true);
    }
  }, [guide, currentQuestionId, sourceReady, narrow, bookOpen]);
  useEffect(() => {
    // After locking, the explanation can land below the fold on a phone. Bring it into view.
    if (!currentLocked) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = requestAnimationFrame(() =>
      examShell.current
        ?.querySelector('.question-panel .answer-feedback, .question-dock-sheet .answer-feedback')
        ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [currentQuestionId, currentLocked, currentFeedback]);
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
        if (!final && !busy && !pendingSubmit && !answer?.locked && answer?.selected.length)
          void write('CHECK', answer.selected);
        else if ((answer?.locked || (final && answer?.selected.length)) && !busy) advance(true);
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
  async function start(opened?: Promise<void>) {
    setBusy(true);
    setError('');
    try {
      const started = await api<CompetitionState>(
        practiceRunId ? 'simulation/start' : 'attempt/start',
        practiceRunId ? { runId: practiceRunId } : {},
      );
      await opened;
      await attach(started);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function write(kind: WriteEvent['kind'], selected?: number[]) {
    if (!data?.attempt || !controller.current || pendingSubmit || data.attempt.submittedAt) return;
    if (kind !== 'SUBMIT' && !sourceReady) {
      guideToSource();
      return false;
    }
    if (kind === 'SUBMIT' && data.competition.readingRequired) {
      const missing = data.attempt.questions.findIndex(
        (q) => !sourceReadingReady(data.attempt!.reading, q),
      );
      if (missing >= 0) {
        setReviewOpen(false);
        guideToSource(missing);
        return false;
      }
    }
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
    if (i > index && !sourceReady) {
      guideToSource();
      return;
    }
    setInputOrigin(keyboard ? 'keyboard' : 'pointer');
    setIndex(i);
    setHintPages(null);
    setGuide(null);
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
      pendingSubmit ||
      attempt.answers[question.id]?.locked ||
      option >= question.options.length
    )
      return;
    if (!sourceReady) {
      guideToSource();
      return;
    }
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
    if (!sourceReady) {
      guideToSource();
      return;
    }
    if (index < attempt.questions.length - 1) go(index + 1, keyboard);
    else if (lockedCount === attempt.questions.length) setReviewOpen(true);
    else
      go(
        attempt.questions.findIndex((q) =>
          final ? !attempt.answers[q.id]?.selected.length : !attempt.answers[q.id]?.locked,
        ),
        keyboard,
      );
  }
  // Explains which reading rule stopped the student and moves the book to the answer's page.
  function guideToSource(i = index) {
    const attempt = data?.attempt;
    const question = attempt?.questions[i];
    if (!attempt || !question || question.pdfPage === null) return;
    setError('');
    setGuide({
      questionId: question.id,
      gap: readingGap(attempt.reading, question, maxPage) ?? 'unreached',
    });
    if (i !== index) setIndex(i);
    setDockExpanded(false);
    const target = nextUnreadSourcePage(attempt.reading, question) ?? question.pdfPage;
    const opener =
      (document.activeElement as HTMLElement | null) ?? bookButton.current ?? document.body;
    openSource(target, opener);
    void controller.current
      ?.remember(i, target, Math.max(maxPage, target))
      .catch((e) => setError(e.message));
    // Recorded for the committee: which questions and attempts needed guidance. Best effort.
    if (!isOffline)
      void api(
        practiceRunId ? 'simulation/guide' : testRunId ? 'admin/test-run/guide' : 'attempt/guide',
        {
          attemptId: attempt.id,
          clientEventId: crypto.randomUUID(),
          questionId: question.id,
          gap: readingGap(attempt.reading, question, maxPage) ?? 'unreached',
        },
        AbortSignal.timeout(12000),
      ).catch(() => {});
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
  const banner = practiceRunId ? (
    <div className="test-run-banner practice-banner">
      <span>
        تجربة عامة — لا تُحتسب ضمن نتائج المسابقة · نسخة أسئلة تجريبية
        {data?.practice && (
          <>
            {' '}
            · ينتهي الدخول {riyadhDateTime(data.practice.entryClosesAt)} · آخر موعد للإكمال{' '}
            {riyadhDateTime(data.practice.finishUntil)}
          </>
        )}
      </span>
      <Link className="button outline" href="/participate">
        خروج من التجربة
      </Link>
    </div>
  ) : testRunId ? (
    <div className="test-run-banner">
      <span>
        وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة
        {data?.testQuestionSource === 'bank' ? ' · أسئلة بنك المسابقة' : ' · أسئلة اصطناعية محلية'}
      </span>
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
      <CompetitionIntro
        data={data}
        banner={banner}
        error={error}
        busy={busy}
        onStart={(opened) => void start(opened)}
      />
    );
  if (a.submittedAt)
    return (
      <CompetitionResult data={data} banner={banner} testRunId={testRunId} examView={examView} />
    );
  const q = a.questions[index];
  const answer = a.answers[q.id];
  const feedback = answer?.locked ? a.feedback[q.id] : undefined;
  // A question already answered keeps its hint on every later visit, wherever the reader is now.
  const eligible =
    sourceReady &&
    (Boolean(answer?.selected.length) ||
      hintEligible(Math.max(maxPage, furthestPageRead(a.reading)), q, data.book.pageCount));
  const activeGuide = guide?.questionId === q.id ? guide : null;
  // Thin bar on the page being read: fills as the server credits reading time, so students learn
  // the pace. Only guided reading marks the page as the answer's page.
  const pageMeter = data.competition.readingRequired
    ? {
        page,
        share: Math.min(1, (a.reading?.pageSeconds[page] ?? 0) / READING_MIN_SOURCE_SECONDS),
        target: Boolean(
          activeGuide &&
          q.pdfPage !== null &&
          page >= q.pdfPage &&
          page <= (q.pdfPageEnd ?? q.pdfPage),
        ),
      }
    : undefined;
  const readingShare = sourceReadingShare(a.reading, q);
  const sourcePages =
    q.pdfPageEnd !== undefined && q.pdfPageEnd !== q.pdfPage
      ? `${q.pdfPage} و${q.pdfPageEnd}`
      : `${q.pdfPage}`;
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
          السؤال {arDigits(index + 1)} من {arDigits(a.questions.length)}
        </span>
        {data.competition.readingRequired && (
          <button
            type="button"
            className="text-link how-it-works-link"
            onClick={() => setHowOpen(true)}
          >
            <Icon name="info" size={16} />
            كيف تعمل المسابقة؟
          </button>
        )}
      </header>
      <div className="question-body" key={q.id}>
        <ErrorMessage message={!isOffline && saveState !== 'error' ? error : ''} />
        <h2 ref={heading} tabIndex={-1}>
          {q.title}
        </h2>
        {!sourceReady && (
          <div
            id={nudgeId}
            className={`reading-nudge ${activeGuide ? 'guided' : ''}`}
            role="status"
          >
            {activeGuide ? (
              <>
                <strong>{guideTitles[activeGuide.gap]}</strong>
                <p>
                  {guideReasons[activeGuide.gap]} نقلنا الكتاب إلى الصفحة {sourcePages}. ابقَ عليها
                  لحظات واقرأها، وستُفتح الخيارات تلقائيًا.
                </p>
                <div
                  className="reading-meter"
                  role="progressbar"
                  aria-label="قراءة صفحة الإجابة"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(readingShare * 100)}
                >
                  <span style={{ inlineSize: `${readingShare * 100}%` }} />
                </div>
              </>
            ) : (
              <>
                <strong>اقرأ موضع السؤال في الكتاب أولًا</strong>
                <p>
                  تُفتح الخيارات بعد أن تقرأ الصفحة التي فيها الإجابة. اقرأ بهدوء؛ التقليب السريع أو
                  القفز إلى نهاية الكتاب لا يُحتسب. إن احترت، اضغط أي خيار وسنرشدك إلى الصفحة.
                </p>
              </>
            )}
            {isOffline && <p>يتأكد تقدم القراءة عند عودة الاتصال. تبقى إجاباتك المحفوظة متاحة.</p>}
            {!bookOpen && (
              <button
                type="button"
                className="button outline"
                onClick={(event) =>
                  activeGuide && q.pdfPage !== null
                    ? openSource(
                        nextUnreadSourcePage(a.reading, q) ?? q.pdfPage,
                        event.currentTarget,
                      )
                    : openBook(undefined, event.currentTarget)
                }
              >
                {activeGuide ? 'افتح صفحة الإجابة' : 'افتح الكتاب'}
              </button>
            )}
          </div>
        )}
        {sourceReady && activeGuide && !answer?.selected.length && (
          <div className="reading-nudge ready" role="status">
            <strong>أحسنت، الخيارات مفتوحة الآن</strong>
            <p>اختر إجابتك. يمكنك تغييرها لاحقًا حتى الإرسال النهائي.</p>
          </div>
        )}
        <p className="answer-instruction">
          {q.type === 'multi_select' ? 'حدد كل الإجابات الصحيحة' : 'اختر إجابة واحدة'}
        </p>
        <fieldset
          className={`answer-options ${sourceReady ? '' : 'awaiting-reading'}`}
          disabled={busy || pendingSubmit || answer?.locked}
          aria-describedby={sourceReady ? undefined : nudgeId}
        >
          <legend className="sr-only">
            {q.type === 'multi_select' ? 'حدد كل الإجابات الصحيحة' : 'اختر إجابة واحدة'}
          </legend>
          {q.options.map((option, i) => {
            const chosen = answer?.selected.includes(i) ?? false;
            const correct = feedback?.correctAnswers.includes(i) ?? false;
            return (
              <AnswerOption
                key={`${q.id}-${i}`}
                name={q.id}
                type={q.type}
                index={i}
                text={option}
                checked={chosen}
                state={`${chosen ? 'selected' : ''} ${correct ? 'correct' : feedback && chosen ? 'incorrect' : feedback ? 'dimmed' : ''}`}
                result={
                  correct
                    ? chosen
                      ? 'correct-chosen'
                      : 'correct'
                    : feedback && chosen
                      ? 'incorrect'
                      : null
                }
                onChange={() => selectOption(i)}
              />
            );
          })}
        </fieldset>
        {answer?.locked && (
          <AnswerFeedback
            status={feedback ? (feedback.isCorrect ? 'correct' : 'incorrect') : 'pending'}
            explanation={feedback?.explanation ?? ''}
          >
            {feedback && q.pdfPage !== null && (
              <button
                id={`${openerId}-source`}
                className="source-page-chip"
                onClick={(event) =>
                  q.pdfPage !== null && openSource(q.pdfPage, event.currentTarget)
                }
              >
                <Icon name="book" size={16} />
                افتح الصفحة {q.pdfPage}
              </button>
            )}
          </AnswerFeedback>
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
                <span>
                  {hintPages[0] === hintPages[1]
                    ? 'التلميح مفتوح: صفحة واحدة فقط'
                    : 'التلميح مفتوح: صفحتان فقط'}
                </span>
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
                    if (q.pdfPage === null) return;
                    setHintPages(hintTarget(q));
                    readPage(q.pdfPage);
                    showBook(event.currentTarget);
                  }}
                >
                  <Icon name={eligible ? 'book' : 'lock'} size={16} />
                  {eligible ? 'اعرض التلميح' : 'التلميح'}
                </button>
                <span id={hintDescription}>
                  {q.sourceKind === 'official'
                    ? 'سؤال عن الجهة المنظمة؛ لا يرتبط بصفحات الكتاب.'
                    : eligible
                      ? q.pdfPage === 1 && q.pdfPageEnd === undefined
                        ? 'يعرض صفحة واحدة فقط من الكتاب'
                        : 'يعرض صفحتين فقط من الكتاب'
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
        {!final && !answer?.locked ? (
          <button
            ref={mainAction}
            className="button primary"
            disabled={busy || pendingSubmit || !answer?.selected.length}
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
                : final
                  ? 'إلى أول سؤال لم يُجب'
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
              readingMeter={pageMeter}
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
                  className={`question-dock ${activeGuide && !sourceReady ? 'guiding' : ''}`}
                  aria-expanded={dockExpanded}
                  aria-controls={dockId}
                  onClick={() => {
                    setDockExpanded(!dockExpanded);
                    if (dockExpanded) requestAnimationFrame(() => dockButton.current?.focus());
                  }}
                >
                  <span>
                    {activeGuide && !sourceReady ? (
                      `${guideTitles[activeGuide.gap]}: ابقَ على هذه الصفحة لحظات، وستُفتح الخيارات تلقائيًا`
                    ) : activeGuide && !answer?.selected.length ? (
                      'الخيارات مفتوحة الآن، اضغط هنا لتجيب'
                    ) : (
                      <>
                        سؤال {arDigits(index + 1)} من {arDigits(a.questions.length)}:{' '}
                        {q.title.slice(0, 60)}
                        {q.title.length > 60 ? '…' : ''}
                      </>
                    )}
                  </span>
                  <Icon name="arrow" size={18} />
                  {activeGuide && !sourceReady && (
                    <i
                      className="dock-meter"
                      aria-hidden="true"
                      style={{ inlineSize: `${readingShare * 100}%` }}
                    />
                  )}
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
          final={final}
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
        open={howOpen && !reviewOpen && !mapOpen}
        title="كيف تعمل المسابقة؟"
        onClose={closeHowItWorks}
        returnFocus={() => heading.current?.focus()}
      >
        <HowItWorks
          pageOrder={data.competition.questionOrder === 'page'}
          final={final}
          onStart={closeHowItWorks}
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

const guideTitles: Record<ReadingGap, string> = {
  unreached: 'لم تصل بعد إلى موضع الإجابة',
  'too-fast': 'مررت بصفحة الإجابة بسرعة',
  skipped: 'صفحة الإجابة لم تُقرأ بعد',
};
const guideReasons: Record<ReadingGap, string> = {
  unreached: 'الإجابة في صفحة لم تقرأها بعد.',
  'too-fast': 'تحتاج الصفحة إلى قراءة متأنية لبضع ثوانٍ، والتقليب السريع لا يُحتسب.',
  skipped:
    'الكتاب مفتوح بعد موضع الإجابة، والمرور السريع أو القفز إلى نهاية الكتاب لا يُحتسب قراءة له.',
};

function HowItWorks({
  pageOrder,
  final,
  onStart,
}: {
  pageOrder: boolean;
  final: boolean;
  onStart: () => void;
}) {
  return (
    <div className="how-it-works">
      <p className="how-it-works-lead">
        كل سؤال مأخوذ من صفحة في الكتاب. اقرأ تلك الصفحة، ثم أجب.
        {pageOrder ? ' الأسئلة مرتبة حسب صفحات الكتاب من أوله إلى آخره.' : ''}
      </p>
      <ol className="how-it-works-rules">
        <li>
          <Icon name="book" size={20} />
          <div>
            <strong>اقرأ صفحة الإجابة أولًا</strong>
            <span>تُفتح الخيارات بعد أن تبقى على الصفحة التي فيها الإجابة بضع ثوانٍ.</span>
          </div>
        </li>
        <li>
          <Icon name="clock" size={20} />
          <div>
            <strong>لا تستعجل</strong>
            <span>التقليب السريع للصفحات لا يُحتسب قراءة. الشريط أعلى الصفحة يمتلئ وأنت تقرأ.</span>
          </div>
        </li>
        <li>
          <Icon name="pages" size={20} />
          <div>
            <strong>القفز إلى نهاية الكتاب لا يفتح الأسئلة</strong>
            <span>تُحتسب الصفحة التي قرأتها فقط، لا الصفحات التي تجاوزتها.</span>
          </div>
        </li>
      </ol>
      <p className="how-it-works-help">
        <Icon name="info" size={18} />
        إن احترت، اضغط أي خيار وسننقل الكتاب إلى صفحة الإجابة.
        {final
          ? ' يمكنك تعديل إجاباتك حتى الإرسال النهائي، وبعده ترى نسبة إجاباتك الصحيحة وترتيبك.'
          : ''}
      </p>
      <div className="review-actions">
        <button data-autofocus type="button" className="button primary" onClick={onStart}>
          ابدأ المسابقة
        </button>
      </div>
    </div>
  );
}
