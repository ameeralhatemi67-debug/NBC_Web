'use client';
import { useState } from 'react';
import {
  stageKeys,
  stageNames,
  type BookVersion,
  type CompetitionQuestion,
  type Stage,
} from '@/lib/competition-domain';
import {
  derivedHint,
  questionBlocked,
  questionChecks,
  withDerivedHint,
} from '@/lib/admin-workshop';
import { AdminPageViewer } from './admin-page-viewer';
import { AnswerFeedback, AnswerOption } from './question-card-parts';
import { Icon } from './ui';

// The student's question card, read only: the same rows and feedback block the exam renders.
export function QuestionPreview({
  q,
  onOpenSource,
}: {
  q: CompetitionQuestion;
  onOpenSource: (page: number) => void;
}) {
  const options = q.options.map((option, i) => ({ option, i }));
  return (
    <div className="exam-shell question-preview" aria-label="كما يراه الطالب">
      <div className="question-panel">
        <section className="question-card">
          <header className="question-toolbar">
            <span>
              السؤال <bdi dir="ltr">1 / 20</bdi>
            </span>
          </header>
          <div className="question-body">
            <h2>{q.title.trim() || '...'}</h2>
            <p className="answer-instruction">
              {q.type === 'multi_select' ? 'حدد كل الإجابات الصحيحة' : 'اختر إجابة واحدة'}
            </p>
            <fieldset className="answer-options" disabled>
              <legend className="sr-only">خيارات السؤال</legend>
              {options.map(({ option, i }) => {
                const correct = q.correctAnswers.includes(i);
                return (
                  <AnswerOption
                    key={i}
                    name={`preview-${q.id}`}
                    type={q.type}
                    index={i}
                    text={option.trim() || '...'}
                    checked={false}
                    readOnly
                    state={correct ? 'correct' : ''}
                    result={correct ? 'correct' : null}
                  />
                );
              })}
            </fieldset>
            <AnswerFeedback status="correct" explanation={q.answerExplanation.trim() || '...'}>
              <button
                type="button"
                className="source-page-chip"
                onClick={() => onOpenSource(q.pdfPage)}
              >
                <Icon name="book" size={16} />
                افتح الصفحة <bdi dir="ltr">{q.pdfPage}</bdi>
              </button>
            </AnswerFeedback>
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminQuestionEditor({
  draft,
  book,
  busy,
  onSave,
  onClose,
}: {
  draft: CompetitionQuestion;
  book: BookVersion;
  busy: boolean;
  onSave: (question: CompetitionQuestion) => Promise<unknown>;
  onClose: () => void;
}) {
  const [q, setQ] = useState(draft);
  const [viewerPage, setViewerPage] = useState(draft.pdfPage);
  const checks = questionChecks(q, book);
  const blocked = questionBlocked(checks);
  const hint = derivedHint(q.pdfPage);
  const set = (patch: Partial<CompetitionQuestion>) => setQ({ ...q, ...patch });
  return (
    <form
      className="question-editor"
      aria-label={`تحرير السؤال ${q.id}`}
      onSubmit={async (event) => {
        event.preventDefault();
        if (blocked) return;
        // The hint is derived: always the source page and the one before it.
        const result = await onSave(withDerivedHint(q));
        if (result !== false) onClose();
      }}
    >
      <h3>السؤال {q.id}</h3>
      <div className="editor-split">
        <div className="editor-fields">
          <label>
            المرحلة
            <select value={q.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>
              {stageKeys.map((s) => (
                <option key={s} value={s}>
                  {stageNames[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            النص
            <textarea required value={q.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label>
            نوع السؤال
            <select
              value={q.type}
              onChange={(e) =>
                set({
                  type: e.target.value as CompetitionQuestion['type'],
                  correctAnswers: [q.correctAnswers[0] ?? 0],
                })
              }
            >
              <option value="single_choice">اختيار واحد</option>
              <option value="multi_select">اختيارات متعددة</option>
            </select>
          </label>
          {q.options.map((o, i) => (
            <div className="editor-option" key={i}>
              <label>
                الخيار {i + 1}
                <input
                  required
                  value={o}
                  onChange={(e) =>
                    set({ options: q.options.map((v, j) => (j === i ? e.target.value : v)) })
                  }
                />
              </label>
              <label>
                <input
                  type={q.type === 'multi_select' ? 'checkbox' : 'radio'}
                  name="correct-key"
                  checked={q.correctAnswers.includes(i)}
                  onChange={() =>
                    set({
                      correctAnswers:
                        q.type === 'single_choice'
                          ? [i]
                          : q.correctAnswers.includes(i)
                            ? q.correctAnswers.filter((v) => v !== i)
                            : [...q.correctAnswers, i].sort((a, b) => a - b),
                    })
                  }
                />{' '}
                إجابة صحيحة
              </label>
            </div>
          ))}
          <div className="field-grid">
            <label>
              صفحة المصدر (PDF)
              <input
                type="number"
                required
                min={1}
                max={book.pageCount}
                value={q.pdfPage}
                onChange={(e) => {
                  set({ pdfPage: Number(e.target.value) });
                  setViewerPage(Math.min(book.pageCount, Math.max(1, Number(e.target.value) || 1)));
                }}
              />
            </label>
            <label>
              الصفحة المطبوعة
              <input
                type="number"
                required
                min={1}
                max={book.pageCount}
                value={q.printedPage}
                onChange={(e) => set({ printedPage: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="field-hint" data-testid="hint-derived">
            يعرض التلميح تلقائيًا الصفحة <bdi dir="ltr">{hint.hintPdfPageStart}</bdi> والصفحة{' '}
            <bdi dir="ltr">{hint.hintPdfPageEnd}</bdi>.
          </p>
          <label>
            المحور
            <input value={q.topic} onChange={(e) => set({ topic: e.target.value })} />
          </label>
          <label>
            الصعوبة
            <select
              value={q.difficulty}
              onChange={(e) =>
                set({ difficulty: e.target.value as CompetitionQuestion['difficulty'] })
              }
            >
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>
          </label>
          <label>
            شاهد المصدر، للجنة فقط
            <textarea
              required={!q.fixture}
              value={q.sourceExcerpt}
              onChange={(e) => set({ sourceExcerpt: e.target.value })}
            />
          </label>
          <label>
            التفسير بعد التثبيت في الوضع التعليمي
            <textarea
              value={q.answerExplanation}
              onChange={(e) => set({ answerExplanation: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={q.active}
              onChange={(e) => set({ active: e.target.checked })}
            />{' '}
            سؤال نشط
          </label>
        </div>
        <div className="editor-side">
          <h4>كما يراه الطالب</h4>
          <QuestionPreview q={q} onOpenSource={setViewerPage} />
          <h4>صفحة المصدر</h4>
          <AdminPageViewer
            book={book}
            page={viewerPage}
            onPageChange={setViewerPage}
            sourcePage={q.pdfPage}
            onUse={(page) => set({ pdfPage: page })}
          />
        </div>
      </div>
      <ul className="check-chips" aria-label="فحص السؤال">
        {checks.map((check) => (
          <li key={check.id} className={check.ok ? 'ok' : 'bad'}>
            <Icon name={check.ok ? 'check' : 'warn'} size={14} />
            {check.label}
          </li>
        ))}
      </ul>
      <div className="button-row">
        <button className="button primary" disabled={busy || blocked}>
          حفظ مسودة إصدار جديد
        </button>
        <button type="button" className="button outline" onClick={onClose}>
          إغلاق المحرر
        </button>
      </div>
    </form>
  );
}
