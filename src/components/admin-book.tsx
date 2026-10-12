'use client';
import { useRef, useState, type FormEvent } from 'react';
import type { BookVersion, Competition } from '@/lib/competition-domain';
import { effectiveState } from '@/lib/competition-domain';
import { api, ErrorMessage } from './ui';

type Mutation = (path: string, body: unknown, message: string) => Promise<unknown>;
const CHUNK = 3_000_000;
const megabytes = (bytes?: number) =>
  bytes ? `${(bytes / 1_000_000).toFixed(1)} ميغابايت` : 'الملف المرفق مع التطبيق';
async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Register a new book version and attach it to the draft competition. Files are uploaded in
// small parts, verified by SHA-256 and page count on the server, and start unapproved.
export function AdminBook({
  competition,
  book,
  books,
  busy,
  mutate,
  onChanged,
}: {
  competition: Competition;
  book: BookVersion;
  books: BookVersion[];
  busy: boolean;
  mutate: Mutation;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const canChange = effectiveState(competition) === 'DRAFT' && !competition.frozenAt;
  const uploading = progress !== null;

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setError('');
    setNotice('');
    setProgress(0);
    try {
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      const started = await api<{ uploadId: string; parts: number }>('admin/book', {
        action: 'start',
        title: title.trim(),
        sizeBytes: file.size,
        sha256,
      });
      for (let part = 0; part < started.parts; part++) {
        const response = await fetch(
          `/api/admin/book-upload?id=${encodeURIComponent(started.uploadId)}&part=${part}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: bytes.slice(part * CHUNK, (part + 1) * CHUNK),
          },
        );
        if (!response.ok)
          throw new Error(
            ((await response.json().catch(() => ({}))) as { error?: string }).error ??
              'تعذّر رفع جزء من الملف.',
          );
        setProgress(Math.round(((part + 1) / (started.parts + 1)) * 100));
      }
      const created = await api<BookVersion>('admin/book', {
        action: 'finish',
        uploadId: started.uploadId,
      });
      setNotice(`سُجّل الكتاب «${created.title}» (${created.pageCount} صفحة). لم يُعتمد بعد.`);
      setTitle('');
      setFile(null);
      if (input.current) input.current.value = '';
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  return (
    <section className="admin-panel book-admin">
      <ErrorMessage message={error} />
      {notice && (
        <div role="status" className="success-message">
          {notice}
        </div>
      )}
      <section className="launch-card">
        <h3>كتاب المسابقة الحالية</h3>
        <p>
          <strong>{book.title}</strong> · {book.pageCount} صفحة · {megabytes(book.sizeBytes)} ·{' '}
          {book.approved ? 'معتمد' : 'بانتظار الاعتماد'}
        </p>
        <details className="check-details">
          <summary>بصمة الملف SHA-256</summary>
          <code className="checksum">{book.sha256}</code>
        </details>
        {!canChange && (
          <p className="field-hint">
            لا يمكن تغيير الكتاب بعد اعتماد نسخة الأسئلة. أنشئ مسابقة جديدة لكتاب جديد.
          </p>
        )}
      </section>
      <section className="launch-card">
        <h3>نسخ الكتاب المسجلة</h3>
        <ul className="book-versions">
          {books.map((b) => (
            <li key={b.id}>
              <div>
                <strong>{b.title}</strong>
                <small>
                  {b.pageCount} صفحة · {megabytes(b.sizeBytes)}
                  {b.approved && ' · معتمد'}
                </small>
              </div>
              {b.id === competition.bookVersionId ? (
                <span className="badge success">المستخدم الآن</span>
              ) : (
                <button
                  type="button"
                  className="button outline"
                  disabled={busy || !canChange}
                  onClick={() =>
                    void mutate(
                      'admin/competition',
                      { action: 'set-book', bookVersionId: b.id, version: competition.version },
                      'ربط الكتاب بالمسابقة الحالية.',
                    )
                  }
                >
                  استخدم لهذه المسابقة
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="field-hint">
          الأسئلة مرتبطة بنسخة الكتاب. عند تغيير الكتاب يبدأ بنك أسئلة النسخة الجديدة فارغًا، وتبقى
          أسئلة النسخ السابقة محفوظة. تغطية الصفحات والتلميحات تُراجع من جديد.
        </p>
      </section>
      <form className="launch-card" onSubmit={upload}>
        <h3>رفع نسخة كتاب جديدة</h3>
        <label>
          عنوان الكتاب
          <input
            value={title}
            maxLength={160}
            disabled={uploading}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          ملف PDF (حتى 40 ميغابايت)
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {uploading && (
          <div
            className="check-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress ?? 0}
            aria-label="تقدم الرفع"
          >
            <b style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="launch-actions">
          <button
            className="button primary"
            type="submit"
            disabled={uploading || !file || !title.trim()}
          >
            {uploading ? 'جارٍ الرفع والتحقق…' : 'رفع الكتاب'}
          </button>
        </div>
        <p className="field-hint">
          يُتحقق من أن الملف PDF سليم وتُحسب صفحاته وبصمته. لا يُستخدم الكتاب في المسابقة حتى تربطه
          بها وتعتمده.
        </p>
      </form>
    </section>
  );
}
