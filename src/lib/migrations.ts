import type { Database, Queryable } from './database';
import { identityLookup, normalizePhone, keyedHash } from './otp-crypto';
import { isProduction } from './runtime';

// Ordered, transactional migrations shared by PostgreSQL and local PGlite.
export const migrations = [
  {
    id: '001_baseline',
    sql: `
    CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, backup TEXT, stage TEXT NOT NULL, region TEXT NOT NULL, locality TEXT NOT NULL, village TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, participant_id TEXT, role TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, body JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, participant_id TEXT UNIQUE NOT NULL REFERENCES participants(id), questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}', revision INT NOT NULL DEFAULT 0, score INT, submitted_at TIMESTAMPTZ, receipt TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS audit (id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, value JSONB NOT NULL);
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS institution TEXT;
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS gender TEXT;
  `,
  },
  {
    id: '002_secure_otp',
    sql: `
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_source TEXT NOT NULL DEFAULT 'legacy';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS actor TEXT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE otp_challenges (
      id TEXT PRIMARY KEY, participant_id TEXT REFERENCES participants(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('REGISTER','LOGIN','ADMIN_TEST')),
      phone_e164 TEXT NOT NULL, phone_hash TEXT NOT NULL, provider TEXT NOT NULL,
      provider_reference TEXT, otp_digest TEXT, payload_json JSONB NOT NULL DEFAULT '{}',
      attempt_count INT NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
      send_count INT NOT NULL DEFAULT 1, last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      request_ip_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('SENDING','SENT','FAILED','USED','SUPERSEDED')),
      admin_actor TEXT, config_fingerprint TEXT NOT NULL
    );
    CREATE INDEX otp_expiry ON otp_challenges(expires_at);
    CREATE INDEX otp_phone ON otp_challenges(phone_hash, created_at);
    CREATE TABLE security_locks (key TEXT PRIMARY KEY, touched_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE otp_rate_events (id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX otp_rate_lookup ON otp_rate_events(key, created_at);
    CREATE TABLE security_events (id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX security_events_time ON security_events(created_at, action);
    INSERT INTO settings(id,value) VALUES ('otp_security','{}') ON CONFLICT DO NOTHING;
  `,
  },
];
export async function migrate(db: Database) {
  await db.transaction(async (tx) => {
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(72831004)');
    await tx.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    for (const migration of migrations) {
      if (
        (await tx.query('SELECT id FROM schema_migrations WHERE id=$1', [migration.id])).rows.length
      )
        continue;
      await tx.exec(migration.sql);
      if (migration.id === '002_secure_otp') {
        await migrateIdentities(tx);
        await tx.query('INSERT INTO settings(id,value) VALUES ($1,$2)', [
          'identity_key_check',
          JSON.stringify(keyedHash('key-check', 'nbc-identity-key', 'IDENTITY_LOOKUP_SECRET')),
        ]);
      }
      await tx.query('INSERT INTO schema_migrations(id) VALUES ($1)', [migration.id]);
    }
  });
}
async function migrateIdentities(tx: Queryable) {
  const { rows } = await tx.query<{ id: string; identity: string; phone: string }>(
    'SELECT id,identity,phone FROM participants',
  );
  if (isProduction() && rows.some((p) => p.identity.startsWith('DEMO-')))
    throw new Error(
      'Refusing to migrate synthetic participants into production. Use a fresh production database.',
    );
  for (const p of rows) {
    if (p.identity.startsWith('DEMO-') || p.identity.startsWith('h1:')) continue;
    await tx.query('UPDATE participants SET identity=$1,phone=$2 WHERE id=$3', [
      identityLookup(p.identity),
      normalizePhone(p.phone),
      p.id,
    ]);
  }
}
export async function migrationsCurrent(db: Queryable) {
  try {
    return (
      (await db.query('SELECT id FROM schema_migrations WHERE id=$1', [migrations.at(-1)!.id])).rows
        .length === 1
    );
  } catch {
    return false;
  }
}
