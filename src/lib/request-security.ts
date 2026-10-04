import { isIP } from 'node:net';
import { AppError } from './domain';
import { isLocalMode, isProduction, productionOrigin } from './runtime';

export function assertRequest(request: Request) {
  const url = new URL(request.url);
  // Next may use its internal loopback hostname in Request.url. Validate the public Host separately.
  let localOrigin: URL;
  try {
    localOrigin = new URL(`${url.protocol}//${request.headers.get('host') || url.host}`);
  } catch {
    throw new AppError('مصدر الطلب غير مسموح.', 403);
  }
  if (
    !isProduction() &&
    (!isLocalMode() || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new AppError('الوضع المحلي متاح على هذا الجهاز فقط.', 403);
  if (!isProduction() && !['localhost', '127.0.0.1', '[::1]'].includes(localOrigin.hostname))
    throw new AppError('الوضع المحلي متاح على هذا الجهاز فقط.', 403);
  if (request.method === 'POST') {
    const expected = isProduction() ? productionOrigin() : localOrigin.origin;
    if (
      !expected ||
      request.headers.get('origin') !== expected ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new AppError('مصدر الطلب غير مسموح.', 403);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      throw new AppError('نوع الطلب غير صالح.', 415);
  }
}
export function requestIp(request: Request) {
  if (isLocalMode()) return 'local-loopback';
  const header = process.env.NBC_TRUSTED_IP_HEADER;
  if (!header || !['cf-connecting-ip', 'x-vercel-forwarded-for'].includes(header))
    throw new AppError('خدمة التحقق قيد الإعداد.', 503);
  // Deployment must strip/overwrite this header and prevent access around its trusted proxy.
  const value = request.headers.get(header)?.trim();
  if (!value || !isIP(value)) throw new AppError('تعذّر التحقق من مصدر الاتصال.', 503);
  return value;
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > 24000)
    throw new AppError('الطلب أكبر من الحد المسموح.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('طلب غير صالح.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 24000) {
      await reader.cancel();
      throw new AppError('الطلب أكبر من الحد المسموح.', 413);
    }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid body');
    return body;
  } catch {
    throw new AppError('طلب JSON غير صالح.');
  }
}
