import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { AppError, csvCell } from '@/lib/domain';
import {
  adminState,
  challenge,
  changeAttempt,
  newSession,
  participantState,
  revokeSession,
  sessionFor,
  startAttempt,
  updateQuestion,
  verify,
  type Session,
} from '@/lib/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cookieName = 'nbc-session';
function assertDemo(req: NextRequest) {
  if (process.env.NBC_DEMO_MODE === 'false')
    throw new AppError('هذه النسخة مخصصة للعرض المحلي فقط.', 503);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(req.nextUrl.hostname);
  const allowRemote = process.env.NBC_ALLOW_REMOTE_DEMO === 'true' || Boolean(process.env.VERCEL);
  if (!isLocal && !allowRemote)
    throw new AppError('العرض متاح محليًا فقط.', 403);
}
function role(session: Session | null, allowed: Session['role'][]): Session {
  if (!session) throw new AppError('سجّل الدخول للمتابعة.', 401);
  if (!allowed.includes(session.role)) throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return session;
}
async function respond(req: NextRequest) {
  try {
    assertDemo(req);
    if (req.method === 'POST') {
      const origin = req.headers.get('origin');
      const host = req.headers.get('host');
      if (origin && host) {
        try {
          if (new URL(origin).host !== host) throw new AppError('مصدر الطلب غير مسموح.', 403);
        } catch (e) {
          if (e instanceof AppError) throw e;
          throw new AppError('مصدر الطلب غير مسموح.', 403);
        }
      }
      if (Number(req.headers.get('content-length') || 0) > 24000)
        throw new AppError('الطلب أكبر من الحد المسموح.', 413);
    }
    const route = req.nextUrl.pathname.replace('/api/', '');
    const jar = await cookies();
    const token = jar.get(cookieName)?.value;
    const session = await sessionFor(token);
    let result: unknown;
    let setToken: string | undefined;
    const body = req.method === 'POST' ? await req.json() : {};
    if (req.method === 'GET') {
      if (route === 'session') result = { session };
      else if (route === 'participant')
        result = await participantState(role(session, ['participant']));
      else if (route === 'admin') {
        const staff = role(session, ['admin', 'editor']);
        const state = await adminState();
        result =
          staff.role === 'editor'
            ? { ...state, participants: [], audit: [], published: false }
            : state;
      } else if (route === 'admin/backup') {
        role(session, ['admin']);
        const db = await getDb();
        await db.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
          'admin',
          'نسخة احتياطية',
          'تصدير لقطة خاصة بقاعدة العرض المحلي بصيغة PGlite.',
        ]);
        const blob = await db.dumpDataDir('gzip');
        return new NextResponse(await blob.arrayBuffer(), {
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': 'attachment; filename="nbc-demo-backup.tar.gz"',
            'Cache-Control': 'no-store',
          },
        });
      } else if (route === 'export') {
        role(session, ['admin']);
        const state = await adminState();
        const stage = req.nextUrl.searchParams.get('stage');
        const region = req.nextUrl.searchParams.get('region');
        const rows = state.participants.filter(
          (p) => (!stage || p.stage === stage) && (!region || p.region === region),
        );
        const csv = [
          [
            'الاسم (بيانات افتراضية)',
            'المرحلة',
            'المنطقة',
            'المحافظة',
            'القرية / المركز',
            'حالة المشاركة',
            'الدرجة',
          ],
          ...rows.map((p) => [
            p.name,
            p.stage,
            p.region,
            p.locality,
            p.village,
            p.submitted_at ? 'مكتملة' : p.attempt_id ? 'قيد المشاركة' : 'لم تبدأ',
            p.score ?? '',
          ]),
        ]
          .map((row) => row.map(csvCell).join(','))
          .join('\r\n');
        return new NextResponse('\uFEFF' + csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="nbc-demo-report.csv"',
            'Cache-Control': 'no-store',
          },
        });
      } else throw new AppError('المسار غير موجود.', 404);
    } else {
      if (route === 'auth/challenge') result = await challenge(body);
      else if (route === 'auth/verify') {
        setToken = await verify(String(body.challengeId), String(body.code));
        result = { ok: true };
      } else if (route === 'auth/demo-staff') {
        if (!['admin', 'editor'].includes(body.role)) throw new AppError('دور غير صالح.');
        setToken = await newSession(body.role);
        result = { ok: true };
      } else if (route === 'auth/logout') {
        if (token) await revokeSession(token);
        jar.delete(cookieName);
        result = { ok: true };
      } else if (route === 'attempt/start')
        result = await startAttempt(role(session, ['participant']));
      else if (route === 'attempt/save')
        result = await changeAttempt(role(session, ['participant']), body);
      else if (route === 'attempt/submit')
        result = await changeAttempt(role(session, ['participant']), body, true);
      else if (route === 'admin/question') {
        await updateQuestion(role(session, ['admin', 'editor']), body);
        result = { ok: true };
      } else if (route === 'admin/publish') {
        role(session, ['admin']);
        const db = await getDb();
        await db.transaction(async (tx) => {
          await tx.query('UPDATE settings SET value=$1 WHERE id=$2', [
            JSON.stringify(body.published === true),
            'published',
          ]);
          await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
            'admin',
            body.published ? 'نشر الدرجات' : 'حجب الدرجات',
            'اعتماد الدرجات فقط؛ اختيار الفائزين وحالات التعادل قيد قرار اللجنة.',
          ]);
        });
        result = { ok: true };
      } else if (route === 'admin/reminders') {
        role(session, ['admin']);
        const db = await getDb();
        const rows = (
          await db.query(
            'SELECT p.name FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id WHERE a.submitted_at IS NULL ORDER BY p.name',
          )
        ).rows;
        result = {
          recipients: rows,
          message:
            'ندعوك لإكمال مشاركتك في المسابقة خلال الفترة المعتمدة. يمكنك العودة إلى إجاباتك المحفوظة.',
          sent: false,
        };
      } else throw new AppError('المسار غير موجود.', 404);
    }
    if (setToken)
      jar.set(cookieName, setToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: req.nextUrl.protocol === 'https:',
        maxAge: 8 * 3600,
        path: '/',
      });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    console.error('NBC API failure', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'تعذّر إتمام الطلب. حاول مرة أخرى.' }, { status: 500 });
  }
}
export const GET = respond;
export const POST = respond;
