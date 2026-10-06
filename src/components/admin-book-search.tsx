'use client';
import { useEffect, useMemo, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { indexBook, searchIndex, type BookIndex } from '@/lib/book-search';
import { Icon } from './ui';

const idle = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(() => resolve(), { timeout: 150 });
    else setTimeout(resolve, 0);
  });

// Admin only. Builds an in-memory text index once per opened PDF (never persisted) in idle time.
export default function AdminBookSearch({
  pdf,
  pageCount,
  sourcePage,
  onJump,
  onUse,
}: {
  pdf: PDFDocumentProxy;
  pageCount: number;
  sourcePage: number;
  onJump: (page: number) => void;
  onUse: (page: number) => void;
}) {
  const [index, setIndex] = useState<BookIndex | null>(null);
  const [done, setDone] = useState(0);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setIndex(null);
    setDone(0);
    setFailed(false);
    indexBook(
      pageCount,
      async (n) => {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      },
      { onProgress: setDone, idle, signal: controller.signal },
    )
      .then((built) => {
        if (!controller.signal.aborted) setIndex(built);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [pdf, pageCount]);
  const hits = useMemo(() => (index ? searchIndex(index, query) : []), [index, query]);
  if (failed)
    return (
      <p className="search-unavailable" role="alert">
        تعذّر تجهيز البحث في هذا الكتاب.
      </p>
    );
  if (!index)
    return (
      <div className="search-progress" role="status">
        <span>
          جارٍ تجهيز البحث…{' '}
          <bdi dir="ltr">
            {done} / {pageCount}
          </bdi>
        </span>
        <progress max={pageCount} value={done} aria-label="تقدم تجهيز البحث" />
      </div>
    );
  if (index.availability === 'unavailable')
    return (
      <div className="search-unavailable" role="status" data-search="unavailable">
        <strong>
          <Icon name="info" size={18} /> البحث غير متاح لهذا الكتاب
        </strong>
        <p>
          نص صفحات الكتاب في ملف PDF غير قابل للاستخراج آليًا ({index.usablePages} من{' '}
          {index.pages.length} صفحة فقط قابلة للبحث). استخدم رقم الصفحة أو المحتويات للوصول إلى
          الصفحة، وراجع الكتاب بصريًا.
        </p>
      </div>
    );
  return (
    <div className="book-search" data-search="available">
      <label>
        <span className="sr-only">ابحث في نص الكتاب</span>
        <input
          type="search"
          placeholder="ابحث في نص الكتاب"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {query.trim().length >= 2 && (
        <ul className="search-results" aria-live="polite">
          {hits.map((hit) => (
            <li key={hit.page}>
              <button type="button" className="search-hit" onClick={() => onJump(hit.page)}>
                <b>
                  صفحة <bdi dir="ltr">{hit.page}</bdi>
                </b>
                <span>
                  {hit.before}
                  <mark>{hit.match}</mark>
                  {hit.after}
                </span>
              </button>
              <button
                type="button"
                className="text-link"
                disabled={hit.page === sourcePage}
                onClick={() => {
                  onJump(hit.page);
                  onUse(hit.page);
                }}
              >
                اجعلها صفحة المصدر
              </button>
            </li>
          ))}
          {!hits.length && <li className="muted">لا توجد نتائج لهذه العبارة.</li>}
        </ul>
      )}
    </div>
  );
}
