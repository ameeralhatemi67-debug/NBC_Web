'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui';
import { NumPair } from '@/lib/format';
import { questionStatus, questionStatusLabels, type ExamAttempt } from '@/lib/exam-presentation';

export function QuestionStrip({
  attempt,
  index,
  onJump,
  onCompactOpen,
  grid = false,
}: {
  attempt: ExamAttempt;
  index: number;
  onJump: (index: number, keyboard: boolean) => void;
  onCompactOpen?: () => void;
  grid?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [ticks, setTicks] = useState(false);
  const canCompact = !!onCompactOpen;
  useEffect(() => {
    if (grid || !container.current || !canCompact) return;
    const observer = new ResizeObserver(([entry]) => {
      setTicks(entry.contentRect.width < 430);
      setCompact(
        entry.contentRect.width < 430 ||
          (entry.contentRect.width - (attempt.questions.length - 1) * 4) /
            attempt.questions.length <
            18,
      );
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [grid, attempt.questions.length, canCompact]);
  const cells = attempt.questions.map((question, i) => {
    const status = questionStatus(attempt, question.id);
    const content =
      status === 'unvisited' ? (
        i + 1
      ) : (
        <Icon
          name={status === 'pending' ? 'lock' : status === 'correct' ? 'check' : 'close'}
          size={14}
        />
      );
    const className = `question-segment ${status} ${index === i ? 'current' : ''}`;
    return compact && !grid ? (
      <span key={question.id} className={className}>
        {ticks ? null : content}
      </span>
    ) : (
      <button
        key={question.id}
        type="button"
        className={className}
        aria-label={`السؤال ${i + 1}، ${questionStatusLabels[status]}`}
        aria-current={index === i ? 'step' : undefined}
        onClick={(event) => onJump(i, event.detail === 0)}
      >
        {content}
      </button>
    );
  });
  return (
    <div ref={container} className={`question-strip-container ${grid ? 'grid' : ''}`}>
      {compact && !grid ? (
        <button
          type="button"
          className={`compact-question-strip ${ticks ? 'ticks' : ''}`}
          onClick={onCompactOpen}
          aria-label="افتح خريطة الأسئلة"
        >
          <span className="question-strip" aria-hidden="true">
            {cells}
          </span>
          {ticks && (
            <span className="strip-position">
              <NumPair a={index + 1} b={attempt.questions.length} />
            </span>
          )}
        </button>
      ) : (
        <nav className="question-strip" aria-label="التنقل بين الأسئلة">
          {cells}
        </nav>
      )}
    </div>
  );
}

export function ExamDialog({
  open,
  title,
  onClose,
  children,
  returnFocus,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  returnFocus: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restore = useRef(returnFocus);
  restore.current = returnFocus;
  useEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    node.showModal();
    const frame = requestAnimationFrame(() =>
      node.querySelector<HTMLElement>('[data-autofocus]')?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      node.close();
      if (opener?.isConnected && !opener.matches(':disabled')) opener.focus();
      else restore.current();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="exam-dialog"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}

export function ExamReview({
  attempt,
  index,
  busy,
  pendingSubmit,
  onJump,
  onSubmit,
  onClose,
}: {
  attempt: ExamAttempt;
  index: number;
  busy: boolean;
  pendingSubmit: boolean;
  onJump: (index: number, keyboard: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const locked = attempt.questions.filter((q) => attempt.answers[q.id]?.locked).length;
  const correct = attempt.questions.filter(
    (q) => questionStatus(attempt, q.id) === 'correct',
  ).length;
  const incorrect = attempt.questions.filter(
    (q) => questionStatus(attempt, q.id) === 'incorrect',
  ).length;
  return (
    <>
      <QuestionStrip attempt={attempt} index={index} onJump={onJump} grid />
      <div className="review-counts">
        <span className="correct">
          <Icon name="check" size={16} />
          {correct} صحيحة
        </span>
        <span className="incorrect">
          <Icon name="close" size={16} />
          {incorrect} غير صحيحة
        </span>
        <span>
          <NumPair a={locked} b={attempt.questions.length} /> مثبتة
        </span>
      </div>
      <p className="review-notice">
        <Icon name="lock" size={18} /> بعد الإرسال لا يمكنك تعديل أي إجابة، ولا بدء محاولة ثانية.
      </p>
      <div className="review-actions">
        <button
          data-autofocus
          className="button primary"
          disabled={busy || pendingSubmit || locked !== attempt.questions.length}
          onClick={onSubmit}
        >
          أرسل مشاركتي
        </button>
        <button className="button outline" onClick={onClose}>
          سأراجع أولًا
        </button>
      </div>
    </>
  );
}
