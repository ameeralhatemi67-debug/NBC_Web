'use client';
import type { BookVersion } from '@/lib/competition-domain';
import { Icon } from './ui';
import { openStoredBook } from './pdf-book-reader';

// For books uploaded by the committee, which have no single public file URL.
export function BookOpenButton({ book }: { book: BookVersion }) {
  return (
    <button type="button" className="button primary" onClick={() => void openStoredBook(book)}>
      <Icon name="book" /> افتح الكتاب في نافذة جديدة
    </button>
  );
}
