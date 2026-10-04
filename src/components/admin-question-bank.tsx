'use client';
import { useState } from 'react';
import { BookReader } from './book-reader';
import {
  stageKeys,
  stageNames,
  type BookVersion,
  type CompetitionQuestion,
  type Stage,
} from '@/lib/competition-domain';
type Mutation = (path: string, body: unknown, message: string) => Promise<unknown>;
export function AdminQuestionBank({
  questions,
  book,
  history,
  busy,
  mutate,
  canApprove,
}: {
  questions: CompetitionQuestion[];
  book: BookVersion;
  history: Record<string, unknown>[];
  busy: boolean;
  mutate: Mutation;
  canApprove: boolean;
}) {
  const [stage, setStage] = useState('');
  const [approval, setApproval] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [editing, setEditing] = useState<CompetitionQuestion | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const filtered = questions.filter(
    (q) =>
      (!stage || q.stage === stage) &&
      (!approval || String(q.approved) === approval) &&
      (!topic || q.topic.includes(topic)) &&
      (!difficulty || q.difficulty === difficulty),
  );
  function create() {
    setEditing({
      id: crypto.randomUUID(),
      stage: 'middle',
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
  return (
    <section className="admin-panel">
      <h2>بنك الأسئلة وإصداراته</h2>
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
      <button className="button primary" onClick={create}>
        إضافة سؤال
      </button>
      {editing && (
        <form
          className="question-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await mutate(
              'admin/question',
              editing,
              'تم إنشاء إصدار مسودة يتطلب الاعتماد.',
            );
            if (result !== false) setEditing(null);
          }}
        >
          <h3>السؤال {editing.id}</h3>
          <label>
            المرحلة
            <select
              value={editing.stage}
              onChange={(e) => setEditing({ ...editing, stage: e.target.value as Stage })}
            >
              {stageKeys.map((s) => (
                <option key={s} value={s}>
                  {stageNames[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            النص
            <textarea
              required
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
          </label>
          <label>
            نوع السؤال
            <select
              value={editing.type}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  type: e.target.value as CompetitionQuestion['type'],
                  correctAnswers: [editing.correctAnswers[0]],
                })
              }
            >
              <option value="single_choice">اختيار واحد</option>
              <option value="multi_select">اختيارات متعددة</option>
            </select>
          </label>
          {editing.options.map((o, i) => (
            <div className="editor-option" key={i}>
              <label>
                الخيار {i + 1}
                <input
                  required
                  value={o}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      options: editing.options.map((v, j) => (j === i ? e.target.value : v)),
                    })
                  }
                />
              </label>
              <label>
                <input
                  type={editing.type === 'multi_select' ? 'checkbox' : 'radio'}
                  name="correct-key"
                  checked={editing.correctAnswers.includes(i)}
                  onChange={() =>
                    setEditing({
                      ...editing,
                      correctAnswers:
                        editing.type === 'single_choice'
                          ? [i]
                          : editing.correctAnswers.includes(i)
                            ? editing.correctAnswers.filter((v) => v !== i)
                            : [...editing.correctAnswers, i],
                    })
                  }
                />{' '}
                إجابة صحيحة
              </label>
            </div>
          ))}
          <div className="field-grid">
            {(
              [
                ['pdfPage', 'صفحة PDF'],
                ['printedPage', 'الصفحة المطبوعة'],
                ['hintPdfPageStart', 'بداية التلميح PDF'],
                ['hintPdfPageEnd', 'نهاية التلميح PDF'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  required
                  min={1}
                  max={book.pageCount}
                  value={editing[key]}
                  onChange={(e) => setEditing({ ...editing, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <label>
            المحور
            <input
              value={editing.topic}
              onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
            />
          </label>
          <label>
            الصعوبة
            <select
              value={editing.difficulty}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  difficulty: e.target.value as CompetitionQuestion['difficulty'],
                })
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
              required={!editing.fixture}
              value={editing.sourceExcerpt}
              onChange={(e) => setEditing({ ...editing, sourceExcerpt: e.target.value })}
            />
          </label>
          <label>
            التفسير بعد التثبيت في الوضع التعليمي
            <textarea
              value={editing.answerExplanation}
              onChange={(e) => setEditing({ ...editing, answerExplanation: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />{' '}
            سؤال نشط
          </label>
          <div className="button-row">
            <button className="button primary" disabled={busy}>
              حفظ مسودة إصدار جديد
            </button>
            <button
              type="button"
              className="button outline"
              onClick={() => setPreview(editing.pdfPage)}
            >
              معاينة الصفحة المرتبطة
            </button>
            <button type="button" className="button outline" onClick={() => setEditing(null)}>
              إغلاق المحرر
            </button>
          </div>
        </form>
      )}
      {preview !== null && (
        <div className="admin-book-preview">
          <BookReader
            book={book}
            page={preview}
            onPageChange={setPreview}
            onClose={() => setPreview(null)}
          />
        </div>
      )}
      <div className="question-admin-list">
        {filtered.map((q) => (
          <article className="question-admin-card" key={q.id}>
            <span>
              {stageNames[q.stage]} · v{q.version} · {q.approved ? 'معتمد' : 'مسودة'} ·{' '}
              {q.active ? 'نشط' : 'غير نشط'}
            </span>
            <h3>{q.title}</h3>
            <p>
              مطبوعة {q.printedPage} · PDF {q.pdfPage} · تلميح {q.hintPdfPageStart}–
              {q.hintPdfPageEnd}
            </p>
            <div className="button-row">
              <button className="button outline" onClick={() => setEditing(q)}>
                تحرير
              </button>
              {canApprove && (
                <button
                  className="button outline"
                  disabled={busy || q.approved}
                  onClick={() =>
                    mutate(
                      'admin/question',
                      { id: q.id, version: q.version, approve: true },
                      'اعتمدت اللجنة الإصدار.',
                    )
                  }
                >
                  اعتماد اللجنة
                </button>
              )}
              <button className="text-link" onClick={() => setPreview(q.pdfPage)}>
                المصدر
              </button>
            </div>
            <details>
              <summary>تاريخ الإصدارات</summary>
              {history
                .filter((h) => h.question_id === q.id)
                .map((h) => (
                  <div key={String(h.version)}>
                    <p>
                      الإصدار {String(h.version)} · {String(h.created_at)}
                    </p>
                    <pre className="version-history">{JSON.stringify(h.body, null, 2)}</pre>
                  </div>
                ))}
            </details>
          </article>
        ))}
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
export function QuestionCoverage({
  questions,
  book,
}: {
  questions: CompetitionQuestion[];
  book: BookVersion;
}) {
  const [stage, setStage] = useState('');
  const rows = questions.filter((q) => q.active && (!stage || q.stage === stage));
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
        العدد يشمل المسودات النشطة. الصفحات الفارغة تظهر بصفر؛ راجع التركيز الكبير قبل اعتماد
        النسخة.
      </p>
      <div className="coverage-grid">
        {Array.from({ length: book.pageCount }, (_, i) => {
          const page = i + 1;
          const used = rows.filter((q) => q.pdfPage === page);
          return (
            <div
              key={page}
              className={`coverage-cell ${used.length > 2 ? 'crowded' : used.length ? 'covered' : ''}`}
            >
              <strong>PDF {page}</strong>
              <span>{used.length} أسئلة</span>
              {used.map((q) => (
                <small key={q.id}>
                  {stageNames[q.stage]} · {q.id}
                </small>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
