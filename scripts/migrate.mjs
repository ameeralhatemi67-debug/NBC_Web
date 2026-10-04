import { connectDatabase } from '../src/lib/database.ts';
import { migrate } from '../src/lib/migrations.ts';
const db = await connectDatabase({ operator: true });
try {
  await migrate(db);
  console.log('Database migrations applied.');
} catch {
  console.error(
    'Migration failed. Check database connectivity, security keys, and legacy/demo data policy. No credentials or records are printed.',
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
