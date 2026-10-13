'use client';

import { useLinkStatus } from 'next/link';
import { Icon } from './ui';

export function BookLinkFeedback() {
  const { pending } = useLinkStatus();
  return (
    <span className="book-link-feedback" role="status" aria-live="polite" data-pending={pending}>
      {pending ? 'جارٍ فتح الكتاب…' : 'افتح كتاب المسابقة'}
      <Icon name={pending ? 'clock' : 'arrow'} size={16} />
    </span>
  );
}
