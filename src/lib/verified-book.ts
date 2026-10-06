import type { BookVersion } from './competition-domain';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export async function verifyBookBytes(bytes: ArrayBuffer, expectedSha: string) {
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return digest === expectedSha;
}

// Shared by the reader and flat cover. No text extraction or search layer.
export async function loadVerifiedBook(book: BookVersion, signal: AbortSignal) {
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  const cache =
    typeof caches !== 'undefined'
      ? await caches.open('nbc-books-v1').catch(() => undefined)
      : undefined;
  let response = await cache?.match(book.url).catch(() => undefined);
  const fromCache = Boolean(response);
  if (!response) {
    response = await fetch(book.url, { signal });
    if (!response.ok) throw new Error('تعذّر تحميل الكتاب.');
  }
  const bytes = await response.clone().arrayBuffer();
  if (!(await verifyBookBytes(bytes, book.sha256))) {
    await cache?.delete(book.url).catch(() => false);
    throw new Error('نسخة الكتاب تغيرت. تواصل مع الدعم.');
  }
  signal.throwIfAborted();
  const task = lib.getDocument({ data: new Uint8Array(bytes) });
  const dispose = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const pdf = await task.promise;
    signal.throwIfAborted();
    if (pdf.numPages !== book.pageCount) {
      await cache?.delete(book.url).catch(() => false);
      throw new Error('عدد صفحات الكتاب غير مطابق.');
    }
    const cached =
      fromCache ||
      (await cache
        ?.put(book.url, response)
        .then(() => true)
        .catch(() => false)) ||
      false;
    return { pdf: pdf as PDFDocumentProxy, cached };
  } catch (error) {
    signal.removeEventListener('abort', dispose);
    await task.destroy();
    throw error;
  }
}
