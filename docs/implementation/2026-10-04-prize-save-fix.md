# Prize saving and Supabase storage

The production deployment could authenticate committee staff, but had no `DATABASE_URL`. `/api/admin` and `/api/admin/prizes` returned 503. The admin fallback displayed default values even though storage was unavailable, while the public homepage correctly withheld unavailable prize details.

The repair uses the existing PostgreSQL adapter and prize settings transaction. Save responses now contain the committed prize values and incremented version, and the audit entry identifies the authenticated staff actor. The editor keeps this authoritative version for later saves. A failed panel refresh after a committed save is reported separately. Missing storage disables editing/saving, explains that the displayed values are unsaved defaults, and offers a retry.

## Supabase configuration

NBC uses a private `nbc` schema inside the existing **BookQuest** project (`dciaumziiwdoudjgiexf`). This avoids another Supabase project while keeping application tables and credentials separate. No existing BookQuest table or application setting was changed.

Remote migrations applied through Supabase:

- `nbc_private_storage_role`: dedicated `nbc_app` login, private schema ownership, `search_path=nbc,pg_catalog`, no superuser/database/role creation or RLS bypass privileges, no Supabase API-role schema grants, restricted default object privileges, bounded statement/idle transaction timeouts.
- `nbc_baseline_and_secure_otp_private`: the deployed application's existing `001_baseline` and `002_secure_otp` definitions, migration markers, stable identity-key check, and RLS on all eleven NBC tables. These tables deliberately have no public API policies. NBC's server role owns them; authorization remains enforced by the application.

Verified privilege metadata: `anon`, `authenticated`, and `service_role` cannot use the NBC schema; `nbc_app` has no read/write privileges on existing `public`, `private`, `auth`, or `storage` tables. Supabase's informational “RLS Enabled No Policy” findings for NBC are intentional deny-by-default behavior. Existing BookQuest findings are outside this repair.

Production Vercel environment variables:

- `DATABASE_URL`: sensitive, dedicated NBC login through `aws-0-ap-northeast-1.pooler.supabase.com:6543`, transaction pooling.
- `DATABASE_SSL_CA`: Supabase's public production CA PEM. The adapter requires certificate validation. When this is configured, URL SSL parameters are rejected because node-postgres otherwise overwrites the trusted CA options.
- `IDENTITY_LOOKUP_SECRET`: sensitive, random independent key matching the migration key check. Preserve it across deployments.

The CA is obtained from the certificate link in Supabase Database Settings. No administrator database password is reset, no service-role API key is used, and no certificate check is disabled. Credentials are not stored in source control. Role defaults were verified through the transaction pooler.

## Scope and validation

The production source is based on deployed commit `1f8e7b4a7450c71f4a42af998e32e721b4e89e75` plus this focused fix. The separate, uncommitted competition expansion remains in the main workspace; its migrations 003/004 and new competition engine are not part of this hotfix.

Commands run on the isolated production source:

```text
npm run typecheck
npm test                         # 41 passed
npm run build
npm run test:integration         # 43 passed
npm run test:admin-access        # 9 passed
npm run test:postgres            # 17 PostgreSQL + 17 production HTTP checks passed
```

Tests cover committed prize values/version, stale-save rejection, admin/editor separation, public rendering, missing-database failure without false success, trusted CA enforcement, OTP, staff authentication, migrations, and production safeguards.

Participant SMS activation still requires the previously documented provider setup and evidence. This storage repair does not enable OTP, send reminders, publish competition results, or create participant attempts.
