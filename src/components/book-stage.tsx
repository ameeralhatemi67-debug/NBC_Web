'use client';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { BookVersion } from '@/lib/competition-domain';
import { chooseRenderer, probeRendererEnvironment } from '@/lib/book-model';
import type { BookScene, BookSceneState } from '@/lib/book-scene';
import { BookCover, type BookReadiness } from './book-cover';

export type BookStageHandle = { open(): Promise<void>; close(): Promise<void> };
type DebugWindow = Window & { __NBC_BOOK_DEBUG__?: boolean; __nbcBook?: BookScene };

// The verified flat cover is always rendered. When WebGL is available and the device is not low
// power, a lazily loaded 3D book is drawn over it from the same canvas. Any failure keeps the flat
// cover, and open()/close() then resolve at once so Start is never blocked.
export function BookStage({
  book,
  initial = 'closed',
  closeWhenReady = false,
  onReadiness,
  ref,
}: {
  book: BookVersion;
  initial?: 'closed' | 'open';
  closeWhenReady?: boolean;
  onReadiness?: (status: BookReadiness) => void;
  ref?: Ref<BookStageHandle>;
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<BookSceneState>('closed');
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BookScene | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      open: () => scene.current?.open() ?? Promise.resolve(),
      close: () => scene.current?.close() ?? Promise.resolve(),
    }),
    [],
  );
  useEffect(() => {
    if (!source || !canvas.current) return;
    if (chooseRenderer(probeRendererEnvironment()) !== '3d') return;
    let cancelled = false;
    let created: BookScene | undefined;
    const debug = window as DebugWindow;
    import('@/lib/book-scene')
      .then(({ createBookScene }) => {
        if (cancelled || !canvas.current) return;
        created = createBookScene({
          canvas: canvas.current,
          cover: source,
          pageCount: book.pageCount,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          finePointer: matchMedia('(hover: hover) and (pointer: fine)').matches,
          initialProgress: initial === 'open' ? 1 : 0,
          onState: setState,
          onContextLost: () => {
            created?.dispose();
            scene.current = null;
            setActive(false);
          },
        });
        setState(created.state);
        scene.current = created;
        if (debug.__NBC_BOOK_DEBUG__) debug.__nbcBook = created;
        setActive(true);
        if (closeWhenReady) void created.close();
      })
      .catch(() => {
        created?.dispose();
        created = undefined;
      });
    return () => {
      cancelled = true;
      created?.dispose();
      if (debug.__nbcBook === created) delete debug.__nbcBook;
      scene.current = null;
      setActive(false);
    };
  }, [source, book.pageCount, initial, closeWhenReady]);
  return (
    <BookCover
      book={book}
      onReadiness={onReadiness}
      onPainted={setSource}
      decorative={active}
      className={active ? 'book-3d-active' : ''}
    >
      <canvas
        ref={canvas}
        className="book-3d-canvas"
        role={active ? 'img' : undefined}
        aria-label={active ? `غلاف كتاب ${book.title}` : undefined}
        aria-hidden={active ? undefined : true}
        data-book-renderer={active ? 'webgl' : 'flat'}
        data-book-state={active ? state : 'flat'}
      />
    </BookCover>
  );
}
