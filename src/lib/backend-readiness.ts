import type { Database } from './database';
import { migrationsCurrent } from './migrations';

// Admin-only aggregate diagnostics. Never include URLs, keys, identities or answers.
export async function backendReadiness(db: Database) {
  const context = (await db.query('SELECT current_user AS role,current_schema() AS schema'))
    .rows[0];
  const counts = (
    await db.query(`SELECT
    (SELECT count(*) FROM participants)::int AS participants,
    (SELECT count(*) FROM attempts WHERE competition_id <> 'legacy-demo')::int AS attempts,
    (SELECT count(*) FROM questions WHERE body ? 'stage')::int AS questions,
    (SELECT count(*) FROM admin_test_runs)::int AS admin_test_runs`)
  ).rows[0];
  return {
    project: process.env.NBC_SUPABASE_PROJECT_REF ?? null,
    adapter: db.kind,
    ...context,
    migrationsCurrent: await migrationsCurrent(db),
    counts,
  };
}
