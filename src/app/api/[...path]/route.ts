import { CompetitionService } from '@/lib/competition-service';
import { backendReadiness } from '@/lib/backend-readiness';
import type { Stage, WriteEvent } from '@/lib/competition-domain';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { AppError, csvCell } from '@/lib/domain';
import { emptyFilters, filterParticipants, scorePercentage } from '@/lib/analytics';
import {
  adminState,
  changeAttempt,
  newSession,
  participantState,
  revokeSession,
  sessionFor,
  startAttempt,
  updateQuestion,
  updatePrizes,
  type Session,
} from '@/lib/service';
import { OtpService, strictKeys } from '@/lib/otp';
import { readiness, healthCheck, updateSecurity } from '@/lib/otp-readiness';
import { cleanupSecurity } from '@/lib/security-store';
import { isProduction, isLocalMode } from '@/lib/runtime';
import { staffSession } from '@/lib/staff-auth';
import { staffCookie, vercelStaffSession } from '@/lib/vercel-staff';
import { assertRequest, jsonBody, requestIp } from '@/lib/request-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function role(session: Session | null, allowed: Session['role'][]): Session {
  if (!session) throw new AppError('سجّل الدخول للمتابعة.', 401);
  if (!allowed.includes(session.role)) throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return session;
}
async function respond(req: NextRequest) {
  try {
    assertRequest(req);
    const cookieName = isProduction() ? '__Host-nbc-session' : 'nbc-session';
    const route = req.nextUrl.pathname.replace('/api/', '');
    const jar = await cookies();
    const token = jar.get(cookieName)?.value;
    let session: Session | null = null;
    if (route.startsWith('admin') || route === 'export') {
      const staff =
        process.env.NBC_STAFF_AUTH === 'vercel'
          ? await vercelStaffSession(jar.get(staffCookie)?.value)
          : await staffSession(req.headers.get('cf-access-jwt-assertion'));
      if (staff) session = staff;
    }
    if (!session) session = await sessionFor(token);
    let result: unknown;
    let setToken: string | undefined;
    const body = req.method === 'POST' ? await jsonBody(req) : {};
    if (req.method === 'GET') {
      if (route === 'session' || route === 'admin/session')
        result = {
          session: session ? { role: session.role, participant_id: session.participant_id } : null,
          demo: isLocalMode(),
        };
      else if (route === 'admin/security') {
        role(session, ['admin']);
        result = await readiness(await getDb().catch(() => null));
      } else if (route === 'admin/backend') {
        role(session, ['admin']);
        result = await backendReadiness(await getDb());
      } else if (route === 'participant')
        result = await participantState(
          role(session, ['participant']),
          req.nextUrl.searchParams.get('competitionId') ?? undefined,
        );
      else if (route === 'admin') {
        const staff = role(session, ['admin', 'editor']);
        const state = {
          ...(await adminState()),
          ...(await new CompetitionService(await getDb()).admin(staff)),
        };
        result =
          staff.role === 'editor'
            ? { ...state, participants: [], audit: [], published: false }
            : state;
      } else if (route === 'leaderboard') {
        result = await new CompetitionService(await getDb()).leaderboard(
          req.nextUrl.searchParams.get('competitionId') ?? undefined,
          req.nextUrl.searchParams.get('stage') as Stage,
        );
      } else if (route === 'admin/test-run/leaderboard') {
        result = await new CompetitionService(await getDb()).testLeaderboard(
          role(session, ['admin']),
          req.nextUrl.searchParams.get('id') ?? '',
        );
      } else if (route === 'admin/test-run') {
        result = await new CompetitionService(await getDb()).testState(
          role(session, ['admin']),
          req.nextUrl.searchParams.get('id') ?? '',
        );
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
        const filters = Object.fromEntries(
          Object.keys(emptyFilters).map((key) => [key, req.nextUrl.searchParams.get(key) || '']),
        );
        const rows = filterParticipants(state.participants, filters);
        const csv = [
          [
            isLocalMode() ? 'الاسم (بيانات افتراضية)' : 'الاسم',
            'المرحلة',
            'أسم المدرسة/الجامعة',
            'الجنس',
            'المنطقة',
            'المحافظة',
            'القرية / المركز',
            'حالة المشاركة',
            'الدرجة',
            'عدد الأسئلة',
            'نسبة الدرجة',
            'تاريخ التسجيل',
          ],
          ...rows.map((p) => [
            p.name,
            p.stage,
            p.institution,
            p.gender,
            p.region,
            p.locality,
            p.village,
            p.submitted_at ? 'مكتملة' : p.attempt_id ? 'قيد المشاركة' : 'لم تبدأ',
            p.score ?? '',
            p.max_score ?? '',
            scorePercentage(p) === null ? '' : scorePercentage(p)!.toFixed(2) + '%',
            p.created_at,
          ]),
        ]
          .map((row) => row.map(csvCell).join(','))
          .join('\r\n');
        return new NextResponse('\uFEFF' + csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${isLocalMode() ? 'nbc-demo-report' : 'nbc-report'}.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      } else throw new AppError('المسار غير موجود.', 404);
    } else {
      if (route === 'auth/challenge')
        result = await new OtpService(await getDb()).challenge(body, { ip: requestIp(req) });
      else if (route === 'auth/resend')
        result = await new OtpService(await getDb()).resend(body, { ip: requestIp(req) });
      else if (route === 'auth/verify') {
        setToken = await new OtpService(await getDb()).verify(body, { ip: requestIp(req) });
        if (token) await revokeSession(token);
        result = { ok: true };
      } else if (route === 'auth/demo-staff') {
        if (!isLocalMode()) throw new AppError('المسار غير موجود.', 404);
        strictKeys(body, ['role']);
        if (!['admin', 'editor'].includes(String(body.role))) throw new AppError('دور غير صالح.');
        setToken = await newSession(body.role as 'admin' | 'editor');
        result = { ok: true };
      } else if (route.startsWith('admin/security/')) {
        const staff = role(session, ['admin']);
        const actor = staff.actor ?? 'demo-admin';
        const db = await getDb();
        if (route === 'admin/security/health') {
          strictKeys(body, []);
          result = await healthCheck(db, actor);
        } else if (route === 'admin/security/setup') {
          strictKeys(body, ['action', 'acknowledgements']);
          result = await updateSecurity(db, body, actor);
        } else if (route === 'admin/security/test')
          result = await new OtpService(db).challenge(body, { ip: requestIp(req), actor }, true);
        else if (route === 'admin/security/test-verify') {
          await new OtpService(db).verify(body, { ip: requestIp(req), actor }, true);
          result = { ok: true };
        } else if (route === 'admin/security/cleanup') {
          strictKeys(body, []);
          await cleanupSecurity(db);
          result = { ok: true };
        } else throw new AppError('المسار غير موجود.', 404);
      } else if (route === 'auth/logout') {
        if (token) await revokeSession(token);
        jar.delete(cookieName);
        result = { ok: true };
      } else if (route === 'attempt/start') {
        strictKeys(body, []);
        result = await startAttempt(role(session, ['participant']));
      } else if (route === 'attempt/save') {
        strictKeys(body, [
          'clientEventId',
          'attemptId',
          'kind',
          'questionId',
          'selected',
          'revision',
        ]);
        result = await changeAttempt(role(session, ['participant']), body);
      } else if (route === 'attempt/event' || route === 'attempt/submit') {
        strictKeys(body, [
          'clientEventId',
          'attemptId',
          'kind',
          'questionId',
          'selected',
          'revision',
        ]);
        result = await changeAttempt(role(session, ['participant']), body);
      } else if (route === 'admin/competition')
        result = await new CompetitionService(await getDb()).configure(
          role(session, ['admin']),
          body,
        );
      else if (route === 'admin/question-credit') {
        await new CompetitionService(await getDb()).creditInvalidQuestion(
          role(session, ['admin']),
          body,
        );
        result = { ok: true };
      } else if (route === 'admin/recovery') {
        await new CompetitionService(await getDb()).recover(role(session, ['admin']), body);
        result = { ok: true };
      } else if (route === 'admin/test-run/start')
        result = await new CompetitionService(await getDb()).startTest(
          role(session, ['admin']),
          body,
        );
      else if (route === 'admin/test-run/reset')
        result = await new CompetitionService(await getDb()).resetTest(
          role(session, ['admin']),
          String(body.id),
        );
      else if (route === 'admin/test-run/event')
        result = await new CompetitionService(await getDb()).write(
          role(session, ['admin']),
          body as unknown as WriteEvent,
          true,
        );
      else if (route === 'admin/question') {
        await updateQuestion(role(session, ['admin', 'editor']), body);
        result = { ok: true };
      } else if (route === 'admin/prizes') {
        const staff = role(session, ['admin']);
        result = { prizes: await updatePrizes(body, staff.actor ?? 'admin') };
      } else if (route === 'admin/publish') {
        result = await new CompetitionService(await getDb()).configure(role(session, ['admin']), {
          ...body,
          action: body.published === true ? 'publish' : 'unpublish',
        });
      } else if (route === 'admin/reminders') {
        role(session, ['admin']);
        const db = await getDb();
        const rows = (
          await db.query(
            "SELECT p.name FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id AND a.competition_id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition') WHERE a.submitted_at IS NULL ORDER BY p.name",
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
        secure: isProduction() || req.nextUrl.protocol === 'https:',
        maxAge: 8 * 3600,
        path: '/',
      });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message, code: error.code, retryAfter: error.retryAfter },
        {
          status: error.status,
          headers: {
            'Cache-Control': 'no-store',
            ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}),
          },
        },
      );
    console.error('NBC API failure');
    return NextResponse.json(
      { error: 'تعذّر إتمام الطلب. حاول مرة أخرى.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export const GET = respond;
export const POST = respond;
