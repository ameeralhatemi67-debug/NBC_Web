import { CompetitionService } from '@/lib/competition-service';
import { backendReadiness } from '@/lib/backend-readiness';
import type { Stage, WriteEvent } from '@/lib/competition-domain';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { AppError, csvCell } from '@/lib/domain';
import {
  completionMinutes,
  emptyFilters,
  filterParticipants,
  scorePercentage,
} from '@/lib/analytics';
import {
  adminState,
  changeAttempt,
  newSession,
  participantState,
  revokeSession,
  startAttempt,
  updateQuestion,
  updatePrizes,
  readSiteContent,
  updateSiteContent,
} from '@/lib/service';
import { OtpService, strictKeys } from '@/lib/otp';
import { readiness, healthCheck, updateSecurity } from '@/lib/otp-readiness';
import { cleanupSecurity } from '@/lib/security-store';
import { isLocalMode, isProduction, otpEnabled } from '@/lib/runtime';
import { authenticateParticipant } from '@/lib/participant-auth';
import { assertRequest, jsonBody, requestIp } from '@/lib/request-security';
import { requireRole, resolveSession, sessionCookieName } from '@/lib/api-session';
import { ParticipantAdmin } from '@/lib/participant-admin';
import { CampaignHistory } from '@/lib/campaigns';
import { BookStore } from '@/lib/book-store';
import { defaultEligibility } from '@/lib/eligibility';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const role = requireRole;
async function respond(req: NextRequest) {
  try {
    assertRequest(req);
    const cookieName = sessionCookieName();
    const route = req.nextUrl.pathname.replace('/api/', '');
    const jar = await cookies();
    const token = jar.get(cookieName)?.value;
    const session = await resolveSession(req, route);
    let result: unknown;
    let setToken: string | undefined;
    const body = req.method === 'POST' ? await jsonBody(req) : {};
    if (
      req.method === 'POST' &&
      !otpEnabled() &&
      [
        'auth/challenge',
        'auth/resend',
        'auth/verify',
        'admin/security/health',
        'admin/security/test',
        'admin/security/test-verify',
      ].includes(route)
    ) {
      if (route.startsWith('admin/')) role(session, ['admin']);
      throw new AppError('التحقق برمز الجوال متوقف حاليًا.', 503, 'OTP_DISABLED');
    }
    if (req.method === 'GET') {
      if (route === 'session' || route === 'admin/session')
        result = {
          session: session ? { role: session.role, participant_id: session.participant_id } : null,
          demo: isLocalMode(),
          otpEnabled: otpEnabled(),
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
      } else if (route === 'registration-options') {
        // Public: the regions and cities the current competition accepts. The city list is static
        // reference data, so it is still served when the database is unavailable; submitting the
        // form reports the real backend error.
        const info = await getDb()
          .then((db) => new CompetitionService(db).registrationInfo())
          .catch(() => null);
        result = info
          ? { ...info.eligibility, registration: { open: info.open, reason: info.reason } }
          : { ...defaultEligibility, registration: { open: true, reason: null } };
      } else if (route === 'status') {
        // Public: competition state for the home and registration pages.
        result = await new CompetitionService(await getDb()).publicStatus();
      } else if (route === 'site-content') {
        result = await readSiteContent();
      } else if (route === 'admin/site-content') {
        role(session, ['admin']);
        result = await readSiteContent();
      } else if (route === 'admin/participants') {
        const q = req.nextUrl.searchParams;
        result = await new ParticipantAdmin(await getDb()).list(role(session, ['admin']), {
          page: Number(q.get('page') ?? 1),
          q: q.get('q') ?? '',
          stage: q.get('stage') ?? '',
          status: q.get('status') ?? '',
        });
      } else if (route === 'admin/campaigns') {
        result = await new CampaignHistory(await getDb()).list(role(session, ['admin']));
      } else if (route === 'admin/campaign') {
        const q = req.nextUrl.searchParams;
        result = await new CampaignHistory(await getDb()).results(role(session, ['admin']), {
          id: q.get('id') ?? '',
          stage: q.get('stage') ?? '',
          page: Number(q.get('page') ?? 1),
        });
      } else if (route === 'winners') {
        // Public: the committee's published announcement, or `published:false`.
        const announcement = await new CompetitionService(await getDb()).publicWinners(
          req.nextUrl.searchParams.get('competitionId') ?? undefined,
        );
        result = announcement ? { published: true, announcement } : { published: false };
      } else if (route === 'admin/winners') {
        result = await new CompetitionService(await getDb()).winners(role(session, ['admin']));
      } else if (route === 'leaderboard') {
        const q = req.nextUrl.searchParams;
        result = await new CompetitionService(await getDb()).leaderboard(
          q.get('competitionId') ?? undefined,
          q.get('stage') as Stage,
          { page: Number(q.get('page') ?? 1), me: q.get('me') ?? undefined },
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
        const staff = role(session, ['admin']);
        const db = await getDb();
        if (db.kind !== 'pglite')
          throw new AppError('تُدار نسخ PostgreSQL الاحتياطية وفق دليل التشغيل.', 503);
        const blob = await db.dumpDataDir('gzip');
        await db.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
          staff.actor ?? 'demo-admin',
          'نسخة احتياطية',
          'تصدير لقطة خاصة بقاعدة العرض المحلي بصيغة PGlite.',
        ]);
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
        const campaignId = req.nextUrl.searchParams.get('competitionId');
        if (campaignId)
          state.participants = await new CampaignHistory(await getDb()).participants(
            role(session, ['admin']),
            campaignId,
          );
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
            'وقت بدء المحاولة',
            'وقت الإرسال',
            'مدة الإكمال بالدقائق',
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
            p.attempt_started_at ?? '',
            p.submitted_at ?? '',
            completionMinutes(p)?.toFixed(2) ?? '',
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
      if (route === 'auth/direct') {
        setToken = await authenticateParticipant(await getDb(), body, requestIp(req));
        if (token) await revokeSession(token);
        result = { ok: true };
      } else if (route === 'auth/challenge')
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
      } else if (route === 'attempt/reading' || route === 'admin/test-run/reading') {
        strictKeys(body, ['attemptId', 'clientEventId', 'page', 'active']);
        const test = route === 'admin/test-run/reading';
        result = await new CompetitionService(await getDb()).recordReading(
          role(session, [test ? 'admin' : 'participant']),
          body,
          test,
        );
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
      else if (route === 'admin/participants') {
        const service = new ParticipantAdmin(await getDb());
        const staff = role(session, ['admin']);
        if (body.action === 'update') result = await service.update(staff, body);
        else if (body.action === 'erase') result = await service.erase(staff, body);
        else throw new AppError('إجراء غير صالح.');
      } else if (route === 'admin/site-content') {
        result = await updateSiteContent(body, role(session, ['admin']).actor ?? 'admin');
      } else if (route === 'admin/book') {
        const store = new BookStore(await getDb());
        const staff = role(session, ['admin']);
        if (body.action === 'start') result = await store.start(staff, body);
        else if (body.action === 'finish') result = await store.finish(staff, body.uploadId);
        else throw new AppError('إجراء غير صالح.');
      } else if (route === 'admin/winners') {
        const service = new CompetitionService(await getDb());
        const staff = role(session, ['admin']);
        if (body.action === 'save-stage') result = await service.saveWinners(staff, body);
        else if (body.action === 'save-media') result = await service.saveMediaWinner(staff, body);
        else if (body.action === 'publish') result = await service.publishWinners(staff, body);
        else if (body.action === 'withdraw') result = await service.withdrawWinners(staff);
        else throw new AppError('إجراء غير صالح.');
      } else if (route === 'admin/question-credit') {
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
      else if (route === 'admin/questions/approve') {
        strictKeys(body, ['questions', 'reviewed']);
        await new CompetitionService(await getDb()).approveQuestions(
          role(session, ['admin']),
          body,
        );
        result = { ok: true };
      } else if (route === 'admin/question') {
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
