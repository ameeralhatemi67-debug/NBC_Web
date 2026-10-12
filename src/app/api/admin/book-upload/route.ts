import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AppError } from '@/lib/domain';
import { BOOK_CHUNK_BYTES, BookStore } from '@/lib/book-store';
import { assertRequest } from '@/lib/request-security';
import { requireRole, resolveSession } from '@/lib/api-session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One chunk of a book upload as raw bytes (a JSON body would be too small and too large at once).
export async function POST(req: NextRequest) {
  try {
    assertRequest(req, { binary: true });
    const staff = requireRole(await resolveSession(req, 'admin/book-upload'), ['admin']);
    const id = req.nextUrl.searchParams.get('id') ?? '';
    const part = Number(req.nextUrl.searchParams.get('part'));
    if (Number(req.headers.get('content-length') ?? 0) > BOOK_CHUNK_BYTES + 1024)
      throw new AppError('الجزء أكبر من الحد المسموح.', 413);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length > BOOK_CHUNK_BYTES) throw new AppError('الجزء أكبر من الحد المسموح.', 413);
    const result = await new BookStore(await getDb()).chunk(staff, id, part, bytes);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    console.error('NBC book upload failure');
    return NextResponse.json(
      { error: 'تعذّر رفع الجزء. حاول مرة أخرى.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
