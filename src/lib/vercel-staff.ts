import { createHash } from 'node:crypto';
import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose';
import * as oidc from 'openid-client';
import { productionOrigin, secretReady } from './runtime';
import type { Session } from './service';

export const staffCookie = '__Host-nbc-staff';
export const flowCookie = '__Host-nbc-staff-flow';
const issuer = 'https://vercel.com';
export const callbackPath = '/api/staff/callback';
const subjects = (name: string) =>
  (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
export function vercelStaffRole(subject: string) {
  return subjects('NBC_VERCEL_ADMIN_SUBJECTS').includes(subject)
    ? 'admin'
    : subjects('NBC_VERCEL_EDITOR_SUBJECTS').includes(subject)
      ? 'editor'
      : null;
}
export function vercelStaffReady() {
  return Boolean(
    process.env.NBC_STAFF_AUTH === 'vercel' &&
    productionOrigin() &&
    process.env.VERCEL_APP_CLIENT_ID &&
    secretReady('NBC_STAFF_SESSION_SECRET') &&
    subjects('NBC_VERCEL_ADMIN_SUBJECTS').length &&
    process.env.NBC_STAFF_MFA_CONFIRMED === 'true',
  );
}
function key() {
  if (!vercelStaffReady()) throw new Error('Staff configuration unavailable');
  return createHash('sha256').update(process.env.NBC_STAFF_SESSION_SECRET!).digest();
}
export async function sealStaffCookie(
  kind: 'flow' | 'session',
  payload: JWTPayload,
  seconds: number,
) {
  return new EncryptJWT({ ...payload, kind, client: process.env.VERCEL_APP_CLIENT_ID })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuer('nbc-staff')
    .setAudience(productionOrigin()!)
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .encrypt(key());
}
export async function openStaffCookie(value: string | undefined, kind: 'flow' | 'session') {
  if (!value || value.length > 3800 || !vercelStaffReady()) return null;
  try {
    const { payload } = await jwtDecrypt(value, key(), {
      issuer: 'nbc-staff',
      audience: productionOrigin()!,
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
      requiredClaims: ['iat', 'exp'],
      maxTokenAge: kind === 'flow' ? '10m' : '1h',
    });
    return payload.kind === kind && payload.client === process.env.VERCEL_APP_CLIENT_ID
      ? payload
      : null;
  } catch {
    return null;
  }
}
let cached: { id: string; config: Promise<oidc.Configuration> } | undefined;
export function vercelConfiguration() {
  if (!vercelStaffReady()) throw new Error('Staff configuration unavailable');
  const id = process.env.VERCEL_APP_CLIENT_ID!;
  if (!cached || cached.id !== id) {
    const config = oidc
      .discovery(new URL(issuer), id, undefined, oidc.None(), {
        timeout: 8,
        execute: [oidc.enableNonRepudiationChecks],
      })
      .catch((error) => {
        cached = undefined;
        throw error;
      });
    cached = { id, config };
  }
  return cached.config;
}
export async function beginVercelLogin() {
  const config = await vercelConfiguration();
  const verifier = oidc.randomPKCECodeVerifier(),
    state = oidc.randomState(),
    nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: productionOrigin()! + callbackPath,
    scope: 'openid',
    state,
    nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
  });
  return { url, cookie: await sealStaffCookie('flow', { verifier, state, nonce }, 600) };
}
export async function finishVercelLogin(url: URL, cookie: string | undefined) {
  const flow = await openStaffCookie(cookie, 'flow');
  if (
    !flow ||
    typeof flow.verifier !== 'string' ||
    typeof flow.state !== 'string' ||
    typeof flow.nonce !== 'string'
  )
    throw new Error('Invalid login flow');
  const config = await vercelConfiguration();
  const tokens = await oidc.authorizationCodeGrant(config, url, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  });
  const sub = tokens.claims()?.sub;
  if (!sub || !vercelStaffRole(sub)) throw new Error('Staff account not allowed');
  await oidc.fetchUserInfo(config, tokens.access_token, sub);
  const seconds = Math.min(3600, tokens.expiresIn() ?? 3600);
  if (seconds <= 0) throw new Error('Expired login');
  const value = await sealStaffCookie('session', { sub, access: tokens.access_token }, seconds);
  if (value.length > 3800) throw new Error('Session too large');
  return { value, seconds };
}
export async function vercelStaffSession(value: string | undefined): Promise<Session | null> {
  const session = await openStaffCookie(value, 'session');
  if (!session || typeof session.sub !== 'string' || typeof session.access !== 'string')
    return null;
  const role = vercelStaffRole(session.sub);
  if (!role) return null;
  try {
    // Revalidate with the provider so revoked or expired access tokens cannot keep staff access.
    await oidc.fetchUserInfo(await vercelConfiguration(), session.access, session.sub);
    return {
      role,
      participant_id: null,
      auth_source: 'vercel',
      actor:
        'staff:' +
        createHash('sha256')
          .update(issuer + ':' + session.sub)
          .digest('hex'),
    };
  } catch {
    return null;
  }
}
export async function revokeVercelSession(value: string | undefined) {
  const session = await openStaffCookie(value, 'session');
  if (!session || typeof session.access !== 'string') return;
  const response = await fetch('https://api.vercel.com/login/oauth/token/revoke', {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    body: new URLSearchParams({
      token: session.access,
      client_id: process.env.VERCEL_APP_CLIENT_ID!,
    }),
  });
  if (!response.ok) throw new Error('Staff token revocation failed');
}
