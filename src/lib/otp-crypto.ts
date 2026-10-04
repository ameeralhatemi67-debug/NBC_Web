import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AppError, normalizeDigits } from './domain';
import { securitySecret } from './runtime';

export type Purpose = 'REGISTER' | 'LOGIN' | 'ADMIN_TEST';
export function normalizePhone(value: string) {
  let phone = normalizeDigits(value).replace(/[\s()-]/g, '');
  if (/^05\d{8}$/.test(phone)) phone = '+966' + phone.slice(1);
  else if (/^5\d{8}$/.test(phone)) phone = '+966' + phone;
  else if (/^9665\d{8}$/.test(phone)) phone = '+' + phone;
  if (!/^\+9665\d{8}$/.test(phone)) throw new AppError('أدخل رقم جوال سعودي صحيح.');
  return phone;
}
export function keyedHash(domain: string, value: string, key = 'OTP_HMAC_SECRET') {
  return createHmac('sha256', securitySecret(key))
    .update(JSON.stringify([domain, value]))
    .digest('hex');
}
export function identityLookup(identity: string) {
  const normalized = normalizeDigits(identity.trim());
  if (!/^[12]\d{9}$/.test(normalized)) throw new AppError('أدخل هوية أو إقامة من ١٠ أرقام.');
  return 'h1:' + keyedHash('identity', normalized, 'IDENTITY_LOOKUP_SECRET');
}
export const maskPhone = (phone: string) => '05••••••' + phone.slice(-2);
export function generateOtp() {
  let code: string;
  do {
    code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  } while (code === '123456');
  return code;
}
export const otpDigest = (id: string, purpose: Purpose, code: string) =>
  keyedHash('otp', JSON.stringify([id, purpose, code]));
export function matchesOtp(digest: string, id: string, purpose: Purpose, code: string) {
  return (
    /^[a-f0-9]{64}$/.test(digest) &&
    timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(otpDigest(id, purpose, code), 'hex'))
  );
}
