'use client';
import { useEffect, useState } from 'react';
import { defaultSiteContent, siteContentLimits, type SiteContent } from '@/lib/site-content';
import { api, ErrorMessage, Loading } from './ui';

function Reorder({
  index,
  length,
  move,
  remove,
}: {
  index: number;
  length: number;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
}) {
  return (
    <span className="reorder">
      <button
        type="button"
        className="text-link"
        disabled={index === 0}
        onClick={() => move(index, index - 1)}
      >
        أعلى
      </button>
      <button
        type="button"
        className="text-link"
        disabled={index === length - 1}
        onClick={() => move(index, index + 1)}
      >
        أسفل
      </button>
      <button type="button" className="text-link" onClick={() => remove(index)}>
        حذف
      </button>
    </span>
  );
}
function swap<T>(items: T[], from: number, to: number) {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// Public wording: home page, book page topics, FAQ and the participation rules.
export function AdminContent() {
  const [saved, setSaved] = useState<SiteContent | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // Typed as lines; the saved list is the non-empty lines.
  const [topicsText, setTopicsText] = useState('');
  useEffect(() => {
    api<SiteContent>('admin/site-content')
      .then((content) => {
        setSaved(content);
        setDraft(structuredClone(content));
        setTopicsText(content.bookTopics.join('\n'));
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  if (!draft || !saved) return error ? <ErrorMessage message={error} /> : <Loading />;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const l = siteContentLimits;
  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) =>
    setDraft({ ...draft, [key]: value });
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api<SiteContent>('admin/site-content', draft);
      setSaved(next);
      setDraft(structuredClone(next));
      setNotice('حُفظ المحتوى. تظهر التغييرات في الموقع فورًا.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel content-admin">
      <p className="fine-print">
        نص عادي فقط. يظهر في الصفحة الرئيسية وصفحة الكتاب وصفحة الشروط. اترك أي قسم قائمته فارغة
        لإخفائه، أو استعد النص الافتراضي في أي وقت.
      </p>
      <ErrorMessage message={error} />
      {notice && (
        <div role="status" className="success-message">
          {notice}
        </div>
      )}
      <section className="launch-card">
        <h3>الصفحة الرئيسية</h3>
        <label>
          النص التعريفي تحت العنوان
          <textarea
            rows={2}
            maxLength={l.heroIntro}
            value={draft.heroIntro}
            onChange={(e) => set('heroIntro', e.target.value)}
          />
        </label>
        <label>
          التعريف بالمسابقة: الفقرة الأولى
          <textarea
            rows={4}
            maxLength={l.paragraph}
            value={draft.aboutIntro}
            onChange={(e) => set('aboutIntro', e.target.value)}
          />
        </label>
        <label>
          الفقرة الثانية (اختيارية)
          <textarea
            rows={4}
            maxLength={l.paragraph}
            value={draft.aboutDetails}
            onChange={(e) => set('aboutDetails', e.target.value)}
          />
        </label>
      </section>
      <section className="launch-card">
        <h3>محاور الكتاب</h3>
        <p className="field-hint">محور في كل سطر. تظهر في صفحة الكتاب.</p>
        <textarea
          rows={6}
          aria-label="محاور الكتاب"
          value={topicsText}
          onChange={(e) => {
            setTopicsText(e.target.value);
            set(
              'bookTopics',
              e.target.value
                .split('\n')
                .map((t) => t.trim())
                .filter(Boolean),
            );
          }}
        />
      </section>
      <section className="launch-card">
        <h3>الأسئلة الشائعة ({draft.faqs.length})</h3>
        <ol className="editable-list">
          {draft.faqs.map((faq, i) => (
            <li key={i}>
              <label>
                السؤال
                <input
                  value={faq.q}
                  maxLength={l.question}
                  onChange={(e) =>
                    set(
                      'faqs',
                      draft.faqs.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)),
                    )
                  }
                />
              </label>
              <label>
                الجواب
                <textarea
                  rows={3}
                  maxLength={l.answer}
                  value={faq.a}
                  onChange={(e) =>
                    set(
                      'faqs',
                      draft.faqs.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)),
                    )
                  }
                />
              </label>
              <Reorder
                index={i}
                length={draft.faqs.length}
                move={(a, b) => set('faqs', swap(draft.faqs, a, b))}
                remove={(n) =>
                  set(
                    'faqs',
                    draft.faqs.filter((_, j) => j !== n),
                  )
                }
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="button outline"
          disabled={draft.faqs.length >= l.faqs}
          onClick={() => set('faqs', [...draft.faqs, { q: '', a: '' }])}
        >
          إضافة سؤال
        </button>
      </section>
      <section className="launch-card">
        <h3>شروط وضوابط المشاركة ({draft.rules.length})</h3>
        <ol className="editable-list">
          {draft.rules.map((rule, i) => (
            <li key={i}>
              <textarea
                rows={2}
                aria-label={`الشرط ${i + 1}`}
                maxLength={l.rule}
                value={rule}
                onChange={(e) =>
                  set(
                    'rules',
                    draft.rules.map((r, j) => (j === i ? e.target.value : r)),
                  )
                }
              />
              <Reorder
                index={i}
                length={draft.rules.length}
                move={(a, b) => set('rules', swap(draft.rules, a, b))}
                remove={(n) =>
                  set(
                    'rules',
                    draft.rules.filter((_, j) => j !== n),
                  )
                }
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="button outline"
          disabled={draft.rules.length >= l.rules}
          onClick={() => set('rules', [...draft.rules, ''])}
        >
          إضافة شرط
        </button>
      </section>
      <div className="launch-actions">
        <button
          type="button"
          className="button primary"
          disabled={busy || !changed}
          onClick={() => void save()}
        >
          حفظ المحتوى
        </button>
        <button
          type="button"
          className="button outline"
          disabled={busy}
          onClick={() =>
            setDraft({ ...structuredClone(defaultSiteContent), version: saved.version })
          }
        >
          استعادة النص الافتراضي
        </button>
        {changed && (
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => {
              setDraft(structuredClone(saved));
              setTopicsText(saved.bookTopics.join('\n'));
            }}
          >
            تجاهل التغييرات
          </button>
        )}
      </div>
    </section>
  );
}
