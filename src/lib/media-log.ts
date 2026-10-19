import type { Database } from './database';
import { AppError } from './domain';
import { cleanSource } from './analytics-insights';
import type { Session } from './service';

function requireAdmin(s: Session | null) {
  if (!s) throw new AppError('سجّل الدخول للمتابعة.', 401);
  if (s.role !== 'admin') throw new AppError('ليست لديك صلاحية لهذا الإجراء.', 403);
  return s;
}

// The media centre's post log: one entry per post code, kept as JSON in `settings` (no schema
// change). It names the code in analytics and keeps a copy of the numbers each post printed.
export const MEDIA_LOG_KEY = 'media_posts';
export const MEDIA_LOG_LIMIT = 300;
const FORMATS = ['square', 'portrait', 'story', 'landscape', 'link', 'bundle'];
const TARGETS = ['register', 'home', 'book', 'winners', 'none'];

export type MediaPost = {
  code: string;
  template: string;
  title: string;
  formats: string[];
  target: string;
  link: string;
  facts: Record<string, string>;
  // The poster's edited text and style, so the post can be opened again as it was.
  texts: Record<string, string>;
  style: string;
  actor: string;
  createdAt: string;
  lastExportAt: string;
  exports: number;
};

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validateMediaPost(body: Record<string, unknown>) {
  const allowed = [
    'action',
    'code',
    'template',
    'title',
    'format',
    'target',
    'link',
    'facts',
    'texts',
    'style',
  ];
  if (Object.keys(body).some((k) => !allowed.includes(k))) throw new AppError('حقول غير مسموحة.');
  const code = cleanSource(body.code);
  const template = text(body.template, 40);
  const title = text(body.title, 120);
  const format = text(body.format, 20);
  const target = text(body.target, 20);
  const link = text(body.link, 300);
  if (!code) throw new AppError('رمز المنشور غير صالح.');
  if (!/^[a-z0-9-]{2,40}$/.test(template) || !title) throw new AppError('بيانات المنشور ناقصة.');
  if (!FORMATS.includes(format) || !TARGETS.includes(target))
    throw new AppError('مقاس المنشور أو وجهته غير صالحة.');
  if (target !== 'none' && !/^https:\/\/[^\s]+$/.test(link))
    throw new AppError('رابط المنشور غير صالح.');
  const strings = (value: unknown, keys: number, max: number) => {
    const out: Record<string, string> = {};
    if (value && typeof value === 'object' && !Array.isArray(value))
      for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, keys))
        if (typeof v === 'string' || typeof v === 'number')
          out[k.slice(0, 40)] = String(v).slice(0, max);
    return out;
  };
  const style = text(body.style, 60);
  if (style && !/^[a-z0-9/_-]+$/.test(style)) throw new AppError('نمط المنشور غير صالح.');
  return {
    code,
    template,
    title,
    format,
    target,
    link: target === 'none' ? '' : link,
    facts: strings(body.facts, 24, 160),
    texts: strings(body.texts, 16, 400),
    style,
  };
}

export class MediaLog {
  constructor(
    private db: Database,
    private now: () => number = Date.now,
  ) {}

  async list(session: Session | null): Promise<{ posts: MediaPost[] }> {
    requireAdmin(session);
    return { posts: await readMediaPosts(this.db) };
  }

  async record(session: Session | null, body: Record<string, unknown>) {
    const staff = requireAdmin(session);
    const entry = validateMediaPost(body);
    const at = new Date(this.now()).toISOString();
    return this.db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO settings(id,value) VALUES($1,\'{"posts":[]}\') ON CONFLICT DO NOTHING',
        [MEDIA_LOG_KEY],
      );
      const value = (
        await tx.query<{ value: { posts?: MediaPost[] } }>(
          'SELECT value FROM settings WHERE id=$1 FOR UPDATE',
          [MEDIA_LOG_KEY],
        )
      ).rows[0].value;
      const posts = Array.isArray(value.posts) ? value.posts : [];
      const existing = posts.find((p) => p.code === entry.code);
      const post: MediaPost = existing
        ? {
            ...existing,
            title: entry.title,
            template: entry.template,
            formats: [...new Set([...existing.formats, entry.format])],
            target: entry.target,
            link: entry.link,
            facts: entry.facts,
            texts: entry.texts,
            style: entry.style,
            lastExportAt: at,
            exports: existing.exports + 1,
          }
        : {
            code: entry.code,
            template: entry.template,
            title: entry.title,
            formats: [entry.format],
            target: entry.target,
            link: entry.link,
            facts: entry.facts,
            texts: entry.texts,
            style: entry.style,
            actor: staff.actor ?? 'admin',
            createdAt: at,
            lastExportAt: at,
            exports: 1,
          };
      const next = [post, ...posts.filter((p) => p.code !== entry.code)].slice(0, MEDIA_LOG_LIMIT);
      await tx.query('UPDATE settings SET value=$1 WHERE id=$2', [
        JSON.stringify({ posts: next }),
        MEDIA_LOG_KEY,
      ]);
      await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
        staff.actor ?? 'admin',
        'تصدير منشور',
        JSON.stringify({ code: post.code, template: post.template, format: entry.format }),
      ]);
      return post;
    });
  }
}

export async function readMediaPosts(db: Pick<Database, 'query'>): Promise<MediaPost[]> {
  const row = (
    await db.query<{ value: { posts?: MediaPost[] } }>('SELECT value FROM settings WHERE id=$1', [
      MEDIA_LOG_KEY,
    ])
  ).rows[0];
  return Array.isArray(row?.value?.posts) ? row.value.posts : [];
}
