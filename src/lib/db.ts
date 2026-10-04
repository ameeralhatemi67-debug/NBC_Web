import { connectDatabase, type Database } from './database';
import { migrate, migrationsCurrent } from './migrations';
import { isProduction, isLocalMode } from './runtime';
import { AppError } from './domain';
import { seedQuestions } from './seed';
import { defaultPrizes } from './prizes';
import { initializeCompetition } from './competition-service';
import { verifyIdentityKey } from './identity-key';
const globalDb = globalThis as unknown as { nbcDb?: Promise<Database> };
export function getDb(): Promise<Database> {
  globalDb.nbcDb ??= initialize().catch((error) => {
    globalDb.nbcDb = undefined;
    throw error;
  });
  return globalDb.nbcDb;
}
async function initialize() {
  const db = await connectDatabase();
  try {
    if (isProduction()) {
      if (!(await migrationsCurrent(db)))
        throw new AppError('نفّذ ترحيلات قاعدة البيانات قبل التشغيل.', 503);
    } else await migrate(db);
    if (isProduction()) await verifyIdentityKey(db);
  } catch (error) {
    await db.close();
    throw error;
  }
  await db.query('INSERT INTO settings (id,value) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [
    'prizes',
    JSON.stringify(defaultPrizes),
  ]);
  await db.transaction(async (tx) => {
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(72831005)');
    const { rows } = await tx.query('SELECT id FROM settings WHERE id = $1', ['initialized']);
    if (rows.length) return;
    for (const q of isProduction() ? [] : seedQuestions)
      await tx.query('INSERT INTO questions VALUES ($1,$2)', [
        q.id,
        JSON.stringify(isProduction() ? { ...q, approved: false } : q),
      ]);
    await tx.query('INSERT INTO settings VALUES ($1,$2),($3,$4)', [
      'initialized',
      'true',
      'published',
      'false',
    ]);
    if (!isLocalMode() || db.kind !== 'pglite') return;
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
  // Enrich only the built-in synthetic records; never infer demographics for registrations.
  for (let i = 0; isLocalMode() && db.kind === 'pglite' && i < 6; i++) {
    await db.query(
      'UPDATE participants SET gender=COALESCE(gender,$1),institution=COALESCE(institution,$2) WHERE id=$3 AND identity=$4',
      [
        i % 2 === 0 ? 'أنثى' : 'ذكر',
        [
          'مدرسة المعرفة المتوسطة (تجريبية)',
          'مدرسة الأفق الثانوية (تجريبية)',
          'جامعة المعرفة (تجريبية)',
        ][i % 3],
        `sample-${i + 1}`,
        `DEMO-${i + 1}`,
      ],
    );
  }
  await initializeCompetition(db);
  return db;
}
