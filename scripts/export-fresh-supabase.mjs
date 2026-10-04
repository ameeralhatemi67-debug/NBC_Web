// Initial empty NBC provisioning only. DDL is derived from migrations.ts;
// do not maintain a second set of Supabase/application migration files.
import { writeFile } from 'node:fs/promises';
import { migrations, migrationChecksum } from '../src/lib/migrations.ts';
const [file, ref] = process.argv.slice(2);
if (!file || ref !== 'eerfhnaduachqluowsdo')
  throw new Error('Usage: tsx scripts/export-fresh-supabase.mjs output.sql eerfhnaduachqluowsdo');
const lit = (v) => "'" + String(v).replaceAll("'", "''") + "'";
let sql = `SELECT pg_advisory_xact_lock(72831004);
DO $$ BEGIN
IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='nbc') THEN RAISE EXCEPTION 'Fresh export refuses an existing NBC schema'; END IF;
END $$;
CREATE SCHEMA nbc AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA nbc FROM PUBLIC, anon, authenticated, service_role;
SET LOCAL search_path TO nbc, pg_catalog;
CREATE TABLE schema_migrations(id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT);
`;
for (const m of migrations) {
  sql += m.sql + '\n';
  sql += `INSERT INTO schema_migrations(id,checksum) VALUES(${lit(m.id)},${lit(migrationChecksum(m.sql))});\n`;
}
// No imported identity-key marker: the existing Vercel key enrolls itself once,
// while the database has zero identities/challenges, before any auth work.
sql += "INSERT INTO settings(id,value) VALUES('identity_key_bootstrap_pending','true');\n";
sql += `GRANT USAGE ON SCHEMA nbc TO nbc_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA nbc TO nbc_runtime;
REVOKE INSERT,UPDATE,DELETE ON schema_migrations FROM nbc_runtime;
REVOKE UPDATE,DELETE ON attempt_questions,attempt_events,admin_test_events,attempt_recoveries,audit FROM nbc_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA nbc TO nbc_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA nbc REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA nbc REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA nbc REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $$ DECLARE t record; BEGIN
FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='nbc' LOOP
EXECUTE format('REVOKE ALL ON nbc.%I FROM PUBLIC,anon,authenticated,service_role',t.tablename);
EXECUTE format('ALTER TABLE nbc.%I ENABLE ROW LEVEL SECURITY',t.tablename);
EXECUTE format('CREATE POLICY nbc_server ON nbc.%I TO nbc_runtime USING(true) WITH CHECK(true)',t.tablename);
END LOOP; END $$;
`;
await writeFile(file, sql);
console.log(`Exported ${migrations.length} source migrations for fresh NBC private storage.`);
