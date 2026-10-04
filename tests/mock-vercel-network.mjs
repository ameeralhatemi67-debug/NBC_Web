// Test-process preload only. Never imported by application code.
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' };
const originalFetch = globalThis.fetch;
const tokens = new Map(),
  usedCodes = new Set();
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === 'https://vercel.com/.well-known/openid-configuration')
    return Response.json({
      issuer: 'https://vercel.com',
      authorization_endpoint: 'https://vercel.com/oauth/authorize',
      token_endpoint: 'https://api.vercel.com/login/oauth/token',
      userinfo_endpoint: 'https://api.vercel.com/login/oauth/userinfo',
      jwks_uri: 'https://vercel.com/test-jwks',
      id_token_signing_alg_values_supported: ['RS256'],
    });
  if (url === 'https://vercel.com/test-jwks') return Response.json({ keys: [jwk] });
  if (url === 'https://api.vercel.com/login/oauth/token') {
    const body = new URLSearchParams(String(init.body)),
      code = body.get('code');
    if (usedCodes.has(code)) return Response.json({ error: 'invalid_grant' }, { status: 400 });
    usedCodes.add(code);
    const [sub, nonce] = code.split('|');
    const id_token = await new SignJWT({ nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer('https://vercel.com')
      .setAudience('test-client')
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    const access_token = 'memory-only-' + nonce;
    tokens.set(access_token, sub);
    return Response.json({ token_type: 'Bearer', access_token, expires_in: 3600, id_token });
  }
  if (url === 'https://api.vercel.com/login/oauth/userinfo') {
    const token = new Headers(init.headers).get('authorization')?.replace(/^Bearer /i, '');
    return tokens.has(token)
      ? Response.json({ sub: tokens.get(token) })
      : Response.json({ error: 'invalid_token' }, { status: 401 });
  }
  if (url === 'https://api.vercel.com/login/oauth/token/revoke') {
    tokens.delete(new URLSearchParams(String(init.body)).get('token'));
    return new Response(null, { status: 200 });
  }
  return originalFetch(input, init);
};
