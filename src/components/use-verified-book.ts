'use client';
import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { BookVersion } from '@/lib/competition-domain';
import { loadVerifiedBook } from '@/lib/verified-book';

export function useVerifiedBook(book: BookVersion, retry = 0) {
  const [state, setState] = useState<{
    pdf: PDFDocumentProxy | null;
    cached: boolean;
    error: string;
  }>({ pdf: null, cached: false, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ pdf: null, cached: false, error: '' });
    loadVerifiedBook(book, controller.signal)
      .then(({ pdf, cached }) => {
        if (!controller.signal.aborted) setState({ pdf, cached, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ pdf: null, cached: false, error: (error as Error).message });
      });
    return () => controller.abort();
  }, [book.url, book.sha256, book.pageCount, retry]);
  return state;
}
