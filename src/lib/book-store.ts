import { createHash, randomUUID } from 'node:crypto';
import type { Database } from './database';
import { AppError } from './domain';
import type { BookVersion } from './competition-domain';
import type { Session } from './service';

// Books uploaded by the committee are kept in the database and moved in chunks, so neither an
// upload nor a download ever needs one large request or response (serverless limits).
export const BOOK_CHUNK_BYTES = 3_000_000;
export const BOOK_MAX_BYTES = 40_000_000;
const SHA = /^[a-f0-9]{64}$/;

function actorOf(s: Session) {
  if (!s || s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return s.actor ?? s.role;
}
const toBuffer = (value: unknown) => Buffer.from(value as Uint8Array);
export const bookPartCount = (size: number) => Math.ceil(size / BOOK_CHUNK_BYTES);

export async function pdfPageCount(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    return (await task.promise).numPages;
  } finally {
    await task.destroy();
  }
}

export class BookStore {
  constructor(private db: Database) {}

  async list(): Promise<BookVersion[]> {
    return (
      await this.db.query<{ body: BookVersion }>(
        'SELECT body FROM book_versions ORDER BY created_at DESC',
      )
    ).rows.map((r) => r.body);
  }

  async start(s: Session, body: Record<string, unknown>) {
    const actor = actorOf(s);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const size = Number(body.sizeBytes);
    const sha = String(body.sha256 ?? '').toLowerCase();
    if (!title || title.length > 160) throw new AppError('اكتب عنوان الكتاب (حتى 160 حرفًا).');
    if (!Number.isInteger(size) || size < 1024 || size > BOOK_MAX_BYTES)
      throw new AppError('حجم الملف غير صالح. الحد الأقصى 40 ميغابايت.');
    if (!SHA.test(sha)) throw new AppError('بصمة الملف غير صالحة.');
    const id = randomUUID();
    await this.db.transaction(async (tx) => {
      // One unfinished upload per administrator keeps abandoned chunks from piling up.
      await tx.query('DELETE FROM book_uploads WHERE actor=$1', [actor]);
      await tx.query(
        'INSERT INTO book_uploads(id,actor,title,sha256,size_bytes,parts) VALUES($1,$2,$3,$4,$5,$6)',
        [id, actor, title, sha, size, bookPartCount(size)],
      );
    });
    return { uploadId: id, chunkBytes: BOOK_CHUNK_BYTES, parts: bookPartCount(size) };
  }

  async chunk(s: Session, uploadId: string, part: number, bytes: Buffer) {
    const actor = actorOf(s);
    const upload = (
      await this.db.query<{ size_bytes: number; parts: number }>(
        'SELECT size_bytes,parts FROM book_uploads WHERE id=$1 AND actor=$2',
        [uploadId, actor],
      )
    ).rows[0];
    if (!upload) throw new AppError('جلسة الرفع غير موجودة.', 404);
    if (!Number.isInteger(part) || part < 0 || part >= upload.parts)
      throw new AppError('رقم الجزء غير صالح.');
    const expected =
      part === upload.parts - 1
        ? upload.size_bytes - BOOK_CHUNK_BYTES * (upload.parts - 1)
        : BOOK_CHUNK_BYTES;
    if (bytes.length !== expected) throw new AppError('حجم الجزء غير مطابق.');
    await this.db.query(
      'INSERT INTO book_upload_chunks(upload_id,part,bytes) VALUES($1,$2,$3) ON CONFLICT(upload_id,part) DO UPDATE SET bytes=excluded.bytes',
      [uploadId, part, bytes],
    );
    return { ok: true };
  }

  // Assembles the chunks, proves the bytes are the declared PDF, and registers an unapproved
  // version. Nothing is attached to a competition until the committee chooses it.
  async finish(s: Session, uploadId: unknown) {
    const actor = actorOf(s);
    const upload = (
      await this.db.query<{
        title: string;
        sha256: string;
        size_bytes: number;
        parts: number;
      }>('SELECT title,sha256,size_bytes,parts FROM book_uploads WHERE id=$1 AND actor=$2', [
        String(uploadId),
        actor,
      ])
    ).rows[0];
    if (!upload) throw new AppError('جلسة الرفع غير موجودة.', 404);
    const chunks = (
      await this.db.query<{ part: number; bytes: Uint8Array }>(
        'SELECT part,bytes FROM book_upload_chunks WHERE upload_id=$1 ORDER BY part',
        [String(uploadId)],
      )
    ).rows;
    if (chunks.length !== upload.parts || chunks.some((c, i) => c.part !== i))
      throw new AppError('لم تكتمل أجزاء الملف. أعد الرفع.', 409);
    const bytes = Buffer.concat(chunks.map((c) => toBuffer(c.bytes)));
    if (bytes.length !== upload.size_bytes)
      throw new AppError('حجم الملف بعد التجميع غير مطابق.', 409);
    if (createHash('sha256').update(bytes).digest('hex') !== upload.sha256)
      throw new AppError('بصمة الملف لا تطابق ما رُفع. أعد الرفع.', 409);
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-')
      throw new AppError('الملف ليس بصيغة PDF.', 400);
    let pageCount: number;
    try {
      pageCount = await pdfPageCount(bytes);
    } catch {
      throw new AppError('تعذّر قراءة ملف PDF. تأكد أنه سليم وغير محمي بكلمة مرور.', 400);
    }
    if (!pageCount || pageCount > 2000) throw new AppError('عدد صفحات الكتاب غير صالح.', 400);
    const book: BookVersion = {
      id: `book-${upload.sha256.slice(0, 12)}`,
      title: upload.title,
      url: `/books/${upload.sha256}.pdf`,
      sha256: upload.sha256,
      pageCount,
      approved: false,
      parts: bookPartCount(bytes.length),
      sizeBytes: bytes.length,
    };
    await this.db.transaction(async (tx) => {
      const exists = (await tx.query('SELECT 1 FROM book_versions WHERE id=$1', [book.id])).rows
        .length;
      if (exists) throw new AppError('هذا الكتاب مسجل بالفعل.', 409);
      await tx.query(
        'INSERT INTO book_files(sha256,bytes,size_bytes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [book.sha256, bytes, bytes.length],
      );
      await tx.query('INSERT INTO book_versions(id,body) VALUES($1,$2)', [
        book.id,
        JSON.stringify(book),
      ]);
      await tx.query('DELETE FROM book_uploads WHERE id=$1', [String(uploadId)]);
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'رفع نسخة كتاب',
        JSON.stringify({ bookId: book.id, sha256: book.sha256, pageCount, size: bytes.length }),
      ]);
    });
    return book;
  }

  async size(sha: string) {
    if (!SHA.test(sha)) return null;
    const row = (
      await this.db.query<{ size_bytes: number }>(
        'SELECT size_bytes FROM book_files WHERE sha256=$1',
        [sha],
      )
    ).rows[0];
    return row ? Number(row.size_bytes) : null;
  }
  // One chunk of a stored book (public: the book itself is public).
  async part(sha: string, index: number) {
    const size = await this.size(sha);
    if (size === null || !Number.isInteger(index) || index < 0 || index >= bookPartCount(size))
      return null;
    const row = (
      await this.db.query<{ chunk: Uint8Array }>(
        'SELECT substring(bytes FROM $2::int FOR $3::int) AS chunk FROM book_files WHERE sha256=$1',
        [sha, index * BOOK_CHUNK_BYTES + 1, BOOK_CHUNK_BYTES],
      )
    ).rows[0];
    return row ? toBuffer(row.chunk) : null;
  }
  async whole(sha: string) {
    const row = (
      await this.db.query<{ bytes: Uint8Array }>('SELECT bytes FROM book_files WHERE sha256=$1', [
        sha,
      ])
    ).rows[0];
    return row ? toBuffer(row.bytes) : null;
  }
}
