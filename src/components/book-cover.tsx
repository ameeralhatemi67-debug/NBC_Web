'use client';
import { useEffect, useRef, useState } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import type { BookVersion } from '@/lib/competition-domain';
import { useVerifiedBook } from './use-verified-book';
import { Icon } from './ui';
export type BookReadiness = { sha: string; verified: boolean; cached: boolean };

// This verified page-1 canvas is also the fallback slot for the future 3D book.
export function BookCover({
  book,
  onReadiness,
}: {
  book: BookVersion;
  onReadiness?: (status: BookReadiness) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [retry, setRetry] = useState(0);
  const [painted, setPainted] = useState(false);
  const [renderError, setRenderError] = useState('');
  const { pdf, cached, error } = useVerifiedBook(book, retry);
  useEffect(() => {
    onReadiness?.({ sha: book.sha256, verified: Boolean(pdf), cached });
  }, [pdf, cached, book.sha256, onReadiness]);
  useEffect(() => {
    setPainted(false);
    setRenderError('');
    if (!pdf) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    (async () => {
      const page = await pdf.getPage(1);
      if (cancelled || !canvas.current) return;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1400 / original.width });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      render = page.render({ canvas: canvas.current, viewport });
      await render.promise;
      if (!cancelled) setPainted(true);
    })().catch((error) => {
      if (!cancelled && error.name !== 'RenderingCancelledException')
        setRenderError('تعذّر عرض الغلاف.');
    });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf]);
  return (
    <div
      className={`book-cover-slot ${painted ? 'cover-ready' : ''}`}
      aria-busy={!painted && !error && !renderError}
    >
      <canvas ref={canvas} role="img" aria-label={`غلاف كتاب ${book.title}`} hidden={!painted} />
      {!painted && (
        <div className="book-cover-placeholder">
          <Icon name="book" size={32} />
          <span>{error || renderError || 'الكتاب'}</span>
          {(error || renderError) && (
            <button className="text-link" onClick={() => setRetry((value) => value + 1)}>
              إعادة المحاولة
            </button>
          )}
        </div>
      )}
    </div>
  );
}
