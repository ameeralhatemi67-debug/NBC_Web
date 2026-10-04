# NBC competition platform

Arabic RTL competition application with participant SMS OTP, saved participation, and an admin security setup center.

For direct admin sign-in on the Vercel domain, use the [Vercel account sign-in setup](docs/implementation/2026-10-04-admin-access-fix.md). Cloudflare Access is an alternative. Both require explicitly allowlisted staff accounts; the demo role picker remains local-only.

The OTP code and deployment path are implemented. Real SMS activation still requires the organization's Unifonic account, approved Saudi sender, production secrets, managed PostgreSQL, and staff identity setup. See [the deployment guide](docs/implementation/2026-10-04-production-otp.md) and [the implementation specification](docs/implementation/NBC_OTP_Production_Implementation_Spec.md).

## Local development

Requires Node.js 22.19 or newer supported Node.js. Install pinned dependencies with `npm ci`. For a new checkout, copy `.env.example` to `.env.local`, then run:

```powershell
npm run dev
```

Open [registration](http://127.0.0.1:3000/register) or [admin](http://127.0.0.1:3000/admin). Preserve existing secrets when merging environment changes into an existing `.env.local`.

Local simulation requires explicit `NBC_RUNTIME_MODE=demo`, `OTP_PROVIDER=fake`, and a six-digit `NBC_DEMO_OTP` chosen in `.env.local`. Enter that local fixture manually. The UI labels simulation but never displays the code. The API never returns it. Fake mode and the role picker are blocked in production; demo HTTP access is restricted to loopback. Keep demo data synthetic. Remote demo sharing is no longer supported.

Local PGlite storage defaults to `.data/nbc`. Run one process per PGlite directory. Production always requires `DATABASE_URL`; it never falls back to `/tmp` or PGlite. Local sample participants are seeded only in explicit local mode with PGlite. Production starts sample questions unapproved so the committee must edit/review them before participation can begin.

## Production deployment

1. Provision a fresh UTF-8 PostgreSQL database with TLS, backups and a tested restore procedure.
2. Configure production environment variables from the deployment guide. Use secure server/deployment secret storage.
3. With the deployment environment loaded, run `npm run db:migrate` as a release step, then `npm run build` and start/deploy the application.
4. Configure Cloudflare Access for the staff paths, require MFA, and allowlist staff subjects. Public participant paths remain public.
5. Open Admin > إعداد التحقق والأمان. Complete sender/account approvals, check readiness, run the real SMS verification test, acknowledge internal operational checks, and activate.
6. Schedule `npm run db:cleanup` daily with the same database/security environment. Monitor delivery errors, abuse counts, costs and database backups.

Migration/cleanup commands read the process environment. In local development with Node.js 22, use `node --env-file=.env.local --import tsx scripts/migrate.mjs` or the corresponding cleanup script. Do not use demo environment files for production.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration
npm run test:postgres
npm run test:admin-access
npm run format:check
```

`test:integration` uses a fresh PGlite directory and port 43187 for existing competition and backup/restore regressions. `test:postgres` starts an isolated UTF-8 PostgreSQL cluster on loopback port 43189, repeats the OTP security suite, then tests the built app in production mode on port 43188. External provider/JWKS requests are mocked only by the test-process preload; the application still uses its production adapter and JWT verifier. No paid SMS is sent. Captured test codes stay in memory/IPC and are checked for absence from HTTP responses and logs.

## Data and recovery

Use managed PostgreSQL backups for production. Never import a demo snapshot into production. Identity lookup keys must be retained with separately controlled secret backups. Losing or casually rotating the identity key prevents account lookup; readiness rejects a key that does not match the database.

The admin backup endpoint supports local PGlite only. Restore into a new directory:

```powershell
node scripts/restore.mjs path/to/nbc-demo-backup.tar.gz .data/restored-demo
```

Restoration preserves competition data but removes restored sessions/challenges and resets OTP activation. Existing destinations are refused. Legacy session rows are preserved by schema migration but rejected by production authentication; users authenticate again through OTP.

## Structure

- `src/lib/database.ts`, `migrations.ts`, `db.ts`: PostgreSQL/PGlite adapter, ordered transactional schema migrations, initialization.
- `src/lib/otp*.ts`, `security-store.ts`: provider, cryptography, challenge lifecycle, readiness, database-backed limits and retention.
- `src/lib/staff-auth.ts`, `request-security.ts`, `runtime.ts`: staff JWT checks, request protections and runtime boundaries.
- `src/components/registration.tsx`, `otp-entry.tsx`, `admin-security.tsx`: participant OTP and Arabic administrator setup.
- `tests`: domain, migration, security, production HTTP and competition regression checks.
