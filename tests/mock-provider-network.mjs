// Test-process preload only. Never imported by application code.
// Codes travel over parent/child IPC, never HTTP responses, files, or logs.
const original = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = String(input);
  if (url === 'https://el.cloud.unifonic.com/rest/SMS/messages') {
    if (init?.method === 'HEAD') return new Response(null, { status: 405 });
    const body = JSON.parse(String(init?.body));
    const code = body.Body.match(/\b\d{6}\b/)?.[0];
    if (!code) return Response.json({ success: false }, { status: 400 });
    process.send?.({ type: 'sms', id: body.CorrelationID, code });
    return Response.json({ success: true, data: { MessageID: Date.now(), Status: 'Sent' } });
  }
  if (url === 'https://nbc-integration.cloudflareaccess.com/cdn-cgi/access/certs')
    return Response.json(JSON.parse(process.env.NBC_TEST_PUBLIC_JWKS));
  return original(input, init);
};
