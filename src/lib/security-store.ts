import type { Database, Queryable } from './database';
import { AppError } from './domain';

export async function securityEvent(tx: Queryable, action: string, actor = 'anonymous') {
  await tx.query('INSERT INTO security_events(action,actor) VALUES ($1,$2)', [action, actor]);
}
export async function lock(tx: Queryable, key: string) {
  await tx.query('INSERT INTO security_locks(key) VALUES($1) ON CONFLICT DO NOTHING', [key]);
  await tx.query('SELECT key FROM security_locks WHERE key=$1 FOR UPDATE', [key]);
  await tx.query('UPDATE security_locks SET touched_at=now() WHERE key=$1', [key]);
}
// Sliding windows, with one row lock for each keyed subject across all instances.
export async function rateLimit(
  db: Database,
  key: string,
  policies: { seconds: number; max: number }[],
  actor = 'anonymous',
) {
  const retry = await db.transaction(async (tx) => {
    await lock(tx, key);
    for (const policy of policies) {
      const row = (
        await tx.query<{ count: string; retry: number }>(
          `SELECT count(*)::text AS count,
        COALESCE(ceil(extract(epoch FROM min(created_at) + $2 * interval '1 second' - now())),0)::int AS retry
        FROM otp_rate_events WHERE key=$1 AND created_at > now() - $2 * interval '1 second'`,
          [key, policy.seconds],
        )
      ).rows[0];
      if (Number(row.count) >= policy.max) {
        await securityEvent(tx, 'rate_limit', actor);
        return Math.max(1, row.retry);
      }
    }
    await tx.query('INSERT INTO otp_rate_events(key) VALUES ($1)', [key]);
    return 0;
  });
  if (retry)
    throw new AppError('طلبات كثيرة. انتظر قبل المحاولة مجددًا.', 429, 'RATE_LIMITED', retry);
}
export async function cleanupSecurity(db: Database) {
  return db.transaction(async (tx) => {
    // Old demo challenges are never accepted by the new API; expire their legacy payloads too.
    const legacy = (
      await tx.query<{ name: string | null }>("SELECT to_regclass('challenges')::text AS name")
    ).rows[0].name;
    if (legacy)
      await tx.query("DELETE FROM challenges WHERE expires_at < now() - interval '24 hours'");
    await tx.query("DELETE FROM otp_challenges WHERE expires_at < now() - interval '24 hours'");
    await tx.query("DELETE FROM otp_rate_events WHERE created_at < now() - interval '25 hours'");
    await tx.query("DELETE FROM security_locks WHERE touched_at < now() - interval '48 hours'");
    await tx.query('DELETE FROM sessions WHERE expires_at < now()');
    await tx.query("DELETE FROM security_events WHERE created_at < now() - interval '90 days'");
  });
}
