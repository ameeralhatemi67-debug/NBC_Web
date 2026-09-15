'use client';
import { useEffect, useRef, useState } from 'react';
import { bookChapters } from '@/lib/content';
import { Icon } from './ui';
export function BookReader({
  initialChapter = 0,
  embedded = false,
  onClose,
}: {
  initialChapter?: number;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const [chapter, setChapter] = useState(initialChapter);
  const [size, setSize] = useState(22);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('nbc-reading') || '{}');
      if (Number.isInteger(saved.chapter)) setChapter(Math.min(3, Math.max(0, saved.chapter)));
      if (Number.isFinite(saved.size)) setSize(Math.min(32, Math.max(18, saved.size)));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) sessionStorage.setItem('nbc-reading', JSON.stringify({ chapter, size }));
  }, [chapter, size, ready]);
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      if (ref.current)
        ref.current.scrollTop =
          Number(sessionStorage.getItem(`nbc-reading-position-${chapter}`)) || 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [chapter, ready]);
  function rememberPosition() {
    if (ready)
      sessionStorage.setItem(
        `nbc-reading-position-${chapter}`,
        String(ref.current?.scrollTop || 0),
      );
  }
  const current = bookChapters[chapter];
  return (
    <section className={embedded ? 'reader embedded-reader' : 'reader'} aria-label="مساحة القراءة">
      <header className="reader-toolbar">
        <div>
          <Icon name="book" />
          <strong>مساحة القراءة</strong>
        </div>
        <div>
          <button
            className="icon-button"
            aria-label="تصغير الخط"
            onClick={() => setSize(Math.max(18, size - 2))}
          >
            أ−
          </button>
          <button
            className="icon-button"
            aria-label="تكبير الخط"
            onClick={() => setSize(Math.min(32, size + 2))}
          >
            أ+
          </button>
          {onClose && (
            <button className="icon-button" onClick={onClose} aria-label="العودة إلى السؤال">
              <Icon name="close" />
            </button>
          )}
        </div>
      </header>
      <div className="reader-disclaimer">نص أصلي للتجربة فقط · لا يمثّل الكتاب الرسمي</div>
      <div className="reader-tabs" aria-label="فصول النص">
        {bookChapters.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setChapter(i)}
            aria-current={chapter === i ? 'page' : undefined}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="reader-body" ref={ref} onScroll={rememberPosition}>
        <span className="eyebrow">قراءة تجريبية / 0{chapter + 1}</span>
        <h2>{current.title}</h2>
        <p style={{ fontSize: size }}>{current.text}</p>
        <blockquote>{current.takeaway}</blockquote>
        <div className="reader-bottom">
          <span>
            الفصل {chapter + 1} من {bookChapters.length}
          </span>
          <button className="text-link" onClick={() => setChapter((chapter + 1) % 4)}>
            {chapter === 3 ? 'العودة إلى البداية' : 'الفصل التالي'} <Icon size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
