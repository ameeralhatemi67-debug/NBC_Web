'use client';
import { useEffect, useRef, useState } from 'react';
import {
  stageKeys,
  stageNames,
  type BookVersion,
  type CompetitionQuestion,
  type Stage,
} from '@/lib/competition-domain';
import { approvable, changedFields, coverageDensity, coverageSummary } from '@/lib/admin-workshop';
import { QUESTIONS_PER_STAGE, stageReadiness } from '@/lib/admin-launch';
import { riyadhDateTime } from '@/lib/format';
import { AdminQuestionEditor } from './admin-question-editor';
import { Icon } from './ui';
type Mutation = (path: string, body: unknown, message: string) => Promise<unknown>;
type VersionRow = Record<string, unknown>;

function RowMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="row-menu" ref={holder}>
      <button
        type="button"
        className="icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div role="menu" className="row-menu-list">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function AdminQuestionBank({
  questions,
  book,
  history,
  busy,
  mutate,
  canApprove,
  initialStage = '',
}: {
  questions: CompetitionQuestion[];
  book: BookVersion;
  history: VersionRow[];
  busy: boolean;
  mutate: Mutation;
  canApprove: boolean;
  initialStage?: Stage | '';
}) {
  const [stage, setStage] = useState<string>(initialStage);
  const [approval, setApproval] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [editing, setEditing] = useState<CompetitionQuestion | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shownHistory, setShownHistory] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  useEffect(() => setStage(initialStage), [initialStage]);
  const readiness = stageReadiness(questions, book);
  const filtered = questions.filter(
    (q) =>
      (!stage || q.stage === stage) &&
      (!approval || String(q.approved) === approval) &&
      (!topic || q.topic.includes(topic)) &&
      (!difficulty || q.difficulty === difficulty),
  );
  const pending = approvable(filtered, selected);
  function create() {
    setEditing({
      id: crypto.randomUUID(),
      stage: (stage as Stage) || 'middle',
      title: '',
      type: 'single_choice',
      options: ['', '', '', ''],
      correct: 0,
      correctAnswers: [0],
      source: '',
      version: 0,
      approved: false,
      active: true,
      pdfPage: 1,
      printedPage: 1,
      hintPdfPageStart: 1,
      hintPdfPageEnd: 1,
      answerExplanation: '',
      topic: '',
      difficulty: 'easy',
      bookVersionId: book.id,
      sourceExcerpt: '',
    });
  }
  const approveOne = (q: CompetitionQuestion) =>
    mutate(
      'admin/question',
      { id: q.id, version: q.version, approve: true },
      'اعتمدت اللجنة الإصدار.',
    );
  // Same pattern as the JSON import: stop at the first error; earlier approvals stand.
  async function approveSelected() {
    setBulkError('');
    for (const q of pending) {
      if ((await approveOne(q)) === false) {
        setBulkError(
          `توقف الاعتماد عند السؤال ${q.id}. الأسئلة السابقة اعتُمدت؛ راجع الخطأ ثم أعد المحاولة.`,
        );
        return;
      }
    }
    setSelected(new Set());
  }
  async function importBank() {
    setImportError('');
    try {
      const rows = JSON.parse(importText);
      if (!Array.isArray(rows) || rows.length > 60)
        throw new Error('أدخل مصفوفة لا تتجاوز 60 سؤالًا.');
      for (const row of rows) {
        const existing = questions.find((q) => q.id === row.id);
        const result = await mutate(
          'admin/question',
          { ...row, version: existing?.version ?? 0, approved: false },
          'تم استيراد مسودة.',
        );
        if (result === false)
          throw new Error(
            'توقف الاستيراد عند أول خطأ. المسودات السابقة محفوظة؛ راجعها ثم أعد المحاولة.',
          );
      }
      setImportText('');
    } catch (e) {
      setImportError((e as Error).message);
    }
  }
  const allSelected = filtered.length > 0 && filtered.every((q) => selected.has(q.id));
  return (
    <section className="admin-panel question-workshop">
      <h2>بنك الأسئلة وإصداراته</h2>
      <div className="stage-counters" aria-label="تقدم بنك الأسئلة">
        {readiness.map((s) => (
          <div key={s.stage} className={s.ok ? 'ok' : ''} data-stage={s.stage}>
            <div className="stage-counter-head">
              <span>{s.name}</span>
              <b>
                <bdi dir="ltr">
                  {s.approved} / {QUESTIONS_PER_STAGE}
                </bdi>
              </b>
            </div>
            <div
              className="check-bar"
              role="progressbar"
              aria-label={s.name}
              aria-valuemin={0}
              aria-valuemax={QUESTIONS_PER_STAGE}
              aria-valuenow={s.approved}
            >
              <b style={{ width: `${Math.min(100, (s.approved / QUESTIONS_PER_STAGE) * 100)}%` }} />
            </div>
            <small>{s.ok ? 'جاهزة للاعتماد' : s.reason || `${s.drafts} مسودات نشطة`}</small>
          </div>
        ))}
      </div>
      <div className="filter-row">
        <label>
          المرحلة
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">الجميع</option>
            {stageKeys.map((s) => (
              <option key={s} value={s}>
                {stageNames[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          الاعتماد
          <select value={approval} onChange={(e) => setApproval(e.target.value)}>
            <option value="">الجميع</option>
            <option value="true">معتمد</option>
            <option value="false">مسودة</option>
          </select>
        </label>
        <label>
          المحور
          <input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <label>
          الصعوبة
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">الجميع</option>
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </label>
      </div>
      <div className="bank-toolbar">
        <button className="button primary" onClick={create}>
          إضافة سؤال
        </button>
        {canApprove && (
          <button
            className="button outline"
            disabled={busy || !pending.length}
            onClick={() => void approveSelected()}
          >
            اعتمد المحدد ({pending.length})
          </button>
        )}
        <span className="muted" role="status">
          {filtered.length} من {questions.length} سؤالًا
        </span>
      </div>
      {bulkError && (
        <p role="alert" className="error-message">
          {bulkError}
        </p>
      )}
      {editing && (
        <AdminQuestionEditor
          key={editing.id}
          draft={editing}
          book={book}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(question) =>
            mutate('admin/question', question, 'تم إنشاء إصدار مسودة يتطلب الاعتماد.')
          }
        />
      )}
      <div className={`question-list-wrap ${canApprove ? 'with-select' : ''}`}>
        <div className="q-head" aria-hidden="true">
          <span className="q-check" />
          <span>السؤال</span>
          <span>المرحلة</span>
          <span>المصدر</span>
          <span>الإصدار</span>
          <span>الحالة</span>
          <span className="q-menu" />
        </div>
        {canApprove && (
          <label className="select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(filtered.map((q) => q.id)) : new Set())
              }
            />{' '}
            تحديد كل الأسئلة المعروضة
          </label>
        )}
        <ul className="question-list">
          {filtered.map((q) => {
            const versions = history
              .filter((h) => h.question_id === q.id)
              .sort((a, b) => Number(a.version) - Number(b.version));
            return (
              <QuestionRow
                key={q.id}
                q={q}
                canApprove={canApprove}
                busy={busy}
                checked={selected.has(q.id)}
                onCheck={(on) => {
                  const next = new Set(selected);
                  if (on) next.add(q.id);
                  else next.delete(q.id);
                  setSelected(next);
                }}
                onEdit={() => setEditing(q)}
                onApprove={() => void approveOne(q)}
                historyOpen={shownHistory === q.id}
                onHistory={() => setShownHistory(shownHistory === q.id ? '' : q.id)}
                versions={versions}
              />
            );
          })}
        </ul>
        {!filtered.length && (
          <div className="empty-inline">لا توجد أسئلة مطابقة لهذه المرشحات.</div>
        )}
      </div>
      <details>
        <summary>استيراد وتصدير JSON للمراجعة</summary>
        <p>كل سؤال مستورد يصبح مسودة. راجع نتيجة كل حفظ قبل الاعتماد.</p>
        <textarea
          aria-label="بنك الأسئلة بصيغة JSON"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <p role="alert">{importError}</p>
        <button className="button outline" disabled={busy || !importText} onClick={importBank}>
          استيراد المسودات
        </button>
        <button
          className="button outline"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' }),
            );
            const a = document.createElement('a');
            a.href = url;
            a.download = 'nbc-question-bank.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          تصدير البنك للجنة
        </button>
      </details>
    </section>
  );
}

function QuestionRow({
  q,
  canApprove,
  busy,
  checked,
  onCheck,
  onEdit,
  onApprove,
  historyOpen,
  onHistory,
  versions,
}: {
  q: CompetitionQuestion;
  canApprove: boolean;
  busy: boolean;
  checked: boolean;
  onCheck: (on: boolean) => void;
  onEdit: () => void;
  onApprove: () => void;
  historyOpen: boolean;
  onHistory: () => void;
  versions: VersionRow[];
}) {
  return (
    <li data-question={q.id} className={`q-row ${q.active ? '' : 'inactive'}`}>
      <span className="q-check">
        {canApprove && (
          <input
            type="checkbox"
            aria-label={`تحديد السؤال ${q.title}`}
            checked={checked}
            disabled={q.approved || !q.active}
            onChange={(e) => onCheck(e.target.checked)}
          />
        )}
      </span>
      <span className="q-title">
        <button type="button" className="text-link" onClick={onEdit}>
          {q.title}
        </button>
      </span>
      <div className="q-meta">
        <span className="q-stage">{stageNames[q.stage].replace('المرحلة ', '')}</span>
        <span className="q-source">
          PDF <bdi dir="ltr">{q.pdfPage}</bdi>
          <small>
            مطبوعة <bdi dir="ltr">{q.printedPage}</bdi>
          </small>
        </span>
        <span className="q-version">
          <bdi dir="ltr">v{q.version}</bdi>
        </span>
        <span className="q-status">
          <span className={`status-chip ${q.approved ? 'approved' : 'draft'}`}>
            <Icon name={q.approved ? 'check' : 'clock'} size={13} />
            {q.approved ? 'معتمد' : 'مسودة'}
          </span>
          {!q.active && <span className="status-chip off">غير نشط</span>}
        </span>
      </div>
      <span className="q-menu">
        <RowMenu label={`إجراءات السؤال ${q.title}`}>
          {(close) => (
            <>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  close();
                  onEdit();
                }}
              >
                تحرير
              </button>
              {canApprove && (
                <button
                  role="menuitem"
                  type="button"
                  disabled={busy || q.approved}
                  onClick={() => {
                    close();
                    onApprove();
                  }}
                >
                  اعتماد اللجنة
                </button>
              )}
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  close();
                  onHistory();
                }}
              >
                تاريخ الإصدارات
              </button>
            </>
          )}
        </RowMenu>
      </span>
      {historyOpen && (
        <div className="q-history">
          <ol className="version-list" aria-label="تاريخ الإصدارات">
            {versions.map((v, i) => {
              const body = v.body as Record<string, unknown>;
              const previous = i > 0 ? (versions[i - 1].body as Record<string, unknown>) : null;
              return (
                <li key={String(v.version)}>
                  <strong>
                    الإصدار <bdi dir="ltr">{String(v.version)}</bdi>
                  </strong>{' '}
                  <span className="muted">
                    {v.created_at ? riyadhDateTime(String(v.created_at)) : ''}
                  </span>
                  <span className="changed-fields">
                    {changedFields(previous, body).join('، ') || 'بلا تغيير في الحقول'}
                  </span>
                  <details>
                    <summary>عرض JSON</summary>
                    <pre className="version-history">{JSON.stringify(body, null, 2)}</pre>
                  </details>
                </li>
              );
            })}
            {!versions.length && <li className="muted">لا يوجد سجل إصدارات.</li>}
          </ol>
        </div>
      )}
    </li>
  );
}

export function QuestionCoverage({
  questions,
  book,
}: {
  questions: CompetitionQuestion[];
  book: BookVersion;
}) {
  const [stage, setStage] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const cells = coverageDensity(questions, book.pageCount, stage as Stage | '');
  const summary = coverageSummary(cells);
  const rows = questions.filter(
    (q) => q.active && (!stage || q.stage === stage) && q.pdfPage === picked,
  );
  return (
    <section className="admin-panel">
      <h2>تغطية صفحات الكتاب</h2>
      <label>
        المرحلة
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">الجميع</option>
          {stageKeys.map((s) => (
            <option key={s} value={s}>
              {stageNames[s]}
            </option>
          ))}
        </select>
      </label>
      <p>
        العدد يشمل المسودات النشطة. الصفحات الفارغة بلا لون، وصفحة عليها ثلاثة أسئلة أو أكثر تظهر
        بلون التنبيه. {summary.empty} صفحة بلا أسئلة، و{summary.crowded} صفحات مزدحمة.
      </p>
      <div className="coverage-strip" role="list" aria-label="كثافة الأسئلة لكل صفحة">
        {cells.map((cell) => (
          <button
            key={cell.page}
            type="button"
            role="listitem"
            className={`coverage-cell-strip level-${cell.level} ${picked === cell.page ? 'picked' : ''}`}
            aria-label={`صفحة ${cell.page}: ${cell.count} أسئلة`}
            aria-pressed={picked === cell.page}
            title={`صفحة ${cell.page}: ${cell.count}`}
            onClick={() => setPicked(picked === cell.page ? null : cell.page)}
          />
        ))}
      </div>
      <div className="coverage-legend" aria-hidden="true">
        <span>
          <i className="level-0" /> بلا أسئلة
        </span>
        <span>
          <i className="level-1" /> سؤال
        </span>
        <span>
          <i className="level-2" /> سؤالان
        </span>
        <span>
          <i className="level-3" /> ثلاثة أو أكثر
        </span>
      </div>
      {picked !== null && (
        <div className="coverage-detail" role="status">
          <h3>
            صفحة PDF <bdi dir="ltr">{picked}</bdi>
          </h3>
          {rows.length ? (
            <ul>
              {rows.map((q) => (
                <li key={q.id}>
                  {stageNames[q.stage]} · {q.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">لا توجد أسئلة نشطة على هذه الصفحة.</p>
          )}
        </div>
      )}
    </section>
  );
}
