# NBC database disconnection checkpoint

The owner explicitly requested removal of NBC's connection to BookQuest and designated the dedicated **NBC** Supabase project as the only future target:

- Project ref: `eerfhnaduachqluowsdo`
- Dashboard: https://supabase.com/dashboard/project/eerfhnaduachqluowsdo
- API URL: https://eerfhnaduachqluowsdo.supabase.co
- Database host: `db.eerfhnaduachqluowsdo.supabase.co`
- Verified project name/status/region: NBC / ACTIVE_HEALTHY / eu-central-1.
- Read-only inspection found no application tables in `public` or `nbc` at this checkpoint. Reinspect before future migrations.

## Cleanup performed

1. Exported NBC prize settings and the four audit entries to the ignored local file `.data/retired-bookquest-nbc-snapshot.json`. This is a settings/audit snapshot, not a complete database backup. No credentials are included.
2. Applied `nbc_revoke_retired_bookquest_connection` to BookQuest (`dciaumziiwdoudjgiexf`): `ALTER ROLE nbc_app NOLOGIN PASSWORD NULL;`.
3. Terminated sessions belonging only to `nbc_app`. None were active at the check.
4. Cleared the production `DATABASE_URL` value in Vercel project `nbc-web` (`prj_wsjRUAqamQTgnYoNuZIOUi95pGJh`). The empty sensitive variable remains as a configuration slot. No BookQuest connection string remains in the project's current value.
5. Kept staff authentication, session secrets, `IDENTITY_LOOKUP_SECRET`, and the public Supabase TLS CA configuration intact. These are NBC security settings, not an active BookQuest connection.
6. Redeployed the existing source commit `a4f9697c67bbfab6238e7c5adfcae2037d4314dc` with the latest project settings. Deployment `dpl_77i1rXhDuTNxfNA3qaRc9A1K6RL6` reached READY and serves `nbc-web-two.vercel.app`. The uncommitted competition expansion was not included.

SQL verification confirmed `role_can_login=false`, `role_has_password=false`, and `active_connections=0`. NBC had zero real participants and attempts. The isolated NBC schema and its records were retained; unrelated BookQuest application data was not altered. Do not reenable the retired role, rerun old `.data/*prize-storage*` helpers, or reconnect NBC to BookQuest.

An independent public browser confirmed the homepage still loads and now displays the expected prize-unavailable message. [Deployment evidence](supabase-disconnected-deployment.jpg) records the READY production release. `git diff --check` passed. This cleanup changed infrastructure configuration and documentation, not application code; the existing application suites were not rerun.

## Current operational state

NBC is deliberately disconnected from application storage until the next session configures the dedicated project. Public informational content remains available; prize data and other database-backed operations can report unavailable. This is expected during the requested disconnection. The prior prize-save code fix remains in place, and needs verification against the correct database after reconnection.

The dedicated NBC project was inspected read-only. No schema, role, migration, API key, or database password was created/changed there by this cleanup. The owner-provided `[YOUR-PASSWORD]` connection string is a template, not a usable secret.

## Next session

Use [NBC_BACKEND_NEXT_SESSION_PROMPT.md](NBC_BACKEND_NEXT_SESSION_PROMPT.md). Preserve the dirty workspace and reconcile it with upstream main before release. Inspect the existing locally implemented competition engine and migrations; finish the production backend rather than recreating those features.
