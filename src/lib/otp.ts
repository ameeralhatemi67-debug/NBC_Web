import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database } from './database';
import { AppError, normalizeDigits } from './domain';
import { easternCities, genders, stages } from './content';
import {
  generateOtp,
  identityLookup,
  keyedHash,
  maskPhone,
  matchesOtp,
  normalizePhone,
  otpDigest,
  type Purpose,
} from './otp-crypto';
import { otpProvider, type OtpProvider } from './otp-provider';
import { isLocalMode, isProduction } from './runtime';
import { assertOtpActive, configFingerprint, readSetup, saveSetup } from './otp-readiness';
import { lock, rateLimit, securityEvent } from './security-store';

export type OtpContext = { ip: string; actor?: string };
type Challenge = {
  id: string;
  participant_id: string | null;
  purpose: Purpose;
  phone_e164: string;
  phone_hash: string;
  provider: string;
  otp_digest: string | null;
  payload_json: Record<string, string>;
  attempt_count: number;
  send_count: number;
  last_sent_at: Date;
  expires_at: Date;
  used_at: Date | null;
  state: string;
  admin_actor: string | null;
  config_fingerprint: string;
};
const unavailable = () =>
  new AppError('انتهت صلاحية الرمز أو استُخدم. اطلب رمزًا جديدًا.', 400, 'EXPIRED');
const mismatch = () =>
  new AppError(
    'تعذّر مطابقة بيانات الدخول. تحقق من البيانات وأعد المحاولة.',
    400,
    'LOGIN_MISMATCH',
  );
export function textField(body: Record<string, unknown>, key: string, max = 120) {
  if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > max)
    throw new AppError('تحقق من الحقول المطلوبة.');
  return body[key].trim();
}
export function strictKeys(body: Record<string, unknown>, keys: string[]) {
  if (Object.keys(body).some((k) => !keys.includes(k))) throw new AppError('حقول غير مسموحة.');
}
export class OtpService {
  constructor(
    private db: Database,
    private provider: OtpProvider = otpProvider(),
  ) {
    if (isProduction() && provider.name !== 'unifonic')
      throw new AppError('مزود محلي غير مسموح في الإنتاج.', 503);
  }
  private async requestLimit(context: OtpContext, verify = false) {
    await rateLimit(
      this.db,
      `${verify ? 'verify' : 'request'}:${keyedHash('ip', context.ip)}`,
      [{ seconds: 600, max: verify ? 60 : 10 }],
      context.actor,
    );
  }
  async challenge(body: Record<string, unknown>, context: OtpContext, adminTest = false) {
    if (!adminTest) await assertOtpActive(this.db);
    if (adminTest && !context.actor) throw new AppError('سجّل الدخول للمتابعة.', 401);
    strictKeys(
      body,
      adminTest
        ? ['phone']
        : [
            'mode',
            'identity',
            'phone',
            'name',
            'stage',
            'institution',
            'gender',
            'locality',
            'terms',
          ],
    );
    const phone = normalizePhone(textField(body, 'phone', 30));
    let purpose: Purpose = 'ADMIN_TEST',
      participant: string | null = null;
    let payload: Record<string, string> = {};
    if (!adminTest) {
      if (body.mode !== 'login' && body.mode !== 'register')
        throw new AppError('اختر التسجيل أو الدخول.');
      purpose = body.mode === 'login' ? 'LOGIN' : 'REGISTER';
      const identity = identityLookup(textField(body, 'identity', 30));
      const existing = (
        await this.db.query<{ id: string; phone: string }>(
          'SELECT id,phone FROM participants WHERE identity=$1',
          [identity],
        )
      ).rows[0];
      if (purpose === 'LOGIN') {
        if (!existing || existing.phone !== phone) {
          await this.requestLimit(context);
          await securityEvent(this.db, 'login_mismatch');
          throw mismatch();
        }
        participant = existing.id;
      } else {
        if (existing) {
          await this.requestLimit(context);
          throw new AppError(
            'تعذّر إكمال التسجيل بهذه البيانات. جرّب تسجيل الدخول.',
            400,
            'REGISTRATION_UNAVAILABLE',
          );
        }
        const name = textField(body, 'name');
        if (name.split(/\s+/).length < 4) throw new AppError('أدخل الاسم الرباعي كما في الوثيقة.');
        const stage = textField(body, 'stage'),
          gender = textField(body, 'gender'),
          locality = textField(body, 'locality');
        if (
          !stages.includes(stage) ||
          !genders.includes(gender) ||
          !easternCities.includes(locality) ||
          body.terms !== true
        )
          throw new AppError('تحقق من بيانات المشاركة ووافق على الشروط.');
        payload = {
          identity,
          name,
          stage,
          gender,
          locality,
          institution: textField(body, 'institution', 160),
          region: 'الشرقية',
        };
      }
    }
    await this.requestLimit(context);
    return this.issue({ phone, purpose, participant, payload }, context);
  }
  async resend(body: Record<string, unknown>, context: OtpContext, adminTest = false) {
    if (!adminTest) await assertOtpActive(this.db);
    await this.requestLimit(context);
    strictKeys(body, ['challengeId', 'purpose']);
    const id = textField(body, 'challengeId', 80);
    const row = (await this.db.query<Challenge>('SELECT * FROM otp_challenges WHERE id=$1', [id]))
      .rows[0];
    if (
      !row ||
      row.used_at ||
      row.purpose !== body.purpose ||
      (row.purpose === 'ADMIN_TEST') !== adminTest ||
      (adminTest && row.admin_actor !== context.actor) ||
      Date.now() - new Date(row.last_sent_at).getTime() > 86400_000
    )
      throw unavailable();
    return this.issue(
      {
        phone: row.phone_e164,
        purpose: row.purpose,
        participant: row.participant_id,
        payload: row.payload_json,
        previous: id,
      },
      context,
    );
  }
  private async issue(
    input: {
      phone: string;
      purpose: Purpose;
      participant: string | null;
      payload: Record<string, string>;
      previous?: string;
    },
    context: OtpContext,
  ) {
    const phoneHash = keyedHash('phone', input.phone);
    // Charge failed sends too. This prevents provider failures becoming an unlimited retry path.
    await rateLimit(
      this.db,
      'send:' + phoneHash,
      [
        { seconds: 3600, max: 5 },
        { seconds: 86400, max: 10 },
      ],
      context.actor,
    );
    const id = randomUUID();
    let code = generateOtp();
    if (this.provider.name === 'fake' && isLocalMode() && process.env.NBC_DEMO_OTP) {
      if (!/^\d{6}$/.test(process.env.NBC_DEMO_OTP))
        throw new AppError('إعداد الرمز المحلي غير صالح.', 503);
      code = process.env.NBC_DEMO_OTP;
    }
    const fingerprint = configFingerprint();
    const reserved = await this.db.transaction(async (tx) => {
      await lock(tx, 'phone:' + phoneHash);
      const previous = (
        await tx.query<Challenge>(
          `SELECT * FROM otp_challenges WHERE phone_hash=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [phoneHash, input.purpose],
        )
      ).rows[0];
      if (
        input.previous &&
        (!previous ||
          previous.id !== input.previous ||
          previous.used_at ||
          previous.state === 'SUPERSEDED')
      )
        throw unavailable();
      const wait = previous
        ? Math.ceil((new Date(previous.last_sent_at).getTime() + 60000 - Date.now()) / 1000)
        : 0;
      if (wait > 0) throw new AppError('انتظر قبل طلب رمز جديد.', 429, 'COOLDOWN', wait);
      if (this.provider.name !== 'fake' && previous?.otp_digest) {
        while (matchesOtp(previous.otp_digest, previous.id, previous.purpose, code))
          code = generateOtp();
      }
      // A new request invalidates every earlier code for this phone and purpose before sending.
      await tx.query(
        "UPDATE otp_challenges SET state='SUPERSEDED',otp_digest=NULL,payload_json='{}' WHERE phone_hash=$1 AND purpose=$2 AND used_at IS NULL",
        [phoneHash, input.purpose],
      );
      await tx.query(
        `INSERT INTO otp_challenges(id,participant_id,purpose,phone_e164,phone_hash,provider,otp_digest,payload_json,expires_at,request_ip_hash,state,admin_actor,config_fingerprint,send_count)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes',$9,'SENDING',$10,$11,$12)`,
        [
          id,
          input.participant,
          input.purpose,
          input.phone,
          phoneHash,
          this.provider.name,
          otpDigest(id, input.purpose, code),
          JSON.stringify(input.payload),
          keyedHash('ip', context.ip),
          context.actor ?? null,
          fingerprint,
          (previous?.send_count ?? 0) + 1,
        ],
      );
      await securityEvent(tx, 'otp_requested', context.actor);
      return (await tx.query<Challenge>('SELECT * FROM otp_challenges WHERE id=$1', [id])).rows[0];
    });
    try {
      const reference = await this.provider.send({
        phone: input.phone,
        code,
        id,
        purpose: input.purpose,
      });
      await this.db.transaction(async (tx) => {
        await tx.query(
          "UPDATE otp_challenges SET state='SENT',provider_reference=$2 WHERE id=$1 AND state='SENDING'",
          [id, reference],
        );
        await securityEvent(
          tx,
          input.purpose === 'ADMIN_TEST' ? 'test_sent' : 'otp_sent',
          context.actor,
        );
      });
    } catch {
      await this.db.transaction(async (tx) => {
        await tx.query(
          "UPDATE otp_challenges SET state='FAILED',otp_digest=NULL WHERE id=$1 AND state='SENDING'",
          [id],
        );
        await securityEvent(tx, 'provider_failed', context.actor);
      });
      throw new AppError(
        'تعذّر إرسال الرسالة. انتظر دقيقة ثم أعد المحاولة.',
        503,
        'PROVIDER_FAILED',
        60,
      );
    }
    return {
      challengeId: id,
      purpose: input.purpose,
      maskedPhone: maskPhone(input.phone),
      expiresIn: 300,
      expiresAt: new Date(reserved.expires_at).toISOString(),
      resendAfter: 60,
      resendAt: new Date(new Date(reserved.last_sent_at).getTime() + 60000).toISOString(),
      simulation: this.provider.name === 'fake',
    };
  }
  async verify(body: Record<string, unknown>, context: OtpContext, adminTest = false) {
    if (!adminTest) await assertOtpActive(this.db);
    await this.requestLimit(context, true);
    strictKeys(body, ['challengeId', 'code', 'purpose']);
    const id = textField(body, 'challengeId', 80),
      code = normalizeDigits(textField(body, 'code', 12));
    if (!/^\d{6}$/.test(code)) throw new AppError('أدخل رمزًا من ستة أرقام.', 400, 'INVALID_CODE');
    const result = await this.db.transaction(async (tx) => {
      const row = (
        await tx.query<Challenge>('SELECT * FROM otp_challenges WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (
        !row ||
        row.purpose !== body.purpose ||
        (row.purpose === 'ADMIN_TEST') !== adminTest ||
        (adminTest && (!context.actor || row.admin_actor !== context.actor))
      )
        return { error: unavailable() };
      if (row.attempt_count >= 5)
        return {
          error: new AppError('استُنفدت محاولات التحقق. اطلب رمزًا جديدًا.', 400, 'EXHAUSTED'),
        };
      if (
        row.state !== 'SENT' ||
        row.used_at ||
        new Date(row.expires_at).getTime() <= Date.now() ||
        row.config_fingerprint !== configFingerprint()
      )
        return { error: unavailable() };
      if (!row.otp_digest || !matchesOtp(row.otp_digest, id, row.purpose, code)) {
        await tx.query('UPDATE otp_challenges SET attempt_count=attempt_count+1 WHERE id=$1', [id]);
        await securityEvent(tx, adminTest ? 'test_verify_failed' : 'verify_failed', context.actor);
        return {
          error:
            row.attempt_count === 4
              ? new AppError('استُنفدت محاولات التحقق. اطلب رمزًا جديدًا.', 400, 'EXHAUSTED')
              : new AppError('الرمز غير صحيح. تحقق ثم أعد المحاولة.', 400, 'INVALID_CODE'),
        };
      }
      let token: string | undefined;
      if (adminTest) {
        const state = await readSetup(tx, true);
        await saveSetup(tx, {
          ...state,
          testedAt: new Date().toISOString(),
          testedFingerprint: row.config_fingerprint,
        });
      } else {
        let participant = row.participant_id;
        if (row.purpose === 'REGISTER') {
          participant = randomUUID();
          const p = row.payload_json;
          const inserted = await tx.query(
            `INSERT INTO participants(id,identity,name,phone,stage,region,locality,institution,gender)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(identity) DO NOTHING RETURNING id`,
            [
              participant,
              p.identity,
              p.name,
              row.phone_e164,
              p.stage,
              p.region,
              p.locality,
              p.institution,
              p.gender,
            ],
          );
          if (!inserted.rows.length) {
            await tx.query(
              "UPDATE otp_challenges SET state='USED',used_at=now(),otp_digest=NULL,payload_json='{}' WHERE id=$1",
              [id],
            );
            return { error: mismatch() };
          }
        } else if (
          !(
            await tx.query('SELECT id FROM participants WHERE id=$1 AND phone=$2', [
              participant,
              row.phone_e164,
            ])
          ).rows.length
        )
          return { error: mismatch() };
        token = randomBytes(32).toString('hex');
        await tx.query(
          `INSERT INTO sessions(token,participant_id,role,expires_at,auth_source) VALUES($1,$2,'participant',now()+interval '8 hours',$3)`,
          [
            createHash('sha256').update(token).digest('hex'),
            participant,
            this.provider.name === 'fake' ? 'demo' : 'otp',
          ],
        );
      }
      await tx.query(
        "UPDATE otp_challenges SET state='USED',used_at=now(),otp_digest=NULL,payload_json='{}' WHERE id=$1",
        [id],
      );
      await securityEvent(tx, adminTest ? 'test_verified' : 'otp_verified', context.actor);
      return { token };
    });
    // Failure counters must commit before an error is returned.
    if (result.error) throw result.error;
    return result.token;
  }
}
