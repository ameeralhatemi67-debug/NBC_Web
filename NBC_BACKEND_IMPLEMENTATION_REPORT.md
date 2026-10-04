# NBC backend implementation report

The competition expansion is deployed with private PostgreSQL storage in the dedicated NBC Supabase project `eerfhnaduachqluowsdo`. Real staff sign-in, prize persistence and the shared competition test flow are verified live. The real campaign remains DRAFT and participant OTP is inactive.

## Implemented architecture

Existing Next.js APIs, PostgreSQL/PGlite adapters, Vercel staff identity/MFA allowlists, OTP security and UI are preserved. Persistent entities cover participants/sessions, OTP/security limits and events, competitions/books/question versions/frozen banks, attempt snapshots/answers/idempotent events, isolated admin tests, recoveries/corrections, settings/prizes and audit. There are 22 private RLS tables and seven source migrations. Runtime has no schema ownership, DDL or RLS bypass. The verified transaction pooler is `aws-1-eu-central-1.pooler.supabase.com:6543`; every transaction sets the private search path and validates TLS using the public CA.

Migrations 001–004 are preserved. Forward 005–007 add integrity/index/reset protections, database enforcement of immutable snapshots/first checks/submissions, and fixed trigger search paths. One source generates reviewed Supabase release SQL; both migration trackers are populated transactionally. Every source ID/checksum is checked. Empty NBC enrollment uses the retained deployment identity key once; later mismatch cannot rotate it.

The existing competition engine provides server-derived 20-question stage banks, immutable shuffled keys/order, campaign uniqueness, lifecycle/grace/recovery enforcement, editable selection before first Check, formal non-disclosure, educational feedback after lock, score/percentage/participant-number receipts, stage ties and explicit publication. Corrections award consistent credit while preserving original locks/snapshots and audit.

Admin tests reuse that engine and the actual reader/Participation/leaderboard. Missing official content can be tested with explicit synthetic snapshots confined to admin-owned test storage. Reset now invalidates old sessions/events transactionally. Real participants, attempts, results, prizes and analytics remain separate. Synthetic test data cannot be frozen or approved as official content.

IndexedDB persists ordered events before acknowledgment, with idempotent replay/lost-response recovery, server lock/revision conflict handling, reconnect/auth/deadline checks and visible save states. No offline app-shell service worker is promised. The SHA-256 pinned 66-page PDF is prepared and traced into the server release for integrity checks, with digital/printed page metadata, hints and responsive reader controls.

The validated ignored snapshot restored prize version 5, podium amounts totaling SAR 52,000 and four original audit entries with their attribution/timestamps. Import records a separate system action and digest. Successive saves return committed versions, reject stale saves and affect the dynamic public homepage.

## Verification

Automated and live evidence is recorded below. External-provider mocks do not certify actual SMS delivery.

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
| `node scripts/verify-live.mjs` | 14 live HTTP checks passed; SAR 52,000 and exact PDF hash verified |

The new PostgreSQL runner repeats competition/migration tests against isolated loopback schemas, adds actual anon/authenticated/service-role/runtime privilege tests, owner/RLS behavior, operator/runtime separation, initial key enrollment, stale row-lock rejection and checksum verification. Startup/phase failure can no longer silently pass; it chooses a free local database port. OTP/provider/JWKS HTTP suites mock external network services only, never live SMS.

Direct NBC pooler verification confirmed `tlsEncrypted=true`, `tlsAuthorized=true`, runtime user `nbc_runtime` and schema `nbc`. Supabase read-only metadata confirms all tables have RLS, private access is denied to anon/authenticated/service_role, and no real participants/attempts exist. The security advisor has no findings after the forward path fix.

## Live verification

Production release `dpl_6h7TxZ1r5KAYarkiahS4RukN9AC2`, source `8f3732e95b83b979696227c175d9c6b7032b8673`, reached READY on https://nbc-web-two.vercel.app/. Upstream prize hotfix ancestry was merged while preserving the existing expansion and unrelated local work. The follow-up verification release adds the operator storage panel and prevents a PostgreSQL backup request from falsely recording a local backup action.

- Real Vercel staff sign-in opened the database-backed admin dashboard. Successive layout saves committed versions 6 and 7; a fresh staff reload retained podium layout and all original amounts. An independent public browser displayed SAR 52,000. NBC audit identifies the authenticated staff actor; four imported historical entries retain their original attribution.
- The complete middle-stage shared test flow locked all 20 answers, replayed ordered offline events, submitted once, and displayed `TEST-613419`, 5/20, 25%, and its stage leaderboard. Supabase confirms revision 41, 20 locks and matching receipt/score. These are synthetic admin test results, never real participants or winners.
- High-school educational testing disclosed no key before Check and showed feedback after the accepted lock. Reset with queued offline work invalidated the old session, preserving its one server lock; the replacement had revision 0 and no answers. University sessions contain 20 stage-specific snapshots. All three stage forms run through the same engine.
- The real PDF reader rendered the pinned book, page 29 and source/hint jumps, with zoom controls. Read-only live checks confirm the original and immutable PDFs, worker and public book/terms are available. Anonymous staff/participant endpoints deny access, demo staff is disabled, hidden leaderboard returns 403, and foreign-origin mutations return 403.
- Mobile staff/test UI at a 390px viewport has RTL layout without page overflow (375px content width). The reader opens as a focused dialog; Shift+Tab/Tab wrap between its last link and first button, and Escape returns focus to the source button. Browser error/warning capture was empty after the test flow. Temporary viewport overrides were removed.
- Verification release `dpl_5iYwU61Tuy8wWqnb2MrEbwsnvvxW`, source `fc4817febb22cafeb23dbccfa5f7a840102494bc`, reached READY. A fresh authenticated load shows project `eerfhnaduachqluowsdo`, adapter `postgres`, schema `nbc`, role `nbc_runtime`, current migrations and real counts 0/0/0. Original prizes remain version 7/podium/SAR 52,000; all test snapshots/locks and the university reader's page 15 survive. The real campaign is DRAFT, OTP/provider activation remains disabled, SMS metrics are zero, and the Supabase security advisor still returns no findings. All 14 live HTTP checks passed again after this redeployment.
- Evidence: [prize save](docs/implementation/nbc-backend-prize-save.jpg), [shared test view](docs/implementation/nbc-backend-test-receipt.jpg), [mobile flow](docs/implementation/nbc-backend-mobile.jpg), [live storage diagnostic](docs/implementation/nbc-backend-live-readiness.jpg). This final documentation/evidence checkpoint does not change application behavior or database contents.

## Operations and remaining launch work

See `docs/implementation/NBC_BACKEND_OPERATIONS.md` for exact connection/migration/import/retention/diagnostic/backup/recovery/rollback procedures. Daily cleanup scheduling, actual managed-backup entitlement and an operator restore rehearsal need launch evidence; no paid infrastructure was purchased. The source snapshot is not a full backup.

Unifonic AppSid, approved Saudi sender, real handset verification and explicit activation remain external provider steps. The server-only OTP HMAC key is configured; original identity/staff secrets are retained. OTP is not activated and no real messages, reminders, participant attempts or results are generated for deployment tests.

All 60 official questions and their exact digital/printed source/hint mappings still require committee review. The book stays unapproved and the bank stays empty. A reviewed accessible Arabic transcript remains a content dependency. These content/provider gates are separate from backend functionality and remain visible in admin.
