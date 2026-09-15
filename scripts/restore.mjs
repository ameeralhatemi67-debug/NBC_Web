import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error('Usage: node scripts/restore.mjs backup.tar.gz .data/restored-demo');
const root = path.resolve('.data');
const target = path.resolve(destination);
if (!target.startsWith(root + path.sep))
  throw new Error(
    'Restore destination must be a new folder inside this workspace .data directory.',
  );
let exists = false;
try {
  await access(target);
  exists = true;
} catch {}
if (exists)
  throw new Error(
    'Destination already exists. Restore into a new directory; existing databases are never overwritten.',
  );
const bytes = await readFile(path.resolve(source));
await mkdir(path.dirname(target), { recursive: true });
const db = await PGlite.create({ dataDir: target, loadDataDir: new Blob([bytes]) });
try {
  // Restored data must not reactivate old browser sessions or OTP challenges.
  await db.exec('DELETE FROM sessions; DELETE FROM challenges;');
  const { rows } = await db.query(
    'SELECT (SELECT count(*) FROM participants)::int AS participants, (SELECT count(*) FROM attempts WHERE submitted_at IS NOT NULL)::int AS submissions',
  );
  console.log(JSON.stringify({ restoredTo: target, ...rows[0], sessionsInvalidated: true }));
} finally {
  await db.close();
}
