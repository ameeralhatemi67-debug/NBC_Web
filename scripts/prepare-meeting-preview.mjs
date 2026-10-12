import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
// This creates a fresh local review database. It never opens the operator's existing database.
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw new Error('Only an isolated local preview is allowed.');
await mkdir('.data', { recursive: true });
const directory = await mkdtemp(path.resolve('.data/meeting-preview-'));
Object.assign(process.env, {
  NBC_DATA_DIR: directory,
  NBC_RUNTIME_MODE: 'test',
  NBC_DEMO_MODE: 'true',
  OTP_PROVIDER: 'fake',
  NBC_DEMO_OTP: '739281',
});
const { getDb } = await import('../src/lib/db.ts');
const database = await getDb();
await database.close();
const bank = 'docs/question-bank/2026-10-11/official-drafts.json';
const imported = spawnSync(
  process.execPath,
  [
    '--import',
    'tsx',
    'scripts/import-questions.mjs',
    bank,
    '--apply',
    '--actor',
    'local-meeting-review',
  ],
  {
    env: process.env,
    windowsHide: true,
    stdio: 'inherit',
  },
);
if (imported.status !== 0) throw new Error('Draft import failed.');
const { connectDatabase } = await import('../src/lib/database.ts');
const db = await connectDatabase();
try {
  // This database was just created for review. Remove only its synthetic question seed.
  await db.query(
    "DELETE FROM question_versions WHERE question_id IN (SELECT id FROM questions WHERE body->>'fixture'='true')",
  );
  await db.query("DELETE FROM questions WHERE body->>'fixture'='true'");
  const stages = (
    await db.query(
      "SELECT body->>'stage' AS stage,count(*)::int AS count FROM questions WHERE body->>'active'='true' GROUP BY body->>'stage'",
    )
  ).rows;
  const campaign = (
    await db.query(
      "SELECT body FROM competitions WHERE id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')",
    )
  ).rows[0].body;
  const review = {
    directory,
    url: 'http://127.0.0.1:43210',
    bank,
    imported: stages,
    campaign,
    approved: 0,
    state: 'DRAFT',
  };
  await writeFile('tmp/meeting-preview.json', JSON.stringify(review, null, 2) + '\n');
  console.log(JSON.stringify({ directory, imported: stages, approved: 0, state: campaign.state }));
} finally {
  await db.close();
}
