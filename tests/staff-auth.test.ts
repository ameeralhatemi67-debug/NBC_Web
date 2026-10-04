import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { staffSession } from '../src/lib/staff-auth';
import { assertRequest, jsonBody, requestIp } from '../src/lib/request-security';
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: ReturnType<typeof createLocalJWKSet>;
const issuer = 'https://nbc-test.cloudflareaccess.com';
before(async () => {
  process.env.NBC_RUNTIME_MODE = 'production';
  process.env.CF_ACCESS_ISSUER = issuer;
  process.env.CF_ACCESS_AUD = 'nbc-admin';
  process.env.NBC_ADMIN_SUBJECTS = 'admin-sub';
  process.env.NBC_EDITOR_SUBJECTS = 'editor-sub';
  process.env.NBC_STAFF_MFA_CONFIRMED = 'true';
  keys = await generateKeyPair('RS256');
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'test', alg: 'RS256' }],
  });
});
async function token(sub = 'admin-sub', aud = 'nbc-admin', exp = '1h', iss = issuer, type = 'app') {
  return new SignJWT({ type })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject(sub)
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(keys.privateKey);
}
test('staff roles come from verified subject allowlists, never client-supplied role or email', async () => {
  assert.equal((await staffSession(await token(), jwks))?.role, 'admin');
  assert.equal((await staffSession(await token('editor-sub'), jwks))?.role, 'editor');
  await assert.rejects(staffSession(await token('stranger'), jwks));
  assert.equal(await staffSession(null, jwks), null);
});
test('staff JWT rejects wrong audience/issuer, expiration, service token and forged signature', async () => {
  for (const jwt of [
    await token('admin-sub', 'other'),
    await token('admin-sub', 'nbc-admin', '-1h'),
    await token('admin-sub', 'nbc-admin', '1h', 'https://attacker.example'),
    await token('admin-sub', 'nbc-admin', '1h', issuer, 'service'),
  ])
    await assert.rejects(staffSession(jwt, jwks));
  const other = await generateKeyPair('RS256');
  const forged = await new SignJWT({ sub: 'admin-sub', type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(issuer)
    .setAudience('nbc-admin')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(other.privateKey);
  await assert.rejects(staffSession(forged, jwks));
});
test('missing staff configuration fails closed even for a signed token', async () => {
  process.env.NBC_STAFF_MFA_CONFIRMED = 'false';
  try {
    await assert.rejects(staffSession(await token(), jwks));
  } finally {
    process.env.NBC_STAFF_MFA_CONFIRMED = 'true';
  }
});
test('production requests require exact configured origin and trusted single client IP', async () => {
  process.env.NBC_PUBLIC_ORIGIN = 'https://nbc.example';
  process.env.NBC_TRUSTED_IP_HEADER = 'cf-connecting-ip';
  const request = (origin: string) =>
    new Request('https://nbc.example/api/auth/challenge', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' },
      body: '{}',
    });
  assertRequest(request('https://nbc.example'));
  assert.equal(requestIp(request('https://nbc.example')), '192.0.2.1');
  assert.throws(() => assertRequest(request('http://nbc.example')));
  assert.throws(() => assertRequest(request('https://evil.example')));
  assert.throws(() => requestIp(new Request('https://nbc.example')));
  assert.throws(() =>
    assertRequest(
      new Request('https://nbc.example/api/auth/logout', { method: 'POST', body: '{}' }),
    ),
  );
});
test('JSON validation measures bytes without relying on Content-Length', async () => {
  const req = (body: string) => new Request('https://nbc.example', { method: 'POST', body });
  await assert.rejects(jsonBody(req('[]')));
  await assert.rejects(jsonBody(req('null')));
  await assert.rejects(jsonBody(req('{')));
  await assert.rejects(
    jsonBody(req(JSON.stringify({ x: 'س'.repeat(13000) }))),
    (e) => e instanceof Error && 'status' in e && e.status === 413,
  );
  assert.deepEqual(await jsonBody(req('{"ok":true}')), { ok: true });
});
