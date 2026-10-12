import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { AppError } from './domain';
import { isProduction } from './runtime';
import { sessionFor, type Session } from './service';
import { staffSession } from './staff-auth';
import { staffCookie, vercelStaffSession } from './vercel-staff';

export const sessionCookieName = () => (isProduction() ? '__Host-nbc-session' : 'nbc-session');
// Staff routes use the committee identity (Vercel or Cloudflare); everything else the OTP session.
export async function resolveSession(req: NextRequest, route: string): Promise<Session | null> {
  const jar = await cookies();
  if (route.startsWith('admin') || route === 'export') {
    const staff =
      process.env.NBC_STAFF_AUTH === 'vercel'
        ? await vercelStaffSession(jar.get(staffCookie)?.value)
        : await staffSession(req.headers.get('cf-access-jwt-assertion'));
    if (staff) return staff;
  }
  return sessionFor(jar.get(sessionCookieName())?.value);
}
export function requireRole(session: Session | null, allowed: Session['role'][]): Session {
  if (!session) throw new AppError('سجّل الدخول للمتابعة.', 401);
  if (!allowed.includes(session.role)) throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return session;
}
