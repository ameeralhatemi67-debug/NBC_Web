import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from './domain';
import type { Session } from './service';

function issuer() {
  const value = process.env.CF_ACCESS_ISSUER ?? '';
  return /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(value) ? value : null;
}
const subjects = (name: string) =>
  (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
export function staffReady() {
  return Boolean(
    issuer() &&
    process.env.CF_ACCESS_AUD &&
    subjects('NBC_ADMIN_SUBJECTS').length &&
    process.env.NBC_STAFF_MFA_CONFIRMED === 'true',
  );
}
let cached: { issuer: string; keys: JWTVerifyGetKey } | undefined;
export async function staffSession(
  assertion: string | null,
  testKeys?: JWTVerifyGetKey,
): Promise<Session | null> {
  if (!assertion) return null;
  if (!staffReady() || assertion.length > 16000) throw new AppError('دخول الموظفين غير مهيأ.', 503);
  const iss = issuer()!;
  if (!cached || cached.issuer !== iss)
    cached = {
      issuer: iss,
      keys: createRemoteJWKSet(new URL(iss + '/cdn-cgi/access/certs'), { timeoutDuration: 5000 }),
    };
  try {
    const { payload } = await jwtVerify(assertion, testKeys ?? cached.keys, {
      issuer: iss,
      audience: process.env.CF_ACCESS_AUD,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'type'],
      maxTokenAge: '8h',
    });
    if (payload.type !== 'app' || typeof payload.sub !== 'string')
      throw new Error('Not a human application token');
    const role = subjects('NBC_ADMIN_SUBJECTS').includes(payload.sub)
      ? 'admin'
      : subjects('NBC_EDITOR_SUBJECTS').includes(payload.sub)
        ? 'editor'
        : null;
    if (!role) throw new Error('Not allowed');
    return {
      role,
      participant_id: null,
      auth_source: 'cloudflare-access',
      actor:
        'staff:' +
        createHash('sha256')
          .update(iss + ':' + payload.sub)
          .digest('hex'),
    };
  } catch {
    throw new AppError('تعذّر التحقق من صلاحية الموظف.', 403);
  }
}
