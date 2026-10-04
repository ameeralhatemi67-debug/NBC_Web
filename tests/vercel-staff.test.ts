import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import {
  beginVercelLogin,
  finishVercelLogin,
  openStaffCookie,
  sealStaffCookie,
  vercelStaffSession,
  revokeVercelSession,
  vercelStaffReady,
} from '../src/lib/vercel-staff';
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let privateKey: CryptoKey;
let nonce = '',
  challenge = '',
  subject = 'owner',
  tokenAudience = 'test-client',
  revoked = false;
before(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'vercel-test', alg: 'RS256' };
  Object.assign(process.env, {
    NBC_STAFF_AUTH: 'vercel',
    VERCEL_APP_CLIENT_ID: 'test-client',
    NBC_STAFF_SESSION_SECRET: randomBytes(32).toString('hex'),
    NBC_VERCEL_ADMIN_SUBJECTS: 'owner',
    NBC_VERCEL_EDITOR_SUBJECTS: 'editor',
    NBC_STAFF_MFA_CONFIRMED: 'true',
    NBC_PUBLIC_ORIGIN: 'https://nbc.example',
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://vercel.com/.well-known/openid-configuration')
      return Response.json({
        issuer: 'https://vercel.com',
        authorization_endpoint: 'https://vercel.com/oauth/authorize',
        token_endpoint: 'https://api.vercel.com/login/oauth/token',
        userinfo_endpoint: 'https://api.vercel.com/login/oauth/userinfo',
        jwks_uri: 'https://vercel.com/jwks',
        id_token_signing_alg_values_supported: ['RS256'],
      });
    if (url === 'https://vercel.com/jwks') return Response.json({ keys: [jwk] });
    if (url === 'https://api.vercel.com/login/oauth/token') {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get('redirect_uri'), 'https://nbc.example/api/staff/callback');
      assert.equal(
        createHash('sha256').update(body.get('code_verifier')!).digest('base64url'),
        challenge,
      );
      const id_token = await new SignJWT({ nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'vercel-test' })
        .setIssuer('https://vercel.com')
        .setAudience(tokenAudience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
      return Response.json({
        token_type: 'Bearer',
        access_token: 'memory-only-access',
        expires_in: 3600,
        id_token,
      });
    }
    if (url === 'https://api.vercel.com/login/oauth/userinfo')
      return revoked
        ? Response.json({ error: 'invalid_token' }, { status: 401 })
        : Response.json({ sub: subject });
    if (url === 'https://api.vercel.com/login/oauth/token/revoke') {
      revoked = true;
      return new Response(null, { status: 200 });
    }
    throw new Error('Unexpected network request');
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});
async function begin() {
  const result = await beginVercelLogin();
  nonce = result.url.searchParams.get('nonce')!;
  challenge = result.url.searchParams.get('code_challenge')!;
  return {
    ...result,
    callback: new URL(
      'https://nbc.example/api/staff/callback?code=test&state=' +
        result.url.searchParams.get('state'),
    ),
  };
}
test('Vercel login requires configured secrets, canonical origin, MFA acknowledgment and allowlist', () => {
  assert.equal(vercelStaffReady(), true);
  process.env.NBC_STAFF_MFA_CONFIRMED = 'false';
  assert.equal(vercelStaffReady(), false);
  process.env.NBC_STAFF_MFA_CONFIRMED = 'true';
});
test('OAuth uses only openid, state, nonce and S256; callback verifies provider identity and encrypted cookie', async () => {
  const flow = await begin();
  assert.equal(flow.url.searchParams.get('scope'), 'openid');
  assert.equal(flow.url.searchParams.get('code_challenge_method'), 'S256');
  const session = await finishVercelLogin(flow.callback, flow.cookie);
  assert.equal((await vercelStaffSession(session.value))?.role, 'admin');
  assert.equal(session.value.includes('memory-only-access'), false);
  assert.equal(await openStaffCookie(session.value, 'flow'), null);
  assert.equal(await vercelStaffSession(session.value.slice(0, -20) + 'forged'), null);
  await revokeVercelSession(session.value);
  assert.equal(await vercelStaffSession(session.value), null);
  revoked = false;
});
test('OAuth rejects state/nonce/audience mismatch and unauthorized accounts', async () => {
  let flow = await begin();
  flow.callback.searchParams.set('state', 'forged');
  await assert.rejects(finishVercelLogin(flow.callback, flow.cookie));
  flow = await begin();
  nonce = 'wrong-nonce';
  await assert.rejects(finishVercelLogin(flow.callback, flow.cookie));
  flow = await begin();
  tokenAudience = 'another-app';
  await assert.rejects(finishVercelLogin(flow.callback, flow.cookie));
  tokenAudience = 'test-client';
  flow = await begin();
  subject = 'stranger';
  await assert.rejects(finishVercelLogin(flow.callback, flow.cookie));
  subject = 'owner';
});
test('Current allowlists and online subject checks determine roles; expired and rotated-key cookies fail', async () => {
  let value = await sealStaffCookie('session', { sub: 'editor', access: 'memory-only-access' }, 60);
  subject = 'editor';
  assert.equal((await vercelStaffSession(value))?.role, 'editor');
  process.env.NBC_VERCEL_EDITOR_SUBJECTS = '';
  assert.equal(await vercelStaffSession(value), null);
  subject = 'owner';
  value = await sealStaffCookie('session', { sub: 'owner', access: 'memory-only-access' }, -1);
  assert.equal(await vercelStaffSession(value), null);
  value = await sealStaffCookie('session', { sub: 'owner', access: 'memory-only-access' }, 60);
  subject = 'stranger';
  assert.equal(await vercelStaffSession(value), null);
  subject = 'owner';
  process.env.NBC_STAFF_SESSION_SECRET = randomBytes(32).toString('hex');
  assert.equal(await vercelStaffSession(value), null);
});
