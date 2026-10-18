import { writeFile } from 'node:fs/promises';
import { migrations, migrationChecksum } from '../src/lib/migrations.ts';
const [file, ref, after] = process.argv.slice(2);
const index = migrations.findIndex((m) => m.id === after);
if (!file || ref !== 'eerfhnaduachqluowsdo' || index < 0)
  throw new Error(
    'Usage: tsx scripts/export-supabase-upgrade.mjs output.sql eerfhnaduachqluowsdo last-applied-id',
  );
// Server-only permissions for tables a forward migration creates, applied in the same release
// transaction. Earlier releases (014 and before) granted theirs by hand; see the operations guide.
const newTableGrants = {
  '015_prize_draw': `REVOKE ALL ON nbc.prize_draws,nbc.prize_draw_entries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON nbc.prize_draws,nbc.prize_draw_entries TO nbc_runtime;
ALTER TABLE nbc.prize_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE nbc.prize_draw_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY nbc_server ON nbc.prize_draws TO nbc_runtime USING(true) WITH CHECK(true);
CREATE POLICY nbc_server ON nbc.prize_draw_entries TO nbc_runtime USING(true) WITH CHECK(true);
REVOKE EXECUTE ON FUNCTION nbc.guard_prize_draw(),nbc.guard_prize_draw_entry() FROM PUBLIC,anon,authenticated,service_role;
`,
};
const lit = (v) => "'" + String(v).replaceAll("'", "''") + "'";
let sql = 'SELECT pg_advisory_xact_lock(72831004);\nSET LOCAL search_path TO nbc,pg_catalog;\n';
for (const m of migrations.slice(0, index + 1))
  sql += `DO $verify$ BEGIN IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE id=${lit(m.id)} AND checksum=${lit(migrationChecksum(m.sql))}) THEN RAISE EXCEPTION 'Prior migration missing or checksum changed'; END IF; END $verify$;\n`;
for (const m of migrations.slice(index + 1)) {
  sql += `DO $verify$ BEGIN IF EXISTS(SELECT 1 FROM schema_migrations WHERE id=${lit(m.id)}) THEN RAISE EXCEPTION 'Migration already applied'; END IF; END $verify$;\n`;
  sql += m.sql + '\n';
  sql += `INSERT INTO schema_migrations(id,checksum) VALUES(${lit(m.id)},${lit(migrationChecksum(m.sql))});\n`;
  sql += newTableGrants[m.id] ?? '';
}
sql +=
  'REVOKE UPDATE,DELETE ON attempt_questions,attempt_events,admin_test_events,attempt_recoveries,audit,simulation_events FROM nbc_runtime;\n' +
  'REVOKE DELETE ON prize_draws,prize_draw_entries FROM nbc_runtime;\n';
sql +=
  'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA nbc FROM PUBLIC,anon,authenticated,service_role;\n';
await writeFile(file, sql);
console.log(`Exported ${migrations.length - index - 1} reviewed forward migrations.`);
