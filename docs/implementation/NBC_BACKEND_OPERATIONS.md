# NBC backend operations

Only Supabase `eerfhnaduachqluowsdo` is authorized. The application uses private schema `nbc`, Vercel production project `nbc-web`, and the existing Next.js APIs, participant OTP and Vercel staff identity flow. Do not reconnect retired storage or use another Supabase project for NBC.

## Connection and access

The dashboard Connect dialog verified `aws-1-eu-central-1.pooler.supabase.com:6543`, transaction pooling. Runtime username is `nbc_runtime.eerfhnaduachqluowsdo`. The password and URL are server-only sensitive Vercel configuration. Keep the existing staff and identity secrets. `NBC_DATABASE_SCHEMA=nbc` and `NBC_SUPABASE_PROJECT_REF=eerfhnaduachqluowsdo` pin the destination. The adapter checks the approved hostname/user/schema and requires the public Supabase CA, validates certificates, and sets `SET LOCAL search_path` inside every transaction, including single queries. Never use URL SSL overrides with the CA or disable validation.

The client pool has at most three connections per function instance, five-second connection timeout, 15-second database statement timeout, ten-second lock timeout, 20-second client query timeout, 30-second idle timeout and five-minute connection lifetime. The login has a 30-connection limit and no superuser, role/database creation, inheritance, replication or RLS bypass. Monitor saturation and Vercel instance growth against Supabase pooler limits before opening; these bounds are not a load-test capacity claim.

`postgres` is the authenticated migration/operator role and owns the schema. Runtime has CRUD on application state, sequence usage, and read-only migration history. Audit, attempt question snapshots, event history and recoveries are append-only for runtime. All 22 tables enable RLS. The only policy is for `nbc_runtime`; it permits this server role to implement NBC's existing cookie/subject authorization. Supabase `auth.uid()` does not represent NBC participants. `anon`, `authenticated`, `service_role` and PUBLIC have no private-schema/table access, even when a role bypasses RLS. Supabase Auth/Data API is not an alternate application access path. There are no SECURITY DEFINER functions; trigger functions have fixed `pg_catalog` search paths.

## Migrations and deployment

`src/lib/migrations.ts` is the single DDL source. Migrations 001–004 remain intact; 005 adds constraints/indexes/reset invalidation, 006 protects attempt snapshots/first checks/submitted state, and 007 fixes function search paths. `nbc.schema_migrations` records each source ID and SHA-256. Readiness verifies every expected ID/checksum; release migration checks checksums and uses a transaction advisory lock. Known legacy rows without checksums are enrolled by the operator migration runner, never by a runtime request.

For initial empty provisioning only, first create the narrowly scoped `nbc_runtime` login through authenticated NBC operator access, then run:

```powershell
node --import tsx scripts/export-fresh-supabase.mjs .data/nbc-fresh.sql eerfhnaduachqluowsdo
```

Review the export and apply it once to the named project through `apply_migration`. It refuses existing NBC tables. Supabase records that reviewed release bundle; the same transaction records individual application migrations. Do not also push a divergent Supabase SQL tree or mark migrations applied separately. Future connector releases derive only pending source migrations:

```powershell
node --import tsx scripts/export-supabase-upgrade.mjs .data/nbc-upgrade.sql eerfhnaduachqluowsdo last-applied-source-id
```

Supply an actual ID such as `006_immutable_attempts`, after inspecting history. The generated upgrade verifies all prior checksums, refuses duplicate application IDs, and acquires the same migration lock. Alternatively, an operator can run `npm run db:migrate` with the verified NBC operator connection, CA, schema/ref and original identity key loaded in secure process configuration. The migration script explicitly opts into operator access; application requests never do. Do not use the runtime login for DDL. Grant/review RLS and runtime permissions explicitly for any newly added tables.

Apply forward migrations, run disposable tests/build, deploy the reviewed source, then verify the canonical domain, authenticated admin, diagnostics and persistence. Preview deployments receive no production database URL. Never override demo mode or weaken authentication to verify a deployment.

The first empty NBC export authorizes one identity-key enrollment with `identity_key_bootstrap_pending`. The application enrolls the existing Vercel key under an advisory lock only if participants and OTP challenges are empty, removes the marker and records a system audit. A missing unauthorized marker, existing identity/challenge, or later mismatch fails closed. No old database identity marker or secret is imported.

## Restoring the verified prize snapshot

`scripts/import-nbc-snapshot.mjs` validates the zero-participant/attempt snapshot, version 5, podium layout, SAR 52,000 and four coherent historical staff actions. It imports only prizes and original audit attribution/timestamps, records the export digest and a separate system import audit, and refuses conflicting imports or staff changes. The source snapshot is ignored local evidence, not a database backup; it contains no credentials. It does not import demo questions or initialization/identity markers.

```powershell
node --import tsx scripts/import-nbc-snapshot.mjs .data/retired-bookquest-nbc-snapshot.json
# With verified NBC runtime configuration loaded securely:
node --import tsx scripts/import-nbc-snapshot.mjs .data/retired-bookquest-nbc-snapshot.json --apply
```

Prize saves lock the current settings, reject stale versions, return committed values/version and audit the actual staff actor. The public homepage is dynamically rendered. After test edits, restore original amounts/layout through the same authenticated form; the version increases, preserving evidence.

## Launch and administrator tests

Keep the real campaign DRAFT, formal feedback and publication after close. Approve the exact book/hash, import reviewed drafts, approve exactly 20 active questions for each stage and freeze before scheduling/opening. Changing a draft question creates a version; frozen/started snapshots retain their keys, stage and shuffled option mapping. First accepted Check locks permanently. Completion calculates score/percentage and keeps a competition-unique participant number. Equal scores share ranks without time-based tie-breaking. Technical extensions and invalid-question credit require privileged reasons and preserve evidence; publication waits for grace/recovery windows.

Admin > تجربة الإدارة runs the same engine, Participation/PDF/leaderboard components and durable queue for each stage. With an incomplete official bank, the UI explicitly requests synthetic test questions. These exist only in owned `admin_test_runs` snapshots, never `questions`, real participants/attempts, awards or analytics. The banner remains visible, including the receipt. Reset locks and invalidates the old session while creating a fresh namespace; old events return TEST_RESET. Editors, participants and other admins cannot read/mutate the session. Tests do not send reminders or open/publish the real campaign.

## Diagnostics, incidents and retention

An authenticated admin can inspect `/api/admin/backend` for project/schema/role, migration readiness and aggregate real/test counts. It contains no connection URL, secret or answer key. `/api/admin/security` checks identity-key agreement and OTP/provider readiness. Unauthenticated/editor access is denied. Public homepage/book availability alone is not database evidence.

If saves fail, keep pending IndexedDB events and retry after restoring auth/connectivity. Do not clear browser storage or create another participant attempt. The server's first locks win; lost responses retry idempotently. Grace/technical deadlines use server receipt time. No service worker caches the app shell, so a completely offline cold reload is not guaranteed. Do not promise recovery from erased local storage/device loss. Reset admin namespaces remain separate from participants.

Run `npm run db:cleanup` daily in an authorized operator environment with the NBC runtime connection. It removes expired OTP payloads after 24 hours, rate events after 25 hours, idle locks after 48 hours, expired sessions and security events after 90 days. Scheduling and approved participant/backup retention are operator launch checks. No reminder service is activated by cleanup. Do not delete attempts, answer snapshots, corrections or audit as routine cleanup.

Back up the managed database and the original identity/staff keys in separately controlled secret storage. Confirm actual Supabase backup retention/PITR entitlement in NBC's dashboard before launch; this release does not purchase upgrades. For a logical operator export, use verified TLS with `pg_dump --schema=nbc --no-owner --no-acl`, keep the backup encrypted and access-restricted, and preserve the migration source/access-grant runbook. A role/CA/key export is separate from row data. Rehearse restoration on an isolated disposable PostgreSQL environment, with matching keys and the reviewed migrations/grants. Invalidate restored sessions/OTP challenges and return `otp_security` to inactive before any traffic. PGlite `scripts/restore.mjs` is only for local backups and must never restore into production.

Rollback code to a compatible known release without reversing additive migrations or discarding participant data. The pre-expansion release is not a safe campaign rollback after real competition data exists. Keep the campaign closed and OTP inactive during an incident; preserve queues, audit and snapshots. Database restore is an operator-reviewed last resort with an explicit recovery point, because it can discard later writes. Record incident authority and backup/restore evidence before launch.

## External/content gates

The backend does not certify sender approval, vendor/privacy acknowledgments, staff MFA enforcement, hosting transfer review, backup entitlement or SMS delivery. Unifonic AppSid and an approved Saudi sender, a real handset test, and explicit admin activation are still required. No mock satisfies these checks. Do not request secrets in chat; use secure deployment configuration.

The official question bank remains empty until 60 exact-page questions and pagination evidence are reviewed. See `QUESTION_BANK_PENDING_REVIEW.md`. The encoded PDF still needs a reviewed accessible transcript. Real registration, opening, reminders and results publication remain blocked pending the corresponding launch checks.
