import { connectDatabase } from '../src/lib/database.ts';
import { cleanupSecurity } from '../src/lib/security-store.ts';
const db = await connectDatabase();
try {
  await cleanupSecurity(db);
  console.log('Expired authentication data cleaned.');
} catch {
  console.error('Security retention cleanup failed.');
  process.exitCode = 1;
} finally {
  await db.close();
}
