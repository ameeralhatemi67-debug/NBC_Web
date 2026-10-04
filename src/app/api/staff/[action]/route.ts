import { NextRequest, NextResponse } from 'next/server';
import { assertRequest } from '@/lib/request-security';
import { productionOrigin } from '@/lib/runtime';
import {
  beginVercelLogin,
  finishVercelLogin,
  revokeVercelSession,
  flowCookie,
  staffCookie,
  callbackPath,
} from '@/lib/vercel-staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const options = { httpOnly: true, secure: true, path: '/', sameSite: 'lax' as const };
function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export async function GET(request: NextRequest) {
  const origin = productionOrigin();
  if (!origin)
    return noStore(NextResponse.json({ error: 'دخول الموظفين غير مهيأ.' }, { status: 503 }));
  try {
    if (request.nextUrl.pathname === '/api/staff/login') {
      const result = await beginVercelLogin();
      const response = NextResponse.redirect(result.url);
      response.cookies.set(flowCookie, result.cookie, { ...options, maxAge: 600 });
      return noStore(response);
    }
    if (request.nextUrl.pathname !== callbackPath)
      return noStore(NextResponse.json({ error: 'المسار غير موجود.' }, { status: 404 }));
    // Canonical origin, never the internal server hostname or a user-controlled redirect.
    const url = new URL(callbackPath + request.nextUrl.search, origin);
    const result = await finishVercelLogin(url, request.cookies.get(flowCookie)?.value);
    const response = NextResponse.redirect(new URL('/admin', origin));
    response.cookies.set(flowCookie, '', { ...options, maxAge: 0 });
    response.cookies.set(staffCookie, result.value, {
      ...options,
      sameSite: 'strict',
      maxAge: result.seconds,
    });
    return noStore(response);
  } catch {
    const response = NextResponse.redirect(new URL('/admin?login=failed', origin));
    response.cookies.set(flowCookie, '', { ...options, maxAge: 0 });
    return noStore(response);
  }
}
export async function POST(request: NextRequest) {
  try {
    assertRequest(request);
  } catch {
    return noStore(NextResponse.json({ error: 'مصدر الطلب غير مسموح.' }, { status: 403 }));
  }
  if (request.nextUrl.pathname !== '/api/staff/logout')
    return noStore(NextResponse.json({ error: 'المسار غير موجود.' }, { status: 404 }));
  try {
    await revokeVercelSession(request.cookies.get(staffCookie)?.value);
  } catch {
    return noStore(
      NextResponse.json({ error: 'تعذّر إنهاء الجلسة لدى Vercel. أعد المحاولة.' }, { status: 503 }),
    );
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(staffCookie, '', { ...options, sameSite: 'strict', maxAge: 0 });
  response.cookies.set(flowCookie, '', { ...options, maxAge: 0 });
  return noStore(response);
}
