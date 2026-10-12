'use client';
import { useState } from 'react';
import {
  stageKeys,
  stageNames,
  questionCount,
  hintTarget,
  type Competition,
  type BookVersion,
  type CompetitionQuestion,
  type Stage,
} from '@/lib/competition-domain';
import { questionBlocked, questionChecks, withDerivedHint } from '@/lib/admin-workshop';
import { AdminPageViewer } from './admin-page-viewer';
import { AnswerFeedback, AnswerOption } from './question-card-parts';
import { Icon } from './ui';

// The student's question card, read only: the same rows and feedback block the exam renders.
export function QuestionPreview({
  q,
  onOpenSource,
  count = 20,
}: {
  q: CompetitionQuestion;
  onOpenSource: (page: number) => void;
  count?: number;
}) {
  const options = q.options.map((option, i) => ({ option, i }));
  return (
    <div className="exam-shell question-preview" aria-label="كما يراه الطالب">
      <div className="question-panel">
        <section className="question-card">
          <header className="question-toolbar">
            <span>
              السؤال <bdi dir="ltr">1 / {count}</bdi>
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
              {q.pdfPage !== null && (
                <button
                  type="button"
                  className="source-page-chip"
                  onClick={() => q.pdfPage !== null && onOpenSource(q.pdfPage)}
                >
                  <Icon name="book" size={16} />
                  افتح الصفحة <bdi dir="ltr">{q.pdfPage}</bdi>
                </button>
              )}
              {q.sourceKind === 'official' && <span>مصدر رسمي مستقل عن الكتاب</span>}
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
  campaign,
}: {
  draft: CompetitionQuestion;
  book: BookVersion;
  busy: boolean;
  onSave: (question: CompetitionQuestion) => Promise<unknown>;
  onClose: () => void;
  campaign?: Competition;
}) {
  const [q, setQ] = useState(draft);
  const [viewerPage, setViewerPage] = useState(draft.pdfPage ?? 1);
  const checks = questionChecks(q, book);
  const blocked = questionBlocked(checks);
  const target = hintTarget(q);
  const hint = { hintPdfPageStart: target?.[0], hintPdfPageEnd: target?.[1] };
  const set = (patch: Partial<CompetitionQuestion>) => setQ({ ...q, ...patch });
  return (
    <form
      className="question-editor"
      aria-label={`تحرير السؤال ${q.id}`}
      onSubmit={async (event) => {
        event.preventDefault();
        if (blocked) return;
        // The hint follows the recorded range, or the source page and its predecessor.
        const result = await onSave(withDerivedHint(q));
        if (result !== false) onClose();
      }}
    >
      <h3>السؤال {q.id}</h3>
      {q.sourceRow && <p className="field-hint">مرجع الملف الأصلي: {q.sourceRow}</p>}
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
          <label>
            نوع المصدر
            <select
              value={q.sourceKind ?? 'book'}
              onChange={(e) =>
                set({
                  sourceKind: e.target.value as 'book' | 'official',
                  sourceVerified: false,
                  ...(e.target.value === 'official'
                    ? {
                        pdfPage: null,
                        pdfPageEnd: undefined,
                        printedPage: null,
                        printedPageEnd: undefined,
                        hintPdfPageStart: null,
                        hintPdfPageEnd: null,
                      }
                    : {}),
                })
              }
            >
              <option value="book">الكتاب</option>
              <option value="official">مصدر رسمي</option>
            </select>
          </label>
          {q.sourceKind === 'official' && (
            <label>
              رابط المصدر الرسمي
              <input
                type="url"
                value={q.sourceUrl ?? ''}
                onChange={(e) => set({ sourceUrl: e.target.value })}
              />
            </label>
          )}
          {q.sourceKind !== 'official' && (
            <div className="field-grid">
              <label>
                صفحة المصدر (PDF)
                <input
                  type="number"
                  required={q.sourceVerified !== false}
                  min={1}
                  max={book.pageCount}
                  value={q.pdfPage ?? ''}
                  onChange={(e) => {
                    set({ pdfPage: e.target.value ? Number(e.target.value) : null });
                    setViewerPage(
                      Math.min(book.pageCount, Math.max(1, Number(e.target.value) || 1)),
                    );
                  }}
                />
              </label>
              <label>
                الصفحة المطبوعة
                <input
                  type="number"
                  required={q.sourceVerified !== false && q.pdfPage !== 1}
                  min={1}
                  max={book.pageCount}
                  value={q.printedPage ?? ''}
                  onChange={(e) =>
                    set({ printedPage: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </label>
              <label>
                نهاية النطاق المطبوع (اختياري)
                <input
                  type="number"
                  min={q.printedPage ?? 1}
                  max={book.pageCount}
                  value={q.printedPageEnd ?? ''}
                  onChange={(e) =>
                    set({ printedPageEnd: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </label>
              <label>
                نهاية نطاق PDF (اختياري)
                <input
                  type="number"
                  min={q.pdfPage ?? 1}
                  max={book.pageCount - 1}
                  value={q.pdfPageEnd ?? ''}
                  onChange={(e) =>
                    set({ pdfPageEnd: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </label>
            </div>
          )}
          {q.sourceKind !== 'official' && (
            <p className="field-hint" data-testid="hint-derived">
              يعرض التلميح تلقائيًا الصفحة <bdi dir="ltr">{hint.hintPdfPageStart}</bdi> والصفحة{' '}
              <bdi dir="ltr">{hint.hintPdfPageEnd}</bdi>.
            </p>
          )}
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
              required={!q.fixture && q.sourceVerified !== false}
              value={q.sourceExcerpt}
              onChange={(e) => set({ sourceExcerpt: e.target.value })}
            />
          </label>
          <label>
            التوضيح بعد الإرسال النهائي
            <textarea
              value={q.answerExplanation}
              onChange={(e) => set({ answerExplanation: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={q.sourceVerified === true}
              onChange={(e) => set({ sourceVerified: e.target.checked })}
            />{' '}
            راجعت النص والإجابة والمصدر والصفحات؛ صالح للاعتماد
          </label>
          <label>
            <input
              type="checkbox"
              checked={q.preserveOptionOrder ?? false}
              onChange={(e) => set({ preserveOptionOrder: e.target.checked })}
            />{' '}
            الحفاظ على ترتيب الخيارات الأصلي
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
          <QuestionPreview
            q={q}
            count={questionCount(campaign, q.stage)}
            onOpenSource={setViewerPage}
          />
          <h4>صفحة المصدر</h4>
          {q.sourceKind !== 'official' && (
            <AdminPageViewer
              book={book}
              page={viewerPage}
              onPageChange={setViewerPage}
              sourcePage={q.pdfPage ?? 1}
              onUse={(page) => set({ pdfPage: page })}
            />
          )}
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
