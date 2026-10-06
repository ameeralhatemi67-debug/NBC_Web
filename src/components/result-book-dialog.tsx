'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { BookVersion } from '@/lib/competition-domain';
import { BookReader } from './book-reader';
import { Icon } from './ui';
export function ResultBookDialog({
  book,
  page,
  onPageChange,
  open,
  onClose,
  opener,
}: {
  book: BookVersion;
  page: number;
  onPageChange: (page: number) => void;
  open: boolean;
  onClose: () => void;
  opener: React.RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [phone, setPhone] = useState(false);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current;
    setMounted(true);
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Match the full-screen dialog's viewport breakpoint, including its inset.
    const observer = new ResizeObserver(() => setPhone(window.innerWidth < 820));
    observer.observe(node);
    close.current?.focus();
    return () => {
      observer.disconnect();
      node.close();
      document.body.style.overflow = overflow;
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, [open, opener]);
  return (
    <dialog
      ref={dialog}
      className="result-reader-dialog"
      aria-label="كتاب المسابقة"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (phone || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),summary,[tabindex="0"]',
          ),
        ).filter((item) => !item.closest('[hidden],[inert]') && item.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header
        className="result-reader-header"
        onPointerDown={(event) => {
          if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('button')) {
            touch.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerUp={(event) => {
          const start = touch.current;
          touch.current = null;
          if (start && event.clientY - start.y > 60 && Math.abs(event.clientX - start.x) < 50)
            onClose();
        }}
        onPointerCancel={() => {
          touch.current = null;
        }}
      >
        <button ref={close} className="button result-reader-close" onClick={onClose}>
          <Icon name="close" size={18} />
          إغلاق
        </button>
        <span>
          الكتاب · صفحة <bdi dir="ltr">{page}</bdi>
        </span>
      </header>
      <div className="result-reader-body">
        {mounted && (
          <BookReader book={book} page={page} onPageChange={onPageChange} embedded phone={phone} />
        )}
      </div>
      {phone && (
        <footer className="result-reader-bottom">
          <button className="button primary" onClick={onClose}>
            العودة إلى النتيجة
          </button>
        </footer>
      )}
    </dialog>
  );
}
