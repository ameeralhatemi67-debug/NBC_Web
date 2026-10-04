# NBC backend implementation report

The competition expansion has been completed for private PostgreSQL storage in the dedicated NBC Supabase project `eerfhnaduachqluowsdo`. Deployment/live verification is being completed before final handover. The real campaign remains DRAFT and participant OTP is inactive.

## Implemented architecture

Existing Next.js APIs, PostgreSQL/PGlite adapters, Vercel staff identity/MFA allowlists, OTP security and UI are preserved. Persistent entities cover participants/sessions, OTP/security limits and events, competitions/books/question versions/frozen banks, attempt snapshots/answers/idempotent events, isolated admin tests, recoveries/corrections, settings/prizes and audit. There are 22 private RLS tables and seven source migrations. Runtime has no schema ownership, DDL or RLS bypass. The verified transaction pooler is `aws-1-eu-central-1.pooler.supabase.com:6543`; every transaction sets the private search path and validates TLS using the public CA.

Migrations 001–004 are preserved. Forward 005–007 add integrity/index/reset protections, database enforcement of immutable snapshots/first checks/submissions, and fixed trigger search paths. One source generates reviewed Supabase release SQL; both migration trackers are populated transactionally. Every source ID/checksum is checked. Empty NBC enrollment uses the retained deployment identity key once; later mismatch cannot rotate it.

The existing competition engine provides server-derived 20-question stage banks, immutable shuffled keys/order, campaign uniqueness, lifecycle/grace/recovery enforcement, editable selection before first Check, formal non-disclosure, educational feedback after lock, score/percentage/participant-number receipts, stage ties and explicit publication. Corrections award consistent credit while preserving original locks/snapshots and audit.

Admin tests reuse that engine and the actual reader/Participation/leaderboard. Missing official content can be tested with explicit synthetic snapshots confined to admin-owned test storage. Reset now invalidates old sessions/events transactionally. Real participants, attempts, results, prizes and analytics remain separate. Synthetic test data cannot be frozen or approved as official content.

IndexedDB persists ordered events before acknowledgment, with idempotent replay/lost-response recovery, server lock/revision conflict handling, reconnect/auth/deadline checks and visible save states. No offline app-shell service worker is promised. The SHA-256 pinned 66-page PDF is prepared and traced into the server release for integrity checks, with digital/printed page metadata, hints and responsive reader controls.

The validated ignored snapshot restored prize version 5, podium amounts totaling SAR 52,000 and four original audit entries with their attribution/timestamps. Import records a separate system action and digest. Successive saves return committed versions, reject stale saves and affect the dynamic public homepage.

## Verification

Current automated evidence is recorded below; final live evidence and release IDs are added after deployment.

| Command | Result |
| --- | --- |
| `npm test` | 53 tests passed; no skips |
| `npm run test:integration` | 38 isolated PGlite HTTP/backup checks passed |
| `npm run test:postgres` | 57 checks passed: 17 OTP, 14 competition/migration, 9 private storage, 17 production HTTP; no skips |
| `npm run test:admin-access` | 9 production HTTP staff-access checks passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; immutable PDF included in API trace |
| `npm run format:check` | Passed |
| `git diff --check` | Passed |

The new PostgreSQL runner repeats competition/migration tests against isolated loopback schemas, adds actual anon/authenticated/service-role/runtime privilege tests, owner/RLS behavior, operator/runtime separation, initial key enrollment, stale row-lock rejection and checksum verification. Startup/phase failure can no longer silently pass; it chooses a free local database port. OTP/provider/JWKS HTTP suites mock external network services only, never live SMS.

Direct NBC pooler verification confirmed `tlsEncrypted=true`, `tlsAuthorized=true`, runtime user `nbc_runtime` and schema `nbc`. Supabase read-only metadata confirms all tables have RLS, private access is denied to anon/authenticated/service_role, and no real participants/attempts exist. The security advisor has no findings after the forward path fix. Live authenticated save/test-run verification is pending release.

## Operations and remaining launch work

See `docs/implementation/NBC_BACKEND_OPERATIONS.md` for exact connection/migration/import/retention/diagnostic/backup/recovery/rollback procedures. Daily cleanup scheduling, actual managed-backup entitlement and an operator restore rehearsal need launch evidence; no paid infrastructure was purchased. The source snapshot is not a full backup.

Unifonic AppSid, approved Saudi sender, real handset verification and explicit activation remain external provider steps. The server-only OTP HMAC key is configured; original identity/staff secrets are retained. OTP is not activated and no real messages, reminders, participant attempts or results are generated for deployment tests.

All 60 official questions and their exact digital/printed source/hint mappings still require committee review. The book stays unapproved and the bank stays empty. A reviewed accessible Arabic transcript remains a content dependency. These content/provider gates are separate from backend functionality and remain visible in admin.
