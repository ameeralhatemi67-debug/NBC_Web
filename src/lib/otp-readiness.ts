import { createHash } from 'node:crypto';
import type { Database, Queryable } from './database';
import { AppError } from './domain';
import { isProduction, productionOrigin, secretReady } from './runtime';
import { migrationsCurrent } from './migrations';
import { otpProvider, providerConfigured } from './otp-provider';
import { staffReady } from './staff-auth';
import { rateLimit, securityEvent } from './security-store';
import { keyedHash } from './otp-crypto';

export const acknowledgementKeys = [
  'senderApproved',
  'privacyReviewed',
  'vendorReviewed',
  'transfersReviewed',
  'incidentProcess',
  'retentionReviewed',
] as const;
export type SecuritySetup = {
  active?: boolean;
  fingerprint?: string;
  testedAt?: string;
  testedFingerprint?: string;
  healthAt?: string;
  healthOk?: boolean;
  healthFingerprint?: string;
  acknowledgements?: Partial<Record<(typeof acknowledgementKeys)[number], boolean>>;
};
export function configFingerprint() {
  // Stored only server-side. Any provider/security/deployment change requires a new test and activation.
  return createHash('sha256')
    .update(
      JSON.stringify(
        [
          'DATABASE_URL',
          'NBC_RUNTIME_MODE',
          'OTP_PROVIDER',
          'UNIFONIC_APP_SID',
          'OTP_SENDER_ID',
          'OTP_HMAC_SECRET',
          'IDENTITY_LOOKUP_SECRET',
          'NBC_PUBLIC_ORIGIN',
          'CF_ACCESS_ISSUER',
          'CF_ACCESS_AUD',
          'NBC_ADMIN_SUBJECTS',
          'NBC_EDITOR_SUBJECTS',
          'NBC_STAFF_MFA_CONFIRMED',
          'NBC_STAFF_AUTH',
          'VERCEL_APP_CLIENT_ID',
          'NBC_STAFF_SESSION_SECRET',
          'NBC_VERCEL_ADMIN_SUBJECTS',
          'NBC_VERCEL_EDITOR_SUBJECTS',
          'NBC_TRUSTED_IP_HEADER',
        ].map((k) => process.env[k] ?? ''),
      ),
    )
    .digest('hex');
}
export async function readSetup(db: Queryable, locked = false): Promise<SecuritySetup> {
  return (
    (
      await db.query<{ value: SecuritySetup }>(
        'SELECT value FROM settings WHERE id=$1' + (locked ? ' FOR UPDATE' : ''),
        ['otp_security'],
      )
    ).rows[0]?.value ?? {}
  );
}
export const saveSetup = (db: Queryable, state: SecuritySetup) =>
  db.query('UPDATE settings SET value=$1 WHERE id=$2', [JSON.stringify(state), 'otp_security']);
export async function readiness(db: Database | null) {
  let connected = false,
    current = false,
    limiter = false,
    utf8 = false,
    identityKeyMatches = false;
  let state: SecuritySetup = {};
  try {
    if (!db) throw new Error('Database unavailable');
    await db.query('SELECT 1');
    connected = true;
    utf8 =
      (await db.query<{ server_encoding: string }>('SHOW server_encoding')).rows[0]
        .server_encoding === 'UTF8';
    current = await migrationsCurrent(db);
    await db.query('SELECT key FROM otp_rate_events LIMIT 0');
    limiter = true;
    state = await readSetup(db);
    const keyCheck = (
      await db.query<{ value: string }>('SELECT value FROM settings WHERE id=$1', [
        'identity_key_check',
      ])
    ).rows[0]?.value;
    identityKeyMatches =
      keyCheck === keyedHash('key-check', 'nbc-identity-key', 'IDENTITY_LOOKUP_SECRET');
  } catch {
    /* Return missing readiness, never database diagnostics. */
  }
  const fingerprint = configFingerprint();
  const checks = {
    databaseConnected: connected,
    migrationsCurrent: current,
    durableDatabase: db?.kind === 'postgres',
    databaseUtf8: utf8,
    providerSelected: process.env.OTP_PROVIDER === 'unifonic',
    credentialsConfigured: Boolean(process.env.UNIFONIC_APP_SID?.trim()),
    senderConfigured: /^[A-Za-z0-9 ._-]{2,11}$/.test(process.env.OTP_SENDER_ID ?? ''),
    providerConfigured: providerConfigured(),
    otpSecret: secretReady('OTP_HMAC_SECRET'),
    identitySecret: secretReady('IDENTITY_LOOKUP_SECRET'),
    identityKeyMatches,
    independentSecrets:
      secretReady('OTP_HMAC_SECRET') &&
      process.env.OTP_HMAC_SECRET !== process.env.IDENTITY_LOOKUP_SECRET,
    https: Boolean(productionOrigin()),
    persistentRateLimits: limiter && db?.kind === 'postgres',
    trustedProxy: ['cf-connecting-ip', 'x-vercel-forwarded-for'].includes(
      process.env.NBC_TRUSTED_IP_HEADER ?? '',
    ),
    demoDisabled:
      isProduction() &&
      process.env.OTP_PROVIDER !== 'fake' &&
      !process.env.NBC_DEMO_OTP &&
      process.env.NBC_DEMO_MODE !== 'true' &&
      process.env.NBC_ALLOW_REMOTE_DEMO !== 'true',
    staffAuthentication: staffReady(),
  };
  const configured = Object.values(checks).every(Boolean);
  const health = Boolean(
    state.healthOk &&
    state.healthFingerprint === fingerprint &&
    Date.now() - Date.parse(state.healthAt ?? '') < 3600_000,
  );
  const tested = Boolean(
    state.testedFingerprint === fingerprint &&
    Date.now() - Date.parse(state.testedAt ?? '') < 86400_000,
  );
  const acknowledged = acknowledgementKeys.every((k) => state.acknowledgements?.[k]);
  const active =
    configured &&
    state.healthOk !== false &&
    state.active === true &&
    state.fingerprint === fingerprint &&
    acknowledged;
  const status = active
    ? 'ACTIVE'
    : !configured
      ? 'NOT_CONFIGURED'
      : state.healthOk === false
        ? 'ERROR'
        : tested
          ? 'TESTED'
          : 'CONFIGURED';
  const metrics =
    db && connected && current
      ? (
          await db.query<{
            action: string;
            count: string;
          }>(`SELECT action,count(*)::text AS count FROM security_events
    WHERE created_at >= (date_trunc('day',now() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh') GROUP BY action`)
        ).rows
      : [];
  return {
    status,
    checks,
    health,
    tested,
    canActivate: configured && health && tested && acknowledged,
    acknowledgements: state.acknowledgements ?? {},
    healthAt: state.healthAt ?? null,
    testedAt: state.testedAt ?? null,
    provider: process.env.OTP_PROVIDER === 'unifonic' ? 'Unifonic SMS' : 'غير مهيأ للإنتاج',
    metrics: Object.fromEntries(metrics.map((r) => [r.action, Number(r.count)])),
  };
}
export async function assertOtpActive(db: Database) {
  if (isProduction() && (await readiness(db)).status !== 'ACTIVE')
    throw new AppError(
      'خدمة التحقق قيد الإعداد أو الصيانة. يرجى المحاولة لاحقًا.',
      503,
      'MAINTENANCE',
    );
}
export async function healthCheck(db: Database, actor: string) {
  await rateLimit(db, 'health:' + actor, [{ seconds: 60, max: 3 }], actor);
  const fingerprint = configFingerprint();
  const ok = await otpProvider().healthCheck();
  await db.transaction(async (tx) => {
    const state = await readSetup(tx, true);
    await saveSetup(tx, {
      ...state,
      healthAt: new Date().toISOString(),
      healthOk: ok,
      healthFingerprint: fingerprint,
    });
    await securityEvent(tx, ok ? 'health_ok' : 'health_failed', actor);
  });
  return {
    ok,
    message: ok
      ? 'اتصال واجهة المزود متاح. اختبار الرمز الفعلي مطلوب لإثبات صلاحية الحساب والمرسل والتسليم.'
      : 'تعذّر الاتصال بالمزود.',
  };
}
export async function updateSecurity(db: Database, body: Record<string, unknown>, actor: string) {
  if (body.action === 'activate') {
    await healthCheck(db, actor);
    if (!(await readiness(db)).canActivate)
      throw new AppError('أكمل متطلبات الجاهزية والاختبار أولًا.', 409);
  }
  await db.transaction(async (tx) => {
    const state = await readSetup(tx, true);
    if (body.action === 'acknowledge') {
      const input = body.acknowledgements;
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (k) => !acknowledgementKeys.includes(k as (typeof acknowledgementKeys)[number]),
        ) ||
        Object.values(input).some((v) => typeof v !== 'boolean')
      )
        throw new AppError('قائمة جاهزية غير صالحة.');
      state.acknowledgements = input;
      state.active = false;
    } else if (body.action === 'activate') {
      if (
        !acknowledgementKeys.every((k) => state.acknowledgements?.[k]) ||
        state.testedFingerprint !== configFingerprint() ||
        Date.now() - Date.parse(state.testedAt ?? '') >= 86400_000 ||
        !state.healthOk
      )
        throw new AppError('تغيرت الجاهزية. أعد الاختبار.', 409);
      state.active = true;
      state.fingerprint = configFingerprint();
    } else if (body.action === 'deactivate') state.active = false;
    else throw new AppError('إجراء غير صالح.');
    await saveSetup(tx, state);
    await securityEvent(tx, 'setup_' + body.action, actor);
  });
  return readiness(db);
}
