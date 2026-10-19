import { cleanSource } from '../analytics-insights';

// Every exported post carries its own ?ref= code, so analytics can count who each post brought in.
// Codes follow the registration source rule (lower case, digits, - and _, at most 40 characters).
export type LinkTarget = 'register' | 'home' | 'book' | 'winners';
export const linkTargets: { id: LinkTarget; name: string; path: string }[] = [
  { id: 'register', name: 'صفحة التسجيل', path: '/register' },
  { id: 'home', name: 'الصفحة الرئيسية', path: '/' },
  { id: 'book', name: 'كتاب المسابقة', path: '/book' },
  { id: 'winners', name: 'إعلان الفائزين', path: '/winners' },
];
export const PRODUCTION_SITE = 'https://nbc-web-two.vercel.app';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newPostCode(template: string, random: () => number = Math.random) {
  const slug =
    template
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'post';
  const tail = Array.from(
    { length: 4 },
    () => ALPHABET[Math.floor(random() * ALPHABET.length)],
  ).join('');
  return cleanSource(`m-${slug}-${tail}`) ?? `m-${tail}`;
}

// The site to link to: the committee's own origin, or production when working locally.
export function siteBase(origin: string | undefined) {
  if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin))
    return PRODUCTION_SITE;
  return origin.replace(/\/+$/, '');
}
export function postLink(base: string, target: LinkTarget, code: string | null) {
  const path = linkTargets.find((t) => t.id === target)?.path ?? '/';
  const clean = code ? cleanSource(code) : null;
  return `${base.replace(/\/+$/, '')}${path}${clean ? `?ref=${clean}` : ''}`;
}
// The link as printed under a QR code: no scheme, no trailing slash.
export function displayLink(link: string) {
  return link.replace(/^https?:\/\//, '').replace(/\/(\?|$)/, '$1');
}
