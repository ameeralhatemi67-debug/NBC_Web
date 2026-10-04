import { AppError } from './domain';

export function isProduction() {
  return (
    process.env.NBC_RUNTIME_MODE === 'production' ||
    Boolean(process.env.VERCEL) ||
    (process.env.NODE_ENV === 'production' &&
      !['demo', 'test'].includes(process.env.NBC_RUNTIME_MODE ?? ''))
  );
}
export function isLocalMode() {
  return !isProduction() && ['demo', 'test'].includes(process.env.NBC_RUNTIME_MODE ?? '');
}
export function requireLocalMode() {
  if (!isLocalMode()) throw new AppError('هذه الميزة متاحة في الوضع المحلي الصريح فقط.', 503);
}
export function secretReady(name: string) {
  const value = process.env[name] ?? '';
  return /^[a-f0-9]{64,}$/i.test(value) && new Set(value).size >= 8;
}
export function securitySecret(name: string) {
  if (secretReady(name)) return process.env[name]!;
  if (isLocalMode()) return `local-only-${name}-not-for-production`;
  throw new AppError('خدمة التحقق قيد الإعداد. يرجى المحاولة لاحقًا.', 503);
}
export function productionOrigin() {
  try {
    const url = new URL(process.env.NBC_PUBLIC_ORIGIN ?? '');
    return url.protocol === 'https:' &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
