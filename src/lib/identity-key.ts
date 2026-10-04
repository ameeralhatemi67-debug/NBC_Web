import type { Database } from './database';
import { keyedHash } from './otp-crypto';
import { AppError } from './domain';

// Only an operator's fresh-database export can authorize initial enrollment.
// A mismatch or missing marker on an existing database never rotates the key.
export async function verifyIdentityKey(db: Database) {
  await db.transaction(async (tx) => {
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(72831006)');
    const expected = keyedHash('key-check', 'nbc-identity-key', 'IDENTITY_LOOKUP_SECRET');
    const check = (
      await tx.query<{ value: string }>("SELECT value FROM settings WHERE id='identity_key_check'")
    ).rows[0];
    if (check) {
      if (check.value !== expected)
        throw new AppError('مفتاح الهوية لا يطابق قاعدة البيانات.', 503);
      return;
    }
    const pending = (
      await tx.query<{ value: boolean }>(
        "SELECT value FROM settings WHERE id='identity_key_bootstrap_pending' FOR UPDATE",
      )
    ).rows[0];
    const participants = (await tx.query('SELECT id FROM participants LIMIT 1')).rows;
    const challenges = (await tx.query('SELECT id FROM otp_challenges LIMIT 1')).rows;
    if (pending?.value !== true || participants.length || challenges.length)
      throw new AppError('تسجيل مفتاح الهوية يحتاج مراجعة المشغل.', 503);
    await tx.query("INSERT INTO settings(id,value) VALUES('identity_key_check',$1)", [
      JSON.stringify(expected),
    ]);
    await tx.query("DELETE FROM settings WHERE id='identity_key_bootstrap_pending'");
    await tx.query(
      "INSERT INTO audit(actor,action,detail) VALUES('system:bootstrap','تسجيل مفتاح الهوية','Fresh empty NBC database enrolled with existing deployment key; no key rotation.')",
    );
  });
}
