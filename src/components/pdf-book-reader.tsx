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

// Keep placeholders for the whole book, but only retain canvases near the viewport.
function BookPage({
  pdf,
  number,
  width,
  ratio,
  root,
  flash,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  ratio: number;
  root: React.RefObject<HTMLDivElement | null>;
  flash?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [heightRatio, setHeightRatio] = useState(ratio);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (flash === undefined || !near || !ready) {
      setFlashing(false);
      return;
    }
    setFlashing(true);
    const timeout = setTimeout(() => setFlashing(false), 1400);
    return () => clearTimeout(timeout);
  }, [flash, near, ready]);
  useEffect(() => {
    if (!holder.current) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: root.current,
      rootMargin: '600px 0px',
    });
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    setReady(false);
    setError('');
    pdf
      .getPage(number)
      .then(async (page) => {
        if (cancelled || !canvas.current) return;
        const original = page.getViewport({ scale: 1 });
        setHeightRatio(original.height / original.width);
        const viewport = page.getViewport({ scale: width / original.width });
        const density = Math.min(devicePixelRatio || 1, 2);
        canvas.current.width = Math.ceil(viewport.width * density);
        canvas.current.height = Math.ceil(viewport.height * density);
        render = page.render({
          canvas: canvas.current,
          viewport,
          transform: [density, 0, 0, density, 0, 0],
        });
        await render.promise;
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled && e.name !== 'RenderingCancelledException') setError('تعذّر عرض الصفحة.');
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, number, width, near, retry]);
  return (
    <div
      ref={holder}
      className="pdf-page"
      data-page={number}
      style={{ width, height: width * heightRatio }}
      aria-busy={near && !ready && !error}
    >
      {flashing && <span key={flash} className="pdf-source-flash" aria-hidden="true" />}
      {near && (
        <canvas
          ref={canvas}
          role="img"
          aria-label={`صفحة PDF ${number}`}
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {near && !ready && !error && <span className="pdf-page-loading">جارٍ عرض الصفحة…</span>}
      {error && (
        <div className="pdf-page-loading" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => setRetry((n) => n + 1)}>
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  );
}

export function BookReader({
  book = defaultBook,
  page = 1,
  onPageChange,
  embedded = false,
  onClose,
  hintPages,
  onClearHint,
  sourceFlash,
}: {
  book?: BookVersion;
  page?: number;
  onPageChange?: (page: number) => void;
  embedded?: boolean;
  onClose?: () => void;
  hintPages?: number[];
  onClearHint?: () => void;
  sourceFlash?: { page: number; request: number } | null;
}) {
  const [ownPage, setOwnPage] = useState(page);
  const current = onPageChange ? page : ownPage;
  const [zoom, setZoom] = useState(1);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.42);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(480);
  const container = useRef<HTMLDivElement>(null);
  const reported = useRef(current);
  const scrollFrame = useRef(0);
  const rangeKey = hintPages?.join(',') ?? 'all';
  const pages = hintPages
    ? [...new Set(hintPages)].filter((n) => n >= 1 && n <= book.pageCount).sort((a, b) => a - b)
    : Array.from({ length: book.pageCount }, (_, i) => i + 1);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | undefined;
    setPdf(null);
    setError('');
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
      const first = await doc.getPage(1);
      const viewport = first.getViewport({ scale: 1 });
      if (!cancelled) {
        setRatio(viewport.height / viewport.width);
        setPdf(doc);
      }
    })().catch((e) => {
      if (!cancelled) setError((e as Error).message);
    });
    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [book.url, book.sha256, book.pageCount, retry]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(160, entry.contentRect.width - 16)),
    );
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  // Scrolling reports the active page without jumping back to its beginning.
  useEffect(() => {
    if (!pdf || !container.current) return;
    const target = container.current.querySelector<HTMLElement>(`[data-page="${current}"]`);
    if (target) container.current.scrollTo({ top: target.offsetTop - 8 });
    reported.current = current;
  }, [pdf, rangeKey, zoom, width]);
  useEffect(() => {
    if (current === reported.current || !pdf || !container.current) return;
    const target = container.current.querySelector<HTMLElement>(`[data-page="${current}"]`);
    if (target) container.current.scrollTo({ top: target.offsetTop - 8 });
    reported.current = current;
  }, [current, pdf]);
  useEffect(() => {
    if (!pdf || !sourceFlash || !container.current) return;
    const target = container.current.querySelector<HTMLElement>(
      `[data-page="${sourceFlash.page}"]`,
    );
    if (target) container.current.scrollTo({ top: target.offsetTop - 8 });
    reported.current = sourceFlash.page;
  }, [pdf, sourceFlash?.page, sourceFlash?.request]);
  function report(n: number) {
    reported.current = n;
    if (onPageChange) onPageChange(n);
    else setOwnPage(n);
  }
  function go(n: number) {
    if (!Number.isInteger(n)) return;
    const target = Math.max(pages[0] ?? 1, Math.min(pages.at(-1) ?? book.pageCount, n));
    const element = container.current?.querySelector<HTMLElement>(`[data-page="${target}"]`);
    if (element && container.current) container.current.scrollTo({ top: element.offsetTop - 8 });
    report(target);
  }
  function trackPage() {
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const view = container.current;
      if (!view) return;
      const edge = view.getBoundingClientRect().top + view.clientHeight / 2;
      const items = Array.from(view.querySelectorAll<HTMLElement>('[data-page]'));
      const visible = items.find((item) => item.getBoundingClientRect().bottom > edge);
      const n = Number(visible?.dataset.page);
      if (n && n !== reported.current) report(n);
    });
  }
  return (
    <section className={embedded ? 'reader embedded-reader' : 'reader'} aria-label="كتاب المسابقة">
      <header className="reader-toolbar">
        <strong>
          <Icon name="book" size={19} /> الكتاب الرسمي
        </strong>
        <div className="reader-page-controls" aria-label="التنقل في الكتاب">
          <button
            className="icon-button"
            disabled={!pdf || current <= (pages[0] ?? 1)}
            onClick={() => go(current - 1)}
            aria-label="الصفحة السابقة"
          >
            <Icon size={18} />
          </button>
          <input
            aria-label="رقم صفحة PDF"
            type="number"
            min={pages[0] ?? 1}
            max={pages.at(-1) ?? book.pageCount}
            value={current}
            onChange={(e) => go(Number(e.target.value))}
          />
          <span className="reader-page-total">/ {book.pageCount}</span>
          <button
            className="icon-button"
            disabled={!pdf || current >= (pages.at(-1) ?? book.pageCount)}
            onClick={() => go(current + 1)}
            aria-label="الصفحة التالية"
          >
            <Icon size={18} />
          </button>
        </div>
        <div className="reader-zoom-controls">
          <button
            className="icon-button"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((n) => Math.max(0.75, n - 0.25))}
            aria-label="تصغير الصفحة"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            disabled={zoom >= 2.5}
            onClick={() => setZoom((n) => Math.min(2.5, n + 0.25))}
            aria-label="تكبير الصفحة"
          >
            +
          </button>
          <a
            className="icon-button"
            href={book.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="فتح الكتاب الكامل في نافذة جديدة"
          >
            <Icon name="download" size={18} />
          </a>
          {onClose && (
            <button className="icon-button" onClick={onClose} aria-label="العودة إلى السؤال">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </header>
      {hintPages && (
        <div className="reader-hint-bar" role="status">
          <span>التلميح: صفحة المصدر والتي قبلها فقط</span>
          <button
            className="text-link"
            onClick={() => {
              onClearHint?.();
              requestAnimationFrame(() => container.current?.focus());
            }}
          >
            العودة إلى الكتاب كاملًا
          </button>
        </div>
      )}
      {!pdf && !error && (
        <div className="reader-loading" role="status">
          جارٍ تحميل الكتاب…
        </div>
      )}
      {error && (
        <div role="alert" className="error-message">
          {error}{' '}
          <button className="text-link" onClick={() => setRetry((n) => n + 1)}>
            إعادة المحاولة
          </button>
        </div>
      )}
      <div
        className="pdf-canvas-container"
        ref={container}
        onScroll={trackPage}
        tabIndex={0}
        aria-label="صفحات الكتاب، مرّر للأعلى أو للأسفل"
        aria-busy={!pdf && !error}
      >
        {pdf &&
          pages.map((number) => (
            <BookPage
              key={`${book.id}-${number}`}
              pdf={pdf}
              number={number}
              width={width * zoom}
              ratio={ratio}
              root={container}
              flash={sourceFlash?.page === number ? sourceFlash.request : undefined}
            />
          ))}
      </div>
    </section>
  );
}
