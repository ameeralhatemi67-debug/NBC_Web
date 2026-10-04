import type { Database, Queryable } from './database';
import { identityLookup, normalizePhone, keyedHash } from './otp-crypto';
import { isProduction } from './runtime';
import { createHash } from 'node:crypto';

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
  {
    id: '003_book_competitions',
    sql: `
    CREATE TABLE book_versions (id TEXT PRIMARY KEY, body JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE competitions (id TEXT PRIMARY KEY, body JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    INSERT INTO competitions(id,body) VALUES ('legacy-demo','{"id":"legacy-demo","title":"العرض السابق (أرشيف)","state":"CLOSED","opensAt":null,"closesAt":null,"closedAt":null,"feedbackMode":"formal","leaderboardMode":"hidden","closingPolicy":"immediate","graceMinutes":0,"bookVersionId":"legacy","frozenAt":null,"version":1}');
    ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_participant_id_key;
    ALTER TABLE attempts ADD COLUMN competition_id TEXT NOT NULL DEFAULT 'legacy-demo' REFERENCES competitions(id);
    ALTER TABLE attempts ADD COLUMN stage TEXT;
    ALTER TABLE attempts ADD COLUMN participant_number TEXT;
    ALTER TABLE attempts ADD COLUMN max_score INT;
    ALTER TABLE attempts ADD COLUMN percentage DOUBLE PRECISION;
    ALTER TABLE attempts ADD COLUMN recovery_until TIMESTAMPTZ;
    ALTER TABLE attempts ADD CONSTRAINT attempts_participant_competition_key UNIQUE(participant_id,competition_id);
    ALTER TABLE attempts ADD CONSTRAINT attempts_competition_number_key UNIQUE(competition_id,participant_number);
    UPDATE attempts SET max_score=jsonb_array_length(questions),percentage=CASE WHEN score IS NOT NULL AND jsonb_array_length(questions)>0 THEN score*100.0/jsonb_array_length(questions) END;
    CREATE TABLE competition_question_sets (competition_id TEXT NOT NULL REFERENCES competitions(id), stage TEXT NOT NULL CHECK(stage IN ('middle','highschool','university')), questions JSONB NOT NULL, PRIMARY KEY(competition_id,stage));
    CREATE TABLE question_versions (question_id TEXT NOT NULL REFERENCES questions(id), version INT NOT NULL, body JSONB NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(question_id,version));
    INSERT INTO question_versions(question_id,version,body,actor) SELECT id,(body->>'version')::int,body,'migration' FROM questions;
    CREATE TABLE attempt_questions (attempt_id TEXT NOT NULL REFERENCES attempts(id), question_id TEXT NOT NULL, ordinal INT NOT NULL, snapshot JSONB NOT NULL, PRIMARY KEY(attempt_id,question_id), UNIQUE(attempt_id,ordinal));
    CREATE TABLE attempt_answers (attempt_id TEXT NOT NULL, question_id TEXT NOT NULL, selected JSONB NOT NULL, checked_at TIMESTAMPTZ, synced_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(attempt_id,question_id), FOREIGN KEY(attempt_id,question_id) REFERENCES attempt_questions(attempt_id,question_id));
    CREATE TABLE attempt_events (attempt_id TEXT NOT NULL REFERENCES attempts(id), client_event_id TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(attempt_id,client_event_id));
    CREATE TABLE admin_test_runs (id TEXT PRIMARY KEY, actor TEXT NOT NULL, competition_id TEXT NOT NULL REFERENCES competitions(id), stage TEXT NOT NULL, config JSONB NOT NULL, questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}', revision INT NOT NULL DEFAULT 0, submitted_at TIMESTAMPTZ, score INT, percentage DOUBLE PRECISION, participant_number TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE admin_test_events (run_id TEXT NOT NULL REFERENCES admin_test_runs(id), client_event_id TEXT NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(run_id,client_event_id));
    CREATE TABLE attempt_recoveries (id BIGSERIAL PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), actor TEXT NOT NULL, reason TEXT NOT NULL, before_state JSONB NOT NULL, after_state JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX attempts_campaign_stage ON attempts(competition_id,stage,submitted_at);
    `,
  },
  {
    id: '004_question_corrections',
    sql: `CREATE TABLE competition_corrections (
      competition_id TEXT NOT NULL REFERENCES competitions(id), question_id TEXT NOT NULL,
      policy TEXT NOT NULL CHECK(policy='award_credit'), reason TEXT NOT NULL, actor TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(competition_id,question_id)
    );`,
  },
  {
    id: '005_backend_integrity',
    sql: `
      ALTER TABLE admin_test_runs ADD COLUMN invalidated_at TIMESTAMPTZ;
      ALTER TABLE admin_test_runs ADD CONSTRAINT admin_test_stage CHECK(stage IN ('middle','highschool','university'));
      ALTER TABLE attempts ADD CONSTRAINT attempts_stage CHECK(stage IS NULL OR stage IN ('middle','highschool','university'));
      ALTER TABLE attempts ADD CONSTRAINT attempts_revision CHECK(revision >= 0);
      ALTER TABLE attempts ADD CONSTRAINT attempts_score CHECK(score IS NULL OR (score >= 0 AND score <= max_score));
      ALTER TABLE attempts ADD CONSTRAINT attempts_percentage CHECK(percentage IS NULL OR percentage BETWEEN 0 AND 100);
      ALTER TABLE attempt_questions ADD CONSTRAINT attempt_question_ordinal CHECK(ordinal BETWEEN 0 AND 19);
      ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answer_array CHECK(jsonb_typeof(selected)='array');
      CREATE INDEX admin_tests_owner ON admin_test_runs(actor,competition_id,stage) WHERE invalidated_at IS NULL;
      CREATE INDEX attempt_recovery_expiry ON attempts(competition_id,recovery_until) WHERE recovery_until IS NOT NULL;
      CREATE INDEX otp_participant ON otp_challenges(participant_id);
      CREATE INDEX sessions_participant ON sessions(participant_id);
      CREATE INDEX attempt_questions_question ON attempt_questions(question_id);
      CREATE INDEX question_bank_stage ON questions((body->>'stage'),(body->>'bookVersionId'));
      CREATE INDEX attempt_recoveries_attempt ON attempt_recoveries(attempt_id);
    `,
  },
  {
    id: '006_immutable_attempts',
    sql: `
      CREATE FUNCTION guard_attempt_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.questions IS DISTINCT FROM NEW.questions OR OLD.participant_id IS DISTINCT FROM NEW.participant_id
          OR OLD.competition_id IS DISTINCT FROM NEW.competition_id OR OLD.stage IS DISTINCT FROM NEW.stage
          OR OLD.participant_number IS DISTINCT FROM NEW.participant_number THEN
          RAISE EXCEPTION 'Attempt snapshots and ownership are immutable';
        END IF;
        IF OLD.submitted_at IS NOT NULL AND (NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.receipt IS DISTINCT FROM OLD.receipt) THEN
          RAISE EXCEPTION 'Submitted attempt cannot be reopened';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_attempt BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION guard_attempt_snapshot();
      CREATE FUNCTION guard_locked_answer() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.checked_at IS NOT NULL AND (TG_OP='DELETE' OR NEW.selected IS DISTINCT FROM OLD.selected OR NEW.checked_at IS DISTINCT FROM OLD.checked_at) THEN
          RAISE EXCEPTION 'First checked answer is immutable';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_answer BEFORE UPDATE OR DELETE ON attempt_answers FOR EACH ROW EXECUTE FUNCTION guard_locked_answer();
      CREATE FUNCTION guard_snapshot_rows() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Attempt question snapshots are immutable'; END $$;
      CREATE TRIGGER immutable_question_snapshot BEFORE UPDATE OR DELETE ON attempt_questions FOR EACH ROW EXECUTE FUNCTION guard_snapshot_rows();
    `,
  },
  {
    id: '007_fixed_function_paths',
    sql: `
      ALTER FUNCTION guard_attempt_snapshot() SET search_path=pg_catalog;
      ALTER FUNCTION guard_locked_answer() SET search_path=pg_catalog;
      ALTER FUNCTION guard_snapshot_rows() SET search_path=pg_catalog;
    `,
  },
];
export const migrationChecksum = (sql: string) => createHash('sha256').update(sql).digest('hex');
export async function migrate(db: Database) {
  await db.transaction(async (tx) => {
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(72831004)');
    await tx.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    await tx.exec('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
    for (const migration of migrations) {
      const applied = (
        await tx.query<{ checksum: string | null }>(
          'SELECT checksum FROM schema_migrations WHERE id=$1',
          [migration.id],
        )
      ).rows[0];
      if (applied) {
        if (applied.checksum && applied.checksum !== migrationChecksum(migration.sql))
          throw new Error(`Migration checksum mismatch: ${migration.id}`);
        if (!applied.checksum)
          await tx.query('UPDATE schema_migrations SET checksum=$1 WHERE id=$2', [
            migrationChecksum(migration.sql),
            migration.id,
          ]);
        continue;
      }
      await tx.exec(migration.sql);
      if (migration.id === '002_secure_otp') {
        await migrateIdentities(tx);
        await tx.query('INSERT INTO settings(id,value) VALUES ($1,$2)', [
          'identity_key_check',
          JSON.stringify(keyedHash('key-check', 'nbc-identity-key', 'IDENTITY_LOOKUP_SECRET')),
        ]);
      }
      await tx.query('INSERT INTO schema_migrations(id,checksum) VALUES ($1,$2)', [
        migration.id,
        migrationChecksum(migration.sql),
      ]);
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
    const applied = (
      await db.query<{ id: string; checksum: string | null }>(
        'SELECT id,checksum FROM schema_migrations',
      )
    ).rows;
    return migrations.every((m) =>
      applied.some((a) => a.id === m.id && a.checksum === migrationChecksum(m.sql)),
    );
  } catch {
    return false;
  }
}
