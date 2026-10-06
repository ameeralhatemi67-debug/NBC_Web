'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  canvasSize,
  clampZoom,
  fallbackContents,
  outlineContents,
  readerBookConfig,
  contentsGroups,
  type BookContentsEntry,
} from '@/lib/reader-presentation';
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
  renderWidth,
  ratio,
  root,
  flash,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  renderWidth: number;
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
        const viewport = page.getViewport({ scale: renderWidth / original.width });
        const size = canvasSize(viewport.width, viewport.height, devicePixelRatio || 1);
        canvas.current.width = size.width;
        canvas.current.height = size.height;
        const density = size.density;
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
  }, [pdf, number, renderWidth, near, retry]);
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
  page,
  onPageChange,
  embedded = false,
  onClose,
  hintPages,
  onClearHint,
  sourceFlash,
  phone = false,
}: {
  book?: BookVersion;
  page?: number;
  onPageChange?: (page: number) => void;
  embedded?: boolean;
  onClose?: () => void;
  hintPages?: number[];
  onClearHint?: () => void;
  sourceFlash?: { page: number; request: number } | null;
  phone?: boolean;
}) {
  const config = readerBookConfig(book);
  const [ownPage, setOwnPage] = useState(page ?? config.openingPage);
  const current = onPageChange ? (page ?? config.openingPage) : ownPage;
  const [zoom, setZoom] = useState(1);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.42);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(480);
  const [renderWidth, setRenderWidth] = useState(480);
  const [night, setNight] = useState(false);
  const [paged, setPaged] = useState(false);
  const [contents, setContents] = useState<BookContentsEntry[]>(fallbackContents(book));
  const [contentsOpen, setContentsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const moreMenu = useRef<HTMLDivElement>(null);
  const zoomGroup = useRef<HTMLDivElement>(null);
  const zoomButton = useRef<HTMLButtonElement>(null);
  const moreId = useId();
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(44);
  const container = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const contentsMenu = useRef<HTMLDivElement>(null);
  const contentsButton = useRef<HTMLButtonElement>(null);
  const contentsId = useId();
  const reported = useRef(current);
  const scrollFrame = useRef(0);
  const scrollAnchor = useRef({ page: current, fraction: 0, left: 0 });
  const priorTop = useRef(0);
  const touched = useRef(false);
  const lastTap = useRef({ time: 0, x: 0, y: 0 });
  const gestures = useRef({
    distance: 0,
    zoom: 1,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    moved: false,
    pinch: false,
  });
  const live = useRef({ zoom, current, paged, phone });
  live.current = { zoom, current, paged, phone };
  const rangeKey = hintPages?.join(',') ?? 'all';
  const groupedContents = contentsGroups(contents);
  const pages = hintPages
    ? [...new Set(hintPages)].filter((n) => n >= 1 && n <= book.pageCount).sort((a, b) => a - b)
    : Array.from({ length: book.pageCount }, (_, i) => i + 1);
  const renderPages = paged && !hintPages ? [current] : pages;
  const pageKey = `nbc-reader-page:${book.sha256}`;
  useEffect(() => {
    try {
      setNight(localStorage.getItem('nbc-reader-night') === '1');
      setPaged(localStorage.getItem('nbc-reader-paged') === '1');
      if (page === undefined) {
        const saved = Number(localStorage.getItem(pageKey));
        if (saved >= 1 && saved <= book.pageCount) setOwnPage(saved);
      }
    } catch {}
  }, [pageKey]);
  useEffect(() => {
    const timer = setTimeout(() => setRenderWidth(width * zoom), 150);
    return () => clearTimeout(timer);
  }, [width, zoom]);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const items = await outlineContents(pdf, book.pageCount);
      if (!cancelled) setContents(items.length ? items : fallbackContents(book));
    })().catch(() => {
      if (!cancelled) setContents(fallbackContents(book));
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, book.id, book.pageCount]);

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
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(160, entry.contentRect.width - 16));
    });
    observer.observe(container.current);
    const toolbar = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) setHeaderHeight(entry.contentRect.height);
    });
    if (header.current) toolbar.observe(header.current);
    return () => {
      observer.disconnect();
      toolbar.disconnect();
      cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  useLayoutEffect(() => {
    const view = container.current;
    if (!view || !pdf) return;
    const anchor = { ...scrollAnchor.current };
    const target = view.querySelector<HTMLElement>(`[data-page="${anchor.page}"]`);
    if (target) {
      view.scrollTop = target.offsetTop + anchor.fraction * target.offsetHeight;
      view.scrollLeft = anchor.left * width * zoom;
      priorTop.current = view.scrollTop;
    }
  }, [width, zoom, pdf, paged]);
  useEffect(() => {
    if (!pdf || !container.current) return;
    go(current, false);
  }, [pdf, rangeKey]);
  useEffect(() => {
    if (current !== reported.current) go(current, false);
  }, [current, pdf]);
  useEffect(() => {
    if (sourceFlash && pdf) go(sourceFlash.page, false);
  }, [pdf, sourceFlash?.page, sourceFlash?.request]);
  useEffect(() => {
    if (!contentsOpen) return;
    function outside(event: PointerEvent) {
      if (
        !contentsMenu.current?.contains(event.target as Node) &&
        !contentsButton.current?.contains(event.target as Node)
      )
        setContentsOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    const frame = requestAnimationFrame(() =>
      contentsMenu.current?.querySelector<HTMLButtonElement>('button')?.focus(),
    );
    return () => {
      document.removeEventListener('pointerdown', outside);
      cancelAnimationFrame(frame);
    };
  }, [contentsOpen]);
  useEffect(() => {
    if (!moreOpen && !zoomOpen) return;
    function outside(event: PointerEvent) {
      if (
        !moreMenu.current?.contains(event.target as Node) &&
        !moreButton.current?.contains(event.target as Node)
      )
        setMoreOpen(false);
      if (!zoomGroup.current?.contains(event.target as Node)) setZoomOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
    };
  }, [moreOpen, zoomOpen]);
  useLayoutEffect(() => {
    if (moreOpen) moreMenu.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [moreOpen]);
  function rememberAnchor() {
    const view = container.current;
    if (!view) return;
    const target = view.querySelector<HTMLElement>(`[data-page="${reported.current}"]`);
    if (target)
      scrollAnchor.current = {
        page: reported.current,
        fraction: (view.scrollTop - target.offsetTop) / target.offsetHeight,
        left: view.scrollLeft / (width * live.current.zoom),
      };
  }
  function report(n: number) {
    reported.current = n;
    if (onPageChange) onPageChange(n);
    else setOwnPage(n);
    try {
      localStorage.setItem(pageKey, String(n));
    } catch {}
  }
  function go(n: number, notify = true) {
    if (!Number.isInteger(n)) return;
    cancelAnimationFrame(scrollFrame.current);
    const target = Math.max(pages[0] ?? 1, Math.min(pages.at(-1) ?? book.pageCount, n));
    const element = container.current?.querySelector<HTMLElement>(`[data-page="${target}"]`);
    if (element && container.current) container.current.scrollTo({ top: element.offsetTop - 8 });
    if (container.current) priorTop.current = container.current.scrollTop;
    scrollAnchor.current = { page: target, fraction: 0, left: 0 };
    reported.current = target;
    if (notify) report(target);
    setHeaderHidden(false);
  }
  function changeZoom(value: number) {
    rememberAnchor();
    setZoom(clampZoom(value, phone));
  }
  function trackPage() {
    const view = container.current;
    if (!view) return;
    if (
      phone &&
      !contentsOpen &&
      !moreOpen &&
      !zoomOpen &&
      !header.current?.contains(document.activeElement)
    ) {
      if (view.scrollTop > priorTop.current + 8) setHeaderHidden(true);
      else if (view.scrollTop < priorTop.current - 8) setHeaderHidden(false);
    }
    priorTop.current = view.scrollTop;
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const view = container.current;
      if (!view) return;
      if (!paged || hintPages) {
        const edge = view.getBoundingClientRect().top + view.clientHeight / 2;
        const visible = Array.from(view.querySelectorAll<HTMLElement>('[data-page]')).find(
          (item) => item.getBoundingClientRect().bottom > edge,
        );
        const n = Number(visible?.dataset.page);
        if (n && n !== reported.current) report(n);
      }
      rememberAnchor();
    });
  }
  useEffect(() => {
    const view = container.current;
    if (!view) return;
    const distance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    function start(event: TouchEvent) {
      if (event.touches.length === 2) {
        event.preventDefault();
        rememberAnchor();
        gestures.current = {
          ...gestures.current,
          distance: distance(event.touches),
          zoom: live.current.zoom,
          pinch: true,
          moved: true,
        };
      } else if (event.touches.length === 1) {
        const t = event.touches[0];
        gestures.current = {
          distance: 0,
          zoom: live.current.zoom,
          x: t.clientX,
          y: t.clientY,
          left: view!.scrollLeft,
          top: view!.scrollTop,
          moved: false,
          pinch: false,
        };
      }
      touched.current = true;
    }
    function move(event: TouchEvent) {
      event.preventDefault();
      const gesture = gestures.current;
      if (event.touches.length === 2 && gesture.distance) {
        setZoom(
          clampZoom(
            (gesture.zoom * distance(event.touches)) / gesture.distance,
            live.current.phone,
          ),
        );
      } else if (event.touches.length === 1 && !gesture.pinch) {
        const t = event.touches[0];
        const dx = t.clientX - gesture.x,
          dy = t.clientY - gesture.y;
        gesture.moved ||= Math.abs(dx) + Math.abs(dy) > 8;
        view!.scrollTop = gesture.top - dy;
        view!.scrollLeft = gesture.left - dx;
      }
    }
    function end(event: TouchEvent) {
      if (event.touches.length) return;
      const gesture = gestures.current;
      const t = event.changedTouches[0];
      if (gesture.pinch) return;
      const dx = t.clientX - gesture.x,
        dy = t.clientY - gesture.y;
      if (
        live.current.paged &&
        live.current.zoom <= 1 &&
        Math.abs(dx) > 50 &&
        Math.abs(dx) > Math.abs(dy) * 1.2
      )
        go(live.current.current + (dx > 0 ? 1 : -1));
      if (!gesture.moved) {
        setHeaderHidden(false);
        const now = Date.now(),
          last = lastTap.current;
        if (now - last.time < 300 && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30) {
          changeZoom(live.current.zoom > 1 ? 1 : 2);
          lastTap.current = { time: 0, x: 0, y: 0 };
        } else lastTap.current = { time: now, x: t.clientX, y: t.clientY };
      }
    }
    view.addEventListener('touchstart', start, { passive: false });
    view.addEventListener('touchmove', move, { passive: false });
    view.addEventListener('touchend', end, { passive: false });
    return () => {
      view.removeEventListener('touchstart', start);
      view.removeEventListener('touchmove', move);
      view.removeEventListener('touchend', end);
    };
  }, [width, phone, pdf, paged, rangeKey, zoom, onPageChange]);
  const contentsControl = (
    <button
      ref={contentsButton}
      className="icon-button reader-contents-button"
      role={phone ? 'menuitem' : undefined}
      aria-label="المحتويات"
      title="المحتويات"
      aria-haspopup="menu"
      aria-expanded={contentsOpen}
      aria-controls={contentsId}
      disabled={!pdf}
      onClick={() => {
        setContentsOpen(!contentsOpen);
        setMoreOpen(false);
        setHeaderHidden(false);
      }}
    >
      <Icon name="book" size={18} />
      {phone && <span>المحتويات</span>}
    </button>
  );
  return (
    <section
      className={`reader ${embedded ? 'embedded-reader' : ''} ${phone ? 'phone-reader' : ''} ${night ? 'night-reader' : ''} ${headerHidden ? 'toolbar-hidden' : ''}`}
      style={{ '--reader-toolbar-height': `${headerHeight}px` } as React.CSSProperties}
      aria-label="كتاب المسابقة"
    >
      <header
        ref={header}
        className="reader-toolbar"
        inert={headerHidden && phone}
        aria-hidden={(headerHidden && phone) || undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && phone && (moreOpen || zoomOpen)) {
            event.preventDefault();
            event.stopPropagation();
            setMoreOpen(false);
            setZoomOpen(false);
            (moreOpen ? moreButton : zoomButton).current?.focus();
          }
        }}
      >
        {onClose && (
          <button
            className={`reader-close icon-button ${phone ? 'phone-reader-close' : ''}`}
            onClick={onClose}
            aria-label="العودة إلى السؤال"
            title="العودة إلى السؤال"
          >
            <Icon name="arrow" size={16} />
            {phone && <span>السؤال</span>}
          </button>
        )}
        {!phone && contentsControl}
        <div className="reader-page-controls" aria-label="التنقل في الكتاب" dir="ltr">
          <button
            className="icon-button"
            disabled={!pdf || current <= (pages[0] ?? 1)}
            onClick={() => go(current - 1)}
            aria-label="الصفحة السابقة"
            title="الصفحة السابقة"
          >
            ‹
          </button>
          <input
            aria-label="رقم صفحة PDF"
            type="number"
            min={pages[0] ?? 1}
            max={pages.at(-1) ?? book.pageCount}
            value={current}
            onChange={(event) => go(Number(event.target.value))}
          />
          <bdi dir="ltr" className="reader-page-total">
            / {book.pageCount}
          </bdi>
          <button
            className="icon-button"
            disabled={!pdf || current >= (pages.at(-1) ?? book.pageCount)}
            onClick={() => go(current + 1)}
            aria-label="الصفحة التالية"
            title="الصفحة التالية"
          >
            ›
          </button>
        </div>
        <div ref={zoomGroup} className="reader-zoom-controls" dir="ltr" aria-label="تكبير الكتاب">
          {phone && (
            <button
              ref={zoomButton}
              className="icon-button reader-zoom-toggle"
              aria-label="خيارات التكبير"
              aria-expanded={zoomOpen}
              onClick={() => {
                setZoomOpen(!zoomOpen);
                setMoreOpen(false);
              }}
            >
              <bdi dir="ltr">{Math.round(zoom * 100)}%</bdi>
            </button>
          )}
          {(!phone || zoomOpen) && (
            <div
              className={`reader-zoom-adjustments ${phone ? 'reader-zoom-popover' : ''}`}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && phone) {
                  event.preventDefault();
                  event.stopPropagation();
                  setZoomOpen(false);
                  zoomButton.current?.focus();
                }
              }}
            >
              <button
                className="icon-button"
                disabled={zoom <= (phone ? 1 : 0.75)}
                onClick={() => changeZoom(zoom - 0.25)}
                aria-label="تصغير الصفحة"
                title="تصغير الصفحة"
              >
                −
              </button>
              <bdi dir="ltr">{Math.round(zoom * 100)}%</bdi>
              <button
                className="icon-button"
                disabled={zoom >= 3}
                onClick={() => changeZoom(zoom + 0.25)}
                aria-label="تكبير الصفحة"
                title="تكبير الصفحة"
              >
                +
              </button>
            </div>
          )}
        </div>
        {phone && (
          <button
            ref={moreButton}
            className="icon-button reader-more-button"
            aria-haspopup="menu"
            aria-controls={moreId}
            aria-expanded={moreOpen}
            onClick={() => {
              setMoreOpen(!moreOpen);
              setZoomOpen(false);
              setContentsOpen(false);
            }}
          >
            <span>المزيد</span>
          </button>
        )}
        <div
          ref={moreMenu}
          id={moreId}
          className={phone ? 'reader-more-popover' : 'reader-extra-controls'}
          hidden={phone && !moreOpen}
          role={phone ? 'menu' : undefined}
          aria-label={phone ? 'المزيد' : undefined}
          onKeyDown={(event) => {
            if (!phone) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setMoreOpen(false);
              moreButton.current?.focus();
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]'),
              );
              const index = items.indexOf(document.activeElement as HTMLElement);
              items[
                (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
              ]?.focus();
            }
          }}
        >
          {phone && contentsControl}
          <button
            className="icon-button"
            role={phone ? 'menuitemcheckbox' : undefined}
            aria-label="القراءة الليلية"
            title="القراءة الليلية"
            aria-pressed={night}
            aria-checked={phone ? night : undefined}
            onClick={() => {
              setNight(!night);
              setMoreOpen(false);
              if (phone) moreButton.current?.focus();
              try {
                localStorage.setItem('nbc-reader-night', night ? '0' : '1');
              } catch {}
            }}
          >
            <Icon name="moon" size={18} />
            {phone && <span>وضع القراءة الليلي</span>}
          </button>
          <button
            className="icon-button"
            role={phone ? 'menuitemcheckbox' : undefined}
            aria-label="صفحة بصفحة"
            title="صفحة بصفحة"
            aria-pressed={paged}
            aria-checked={phone ? paged : undefined}
            onClick={() => {
              rememberAnchor();
              setPaged(!paged);
              setMoreOpen(false);
              if (phone) moreButton.current?.focus();
              try {
                localStorage.setItem('nbc-reader-paged', paged ? '0' : '1');
              } catch {}
            }}
          >
            <Icon name="pages" size={18} />
            {phone && <span>صفحة بصفحة</span>}
          </button>
          <a
            className="icon-button"
            role={phone ? 'menuitem' : undefined}
            href={book.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="فتح الكتاب الكامل في نافذة جديدة"
            title="فتح الكتاب الكامل في نافذة جديدة"
          >
            <Icon name="download" size={18} />
            {phone && <span>فتح الكتاب الكامل في نافذة جديدة</span>}
          </a>
        </div>
      </header>
      {contentsOpen && (
        <div
          id={contentsId}
          ref={contentsMenu}
          className="reader-contents"
          role="menu"
          aria-label="المحتويات"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setContentsOpen(false);
              (phone ? moreButton : contentsButton).current?.focus();
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
              );
              const i = items.indexOf(document.activeElement as HTMLButtonElement);
              items[
                (i + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
              ]?.focus();
            }
          }}
        >
          <div className="reader-contents-group" role="group" aria-label="فصول الكتاب">
            <strong>فصول الكتاب</strong>
            {groupedContents.chapters.map((item, i) => (
              <button
                key={`${item.page}-${i}`}
                role="menuitem"
                onClick={() => {
                  go(item.page);
                  setContentsOpen(false);
                  container.current?.focus();
                }}
              >
                {item.title}
                <bdi dir="ltr">{item.page}</bdi>
              </button>
            ))}
          </div>
          {groupedContents.otherPages.length > 0 && (
            <details className="reader-contents-group">
              <summary>صفحات أخرى</summary>
              {groupedContents.otherPages.map((item) => (
                <button
                  key={item.page}
                  role="menuitem"
                  onClick={() => {
                    go(item.page);
                    setContentsOpen(false);
                    container.current?.focus();
                  }}
                >
                  {item.title}
                  <bdi dir="ltr">{item.page}</bdi>
                </button>
              ))}
            </details>
          )}
        </div>
      )}
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
          {error}
          <button className="text-link" onClick={() => setRetry((n) => n + 1)}>
            إعادة المحاولة
          </button>
        </div>
      )}
      <div
        className="pdf-canvas-container"
        ref={container}
        onScroll={trackPage}
        onKeyDown={() => setHeaderHidden(false)}
        tabIndex={0}
        aria-label="صفحات الكتاب، مرّر للأعلى أو للأسفل"
        aria-busy={!pdf && !error}
      >
        {pdf &&
          renderPages.map((number) => (
            <BookPage
              key={`${book.id}-${number}`}
              pdf={pdf}
              number={number}
              width={width * zoom}
              renderWidth={renderWidth}
              ratio={ratio}
              root={container}
              flash={sourceFlash?.page === number ? sourceFlash.request : undefined}
            />
          ))}
      </div>
    </section>
  );
}
