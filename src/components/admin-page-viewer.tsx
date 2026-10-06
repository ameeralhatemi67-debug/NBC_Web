'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import type { BookVersion } from '@/lib/competition-domain';
import { useVerifiedBook } from './use-verified-book';
import { Icon } from './ui';

// Admin-only. The in-book search is a separate chunk loaded on request, and nothing the
// participant screens import can reach it.
const AdminBookSearch = dynamic(() => import('./admin-book-search'), {
  ssr: false,
  loading: () => <p className="muted">جارٍ تحميل البحث…</p>,
});

// A single-page viewer for the question editor: step through the book and pick the source page.
export function AdminPageViewer({
  book,
  page,
  onPageChange,
  sourcePage,
  onUse,
}: {
  book: BookVersion;
  page: number;
  onPageChange: (page: number) => void;
  sourcePage: number;
  onUse: (page: number) => void;
}) {
  const { pdf, error } = useVerifiedBook(book);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [searching, setSearching] = useState(false);
  const clamp = (value: number) => Math.min(book.pageCount, Math.max(1, Math.round(value) || 1));
  useEffect(() => {
    setPainted(false);
    setRenderError('');
    if (!pdf) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    (async () => {
      const target = await pdf.getPage(clamp(page));
      if (cancelled || !canvas.current) return;
      const base = target.getViewport({ scale: 1 });
      const density = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.min(520, canvas.current.parentElement?.clientWidth || 360);
      const viewport = target.getViewport({ scale: (width * density) / base.width });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      canvas.current.style.aspectRatio = `${base.width} / ${base.height}`;
      task = target.render({ canvas: canvas.current, viewport });
      await task.promise;
      if (!cancelled) setPainted(true);
    })().catch((e) => {
      if (!cancelled && e.name !== 'RenderingCancelledException')
        setRenderError('تعذّر عرض الصفحة.');
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, page]);
  const current = clamp(page);
  return (
    <div className="page-viewer">
      <div className="page-stepper" role="group" aria-label="صفحة المصدر في الكتاب">
        <button
          type="button"
          className="icon-button"
          aria-label="الصفحة السابقة"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <Icon name="arrow" size={18} />
        </button>
        <label className="page-stepper-input">
          <span className="sr-only">رقم الصفحة</span>
          <input
            type="number"
            min={1}
            max={book.pageCount}
            value={current}
            onChange={(event) => onPageChange(clamp(Number(event.target.value)))}
          />
          <bdi dir="ltr">/ {book.pageCount}</bdi>
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label="الصفحة التالية"
          disabled={current >= book.pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <span className="flip">
            <Icon name="arrow" size={18} />
          </span>
        </button>
        <button
          type="button"
          className="button outline use-page"
          disabled={current === sourcePage}
          onClick={() => onUse(current)}
        >
          {current === sourcePage ? 'هذه صفحة المصدر' : 'اجعلها صفحة المصدر'}
        </button>
      </div>
      <div className="page-viewer-sheet" aria-busy={!painted && !error && !renderError}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`صفحة PDF ${current}`}
          hidden={!painted}
          style={{ width: '100%', height: 'auto' }}
        />
        {!painted && (
          <p className="muted" role={error || renderError ? 'alert' : 'status'}>
            {error || renderError || 'جارٍ عرض الصفحة…'}
          </p>
        )}
      </div>
      <details
        className="book-search-disclosure"
        onToggle={(event) => setSearching(event.currentTarget.open)}
      >
        <summary>
          <Icon name="search" size={16} /> بحث في الكتاب (للجنة فقط)
        </summary>
        {searching && pdf && (
          <AdminBookSearch
            pdf={pdf}
            pageCount={book.pageCount}
            sourcePage={sourcePage}
            onJump={onPageChange}
            onUse={onUse}
          />
        )}
        {searching && !pdf && <p className="muted">الكتاب قيد التحميل…</p>}
      </details>
    </div>
  );
}
