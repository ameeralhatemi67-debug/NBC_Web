import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database } from './database';
import { AppError } from './domain';
import { genders, stages, universityStage } from './content';
import { assertEligible } from './eligibility';
import { resolveUniversity } from './universities';
import { CompetitionService } from './competition-service';
import { strictKeys, textField } from './otp';
import { identityLookup, keyedHash, normalizePhone } from './otp-crypto';
import { otpEnabled } from './runtime';
import { cleanSource } from './analytics-insights';
import { lock, rateLimit, securityEvent } from './security-store';

export async function authenticateParticipant(
  db: Database,
  body: Record<string, unknown>,
  ip: string,
) {
  if (otpEnabled()) throw new AppError('المسار غير موجود.', 404);
  await rateLimit(db, `direct:${keyedHash('ip', ip, 'IDENTITY_LOOKUP_SECRET')}`, [
    { seconds: 600, max: 10 },
  ]);
  strictKeys(body, [
    'mode',
    'identity',
    'phone',
    'name',
    'stage',
    'institution',
    'universityId',
    'universityStudentId',
    'gender',
    'region',
    'locality',
    'village',
    'backup',
    'terms',
    'source',
  ]);
  if (body.mode !== 'register' && body.mode !== 'login')
    throw new AppError('اختر التسجيل أو الدخول.');
  const identity = identityLookup(textField(body, 'identity', 30));
  const phone = normalizePhone(textField(body, 'phone', 30));
  const policy = await new CompetitionService(db).registrationInfo();
  let profile: Record<string, string> | undefined;
  if (body.mode === 'register') {
    const name = textField(body, 'name');
    if (name.split(/\s+/).length < 4) throw new AppError('أدخل الاسم الرباعي كما في الوثيقة.');
    const stage = textField(body, 'stage');
    const gender = textField(body, 'gender');
    const locality = textField(body, 'locality');
    if (!stages.includes(stage) || !genders.includes(gender) || body.terms !== true)
      throw new AppError('تحقق من بيانات المشاركة ووافق على الشروط.');
    if (!policy.open)
      throw new AppError(
        'أُغلق التسجيل. يمكن لمن سجّل سابقًا تسجيل الدخول.',
        403,
        'REGISTRATION_CLOSED',
      );
    const place = assertEligible(policy.eligibility, body.region, locality);
    profile = {
      name,
      stage,
      gender,
      locality,
      region: place.region,
      ...(stage === universityStage
        ? await resolveUniversity(db, body)
        : {
            institution: textField(body, 'institution', 160),
            universityRef: '',
            universityStudentId: '',
          }),
      source: cleanSource(body.source) ?? '',
    };
  }
  return db.transaction(async (tx) => {
    await lock(tx, 'phone-register:' + keyedHash('phone', phone, 'IDENTITY_LOOKUP_SECRET'));
    const existing = (
      await tx.query<{ id: string; phone: string; erased_at: Date | null }>(
        'SELECT id,phone,erased_at FROM participants WHERE identity=$1 FOR UPDATE',
        [identity],
      )
    ).rows[0];
    let participant: string;
    if (body.mode === 'login') {
      if (!existing || existing.phone !== phone || existing.erased_at)
        throw new AppError('تعذّر إكمال الدخول بهذه البيانات.', 400, 'LOGIN_MISMATCH');
      participant = existing.id;
    } else {
      if (existing)
        throw new AppError(
          'تعذّر إكمال التسجيل بهذه البيانات. جرّب تسجيل الدخول.',
          400,
          'REGISTRATION_UNAVAILABLE',
        );
      const count = (
        await tx.query<{ n: string }>('SELECT count(*) AS n FROM participants WHERE phone=$1', [
          phone,
        ])
      ).rows[0];
      if (Number(count.n) >= policy.maxPerPhone)
        throw new AppError('وصل هذا الرقم إلى الحد المسموح للمشاركات.', 400, 'PHONE_LIMIT');
      participant = randomUUID();
      const p = profile!;
      const inserted = await tx.query(
        'INSERT INTO participants(id,identity,name,phone,stage,region,locality,institution,gender,source,university_ref,university_student_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(identity) DO NOTHING RETURNING id',
        [
          participant,
          identity,
          p.name,
          phone,
          p.stage,
          p.region,
          p.locality,
          p.institution,
          p.gender,
          p.source || null,
          p.universityRef || null,
          p.universityStudentId || null,
        ],
      );
      if (!inserted.rows.length)
        throw new AppError(
          'تعذّر إكمال التسجيل بهذه البيانات. جرّب تسجيل الدخول.',
          400,
          'REGISTRATION_UNAVAILABLE',
        );
    }
    const token = randomBytes(32).toString('hex');
    await tx.query(
      "INSERT INTO sessions(token,participant_id,role,expires_at,auth_source) VALUES($1,$2,'participant',now()+interval '8 hours','direct')",
      [createHash('sha256').update(token).digest('hex'), participant],
    );
    await securityEvent(tx, body.mode === 'login' ? 'direct_login' : 'direct_registration');
    return token;
  });
}
