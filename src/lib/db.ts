import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { seedQuestions } from './seed';
const globalDb = globalThis as unknown as { nbcDb?: Promise<PGlite> };
export function getDb(): Promise<PGlite> {
  globalDb.nbcDb ??= initialize();
  return globalDb.nbcDb;
}
async function initialize() {
  const defaultDir = process.env.VERCEL ? '/tmp/nbc' : '.data/nbc';
  const dir = path.resolve(/* turbopackIgnore: true */ process.env.NBC_DATA_DIR || defaultDir);
  await mkdir(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, backup TEXT, stage TEXT NOT NULL, region TEXT NOT NULL, locality TEXT NOT NULL, village TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, participant_id TEXT, role TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, payload JSONB NOT NULL, tries INT NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, body JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, participant_id TEXT UNIQUE NOT NULL REFERENCES participants(id), questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}', revision INT NOT NULL DEFAULT 0, score INT, submitted_at TIMESTAMPTZ, receipt TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS audit (id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, value JSONB NOT NULL);
  `);
  await db.transaction(async (tx) => {
    const { rows } = await tx.query('SELECT id FROM settings WHERE id = $1', ['initialized']);
    if (rows.length) return;
    for (const q of seedQuestions)
      await tx.query('INSERT INTO questions VALUES ($1,$2)', [q.id, JSON.stringify(q)]);
    await tx.query('INSERT INTO settings VALUES ($1,$2),($3,$4)', [
      'initialized',
      'true',
      'published',
      'false',
    ]);
    const names = [
      'نورة أحمد محمد العتيبي',
      'عبدالله خالد سعد القحطاني',
      'سارة فهد علي الدوسري',
      'محمد علي حسن الغامدي',
      'ريم صالح أحمد الحربي',
      'فهد سعد محمد الشهري',
    ];
    for (let i = 0; i < names.length; i++) {
      const id = `sample-${i + 1}`;
      await tx.query(
        'INSERT INTO participants (id,identity,name,phone,stage,region,locality,village) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          id,
          `DEMO-${i + 1}`,
          names[i],
          '05••••••••',
          ['المرحلة المتوسطة', 'المرحلة الثانوية', 'المرحلة الجامعية'][i % 3],
          ['الرياض', 'مكة المكرمة', 'الشرقية'][i % 3],
          ['الرياض', 'جدة', 'الدمام'][i % 3],
          '—',
        ],
      );
      if (i < 5) {
        const submitted = i < 4;
        const desired = [10, 10, 8, 7, 0][i];
        const answers = Object.fromEntries(
          seedQuestions
            .slice(0, submitted ? 10 : 3)
            .map((q, index) => [q.id, index < desired ? q.correct : (q.correct + 1) % 4]),
        );
        await tx.query(
          'INSERT INTO attempts (id,participant_id,questions,answers,score,submitted_at,receipt) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            `attempt-${id}`,
            id,
            JSON.stringify(seedQuestions),
            JSON.stringify(answers),
            submitted ? desired : null,
            submitted ? new Date('2026-09-08T08:00:00Z') : null,
            submitted ? `NBC-DEMO-${i + 1}` : null,
          ],
        );
      }
    }
    await tx.query('INSERT INTO audit (actor,action,detail) VALUES ($1,$2,$3)', [
      'system',
      'تهيئة العرض',
      'سجلات افتراضية للتوضيح فقط؛ لا تمثل مشاركة حقيقية.',
    ]);
  });
  return db;
}
