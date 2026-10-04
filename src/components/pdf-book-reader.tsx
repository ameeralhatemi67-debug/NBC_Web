'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { BookVersion } from '@/lib/competition-domain';
import { Icon } from './ui';
const defaultBook: BookVersion = {
  id: 'national-belonging-ec07ef57',
  title: 'الانتماء واللحمة الوطنية',
  url: '/books/ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd.pdf',
  sha256: 'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd',
  pageCount: 66,
  approved: false,
};
export function BookReader({
  book = defaultBook,
  page = 1,
  onPageChange,
  embedded = false,
  onClose,
}: {
  book?: BookVersion;
  page?: number;
  onPageChange?: (page: number) => void;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const [ownPage, setOwnPage] = useState(page);
  const current = onPageChange ? page : ownPage;
  const [zoom, setZoom] = useState(1);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState('جارٍ تحميل الكتاب…');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(480);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const render = useRef<RenderTask | null>(null);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | undefined;
    setPdf(null);
    setError('');
    setStatus('جارٍ تحميل الكتاب…');
    (async () => {
      const lib = await import('pdfjs-dist');
      lib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      const cache =
        typeof caches !== 'undefined'
          ? await caches.open('nbc-books-v1').catch(() => undefined)
          : undefined;
      let response = await cache?.match(book.url).catch(() => undefined);
      if (!response) {
        response = await fetch(book.url);
        if (!response.ok) throw new Error('تعذّر تحميل الكتاب.');
      }
      const bytes = await response.clone().arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      if (digest !== book.sha256) {
        await cache?.delete(book.url).catch(() => false);
        throw new Error('نسخة الكتاب تغيرت. تواصل مع الدعم.');
      }
      await cache?.put(book.url, response).catch(() => {});
      if (cancelled) return;
      task = lib.getDocument({ data: new Uint8Array(bytes) });
      const doc = await task.promise;
      if (doc.numPages !== book.pageCount) throw new Error('عدد صفحات الكتاب غير مطابق.');
      if (!cancelled) setPdf(doc);
    })().catch((e) => {
      if (!cancelled) {
        setError((e as Error).message);
        setStatus('');
      }
    });
    return () => {
      cancelled = true;
      render.current?.cancel();
      if (task) void task.destroy();
    };
  }, [book.url, book.sha256, book.pageCount, retry]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, entry.contentRect.width - 16)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    render.current?.cancel();
    setStatus('جارٍ عرض الصفحة…');
    pdf
      .getPage(current)
      .then(async (p) => {
        if (cancelled || !canvas.current) return;
        const viewport = p.getViewport({
          scale: (width / p.getViewport({ scale: 1 }).width) * zoom,
        });
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.current.width = viewport.width * ratio;
        canvas.current.height = viewport.height * ratio;
        canvas.current.style.width = `${viewport.width}px`;
        canvas.current.style.height = `${viewport.height}px`;
        render.current = p.render({
          canvas: canvas.current,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await render.current.promise;
        if (!cancelled) setStatus('');
      })
      .catch((e) => {
        if (!cancelled && e.name !== 'RenderingCancelledException') {
          setError('تعذّر عرض الصفحة. أعد المحاولة أو افتح الملف الكامل.');
          setStatus('');
        }
      });
    return () => {
      cancelled = true;
      render.current?.cancel();
    };
  }, [pdf, current, zoom, width]);
  function go(n: number) {
    if (!Number.isInteger(n)) return;
    const target = Math.max(1, Math.min(book.pageCount, n));
    if (onPageChange) onPageChange(target);
    else setOwnPage(target);
  }
  return (
    <section className={embedded ? 'reader embedded-reader' : 'reader'} aria-label="كتاب المسابقة">
      <header className="reader-toolbar">
        <strong>
          <Icon name="book" /> الكتاب الرسمي
        </strong>
        <div>
          <button
            className="icon-button"
            onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}
            aria-label="تصغير الصفحة"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            onClick={() => setZoom(Math.min(2.5, zoom + 0.25))}
            aria-label="تكبير الصفحة"
          >
            +
          </button>
          {onClose && (
            <button className="icon-button" onClick={onClose} aria-label="العودة إلى السؤال">
              <Icon name="close" />
            </button>
          )}
        </div>
      </header>
      <div className="pdf-navigation">
        <button className="button outline" disabled={current <= 1} onClick={() => go(current - 1)}>
          الصفحة السابقة
        </button>
        <label>
          صفحة PDF{' '}
          <input
            aria-label="رقم صفحة PDF"
            type="number"
            min={1}
            max={book.pageCount}
            value={current}
            onChange={(e) => go(Number(e.target.value))}
          />
        </label>
        <span>من {book.pageCount}</span>
        <button
          className="button outline"
          disabled={current >= book.pageCount}
          onClick={() => go(current + 1)}
        >
          الصفحة التالية
        </button>
      </div>
      <div role="status" aria-live="polite">
        {status}
      </div>
      {error && (
        <div role="alert" className="error-message">
          {error} <button onClick={() => setRetry((r) => r + 1)}>إعادة المحاولة</button>
        </div>
      )}
      <div className="pdf-canvas-container" ref={container} aria-busy={!!status}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`كتاب ${book.title}، صفحة PDF ${current}. استخدم الملف الكامل لخيارات القراءة الإضافية.`}
        />
      </div>
      <a className="reader-book-link" href={book.url} target="_blank" rel="noopener noreferrer">
        فتح الكتاب الكامل في نافذة جديدة
      </a>
    </section>
  );
}
