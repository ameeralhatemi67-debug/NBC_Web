import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { BookStore } from '@/lib/book-store';
export const runtime = 'nodejs';

// Public, immutable chunk of a stored book. The reader joins the parts and checks the SHA-256.
export async function GET(_req: Request, ctx: { params: Promise<{ sha: string; part: string }> }) {
  const { sha, part } = await ctx.params;
  try {
    const bytes = await new BookStore(await getDb()).part(sha, Number(part));
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(bytes.length),
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
