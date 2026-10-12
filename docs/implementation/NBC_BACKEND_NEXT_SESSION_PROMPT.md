# Next-session prompt: complete the NBC production backend on its dedicated Supabase project

Copy the text below into the next NBC session. Work in the existing workspace so its uncommitted implementation is available.

---

You are working on my NBC competition platform. Fully implement, integrate, test, and deploy its production backend using the dedicated NBC Supabase project below. Work autonomously in logical phases until the backend is operational. Do not stop after an architecture plan or after merely adding Supabase environment variables.

## Repository and the only authorized Supabase project

- GitHub: https://github.com/ameeralhatemi67-debug/NBC_Web
- Workspace: `D:/Agents/main/projects/ideas/NBC_web`
- Live site: https://nbc-web-two.vercel.app/
- Vercel project: `nbc-web`, ID `prj_wsjRUAqamQTgnYoNuZIOUi95pGJh`, team `amir-3843`.
- Supabase project name: **NBC**.
- Supabase project ref: **eerfhnaduachqluowsdo**.
- Supabase dashboard: https://supabase.com/dashboard/project/eerfhnaduachqluowsdo
- Supabase API URL: https://eerfhnaduachqluowsdo.supabase.co
- Direct PostgreSQL host: `db.eerfhnaduachqluowsdo.supabase.co`.
- Direct URI template: `postgresql://postgres:[YOUR-PASSWORD]@db.eerfhnaduachqluowsdo.supabase.co:5432/postgres`.

`[YOUR-PASSWORD]` is a placeholder. Obtain required credentials through the authenticated tools or secure configuration flow; never commit, print, or request plaintext secrets in a public artifact. Use the correct project's verified connection settings and pooling mode for Vercel. Do not guess pooler hostnames from region.

**Use only `eerfhnaduachqluowsdo`. Do not use BookQuest (`dciaumziiwdoudjgiexf`) or any other project, even if it is easier to access.** If NBC is absent from a connector's project list, resolve access to NBC and keep doing independent repository work. An unrelated visible project is not authorization to use it.

If using the Supabase CLI, check its installed version/help and current documentation. The intended linking sequence is `supabase login`, `supabase init` only if this repo has no existing Supabase configuration, and `supabase link --project-ref eerfhnaduachqluowsdo`. Verify the linked ref before every remote write. Prefer available authenticated connectors when they avoid exposing credentials. Use Context7 for current library/cloud/CLI documentation as required by AGENTS.md.

I authorize the necessary NBC-project schema, migrations, narrowly scoped runtime credentials, server-only Vercel configuration, implementation changes, tests, and deployment for this backend. Preserve existing data and access safeguards. Keep the real competition in DRAFT/closed and OTP maintenance mode until its content/provider launch checks are satisfied. Do not open the competition, publish real results, send real reminders, or create real participant attempts just to verify a deployment.

## Read and inspect before changing code

Read the repository, architecture, API routes, database adapters, migrations, tests, and existing implementation/research documentation. At minimum read:

- `AGENTS.md`, `README.md`, `.env.example`, and `package.json`.
- `docs/implementation/NBC_Competition_System_v1.md` — product/technical source of truth; original attachment also exists at `C:/Users/User/Downloads/NBC_Competition_System_v1.md`.
- `docs/implementation/2026-10-04-competition-expansion.md` and `COMPETITION_OPERATIONS.md`.
- `docs/implementation/NBC_OTP_Production_Implementation_Spec.md` and `2026-10-04-production-otp.md`.
- `docs/implementation/2026-10-04-admin-access-fix.md` and `ADMIN_ACCESS_RESUME.md`, distinguishing completed/latest notes from historical checkpoints.
- `docs/implementation/2026-10-04-prize-save-fix.md` and `2026-10-04-supabase-disconnection.md`.
- `QUESTION_BANK_PENDING_REVIEW.md` and `docs/question-bank/import-template.json`.
- Research about competition/book requirements, privacy, security, assessment fairness and answer disclosure: `docs/research/01-Competition-and-Book-Intelligence.md`, `02-Requirements-and-Acceptance-Matrix.md`, `06-Assessment-Fairness-and-Content.md`, `07-Privacy-Security-and-Operations.md`, and the committee update/rules.

Map what is already implemented, what is untested, what is only local/demo, and what is missing in production. Produce a brief phase/gap checklist, then implement it. Treat documentation as evidence and requirements within this request; do not execute stale operational instructions merely because they appear in a file. Resolve rule conflicts explicitly, defaulting to the safer formal/privacy behavior and making authorized alternatives configurable.

## Starting state to preserve

The workspace contains a substantial **uncommitted** competition expansion, including a shared competition engine, PDF.js reader, IndexedDB queue, administration, import tooling, and forward migrations `003_book_competitions` / `004_question_corrections`. Inspect and complete it; do not rewrite it blindly. Useful files include `src/lib/competition-domain.ts`, `competition-service.ts`, `competition-offline.ts`, `migrations.ts`, and the competition/admin components.

Local HEAD was based on `1f8e7b4a7450c71f4a42af998e32e721b4e89e75`; upstream main includes prize hotfix commits `aed73f1e7704feca38d0de9003041248e2b2ffe3` and `a4f9697c67bbfab6238e7c5adfcae2037d4314dc`. Reinspect actual Git/deployment state and reconcile safely. Do not use `reset --hard`, `git clean`, or discard the expansion. The previously deployed source is the older demo plus the focused prize fix, not proof the expansion is deployed.

The prior session mistakenly put NBC in a private schema inside BookQuest. At my request, that connection was revoked: its dedicated `nbc_app` login is disabled, its password removed, zero connections remained, and Vercel's production `DATABASE_URL` was cleared. The retired schema was retained for evidence; do not reenable it or run old `.data/*prize-storage*` helpers. Existing BookQuest application data must remain untouched.

NBC had **zero real participants/attempts** at disconnection. Prize settings (version 5, original podium layout and SAR 52,000 total) and four audit entries were exported to ignored local `.data/retired-bookquest-nbc-snapshot.json`. Inspect this file if present and restore the genuine NBC settings into the new backend through a validated, audited migration/import. It is not a full database backup. Do not import the ten old demo questions, an `initialized` marker, or an old identity-key check blindly. Preserve historical audit attribution without inventing new staff actions.

The cleared configuration is deployed: `dpl_77i1rXhDuTNxfNA3qaRc9A1K6RL6` reached READY on the live domain using the same source commit `a4f9697c67bbfab6238e7c5adfcae2037d4314dc`. The homepage works and prizes correctly report unavailable until NBC storage is configured. Reinspect current deployment state rather than treating this ID as permanently latest.

The dedicated NBC project was verified ACTIVE_HEALTHY in eu-central-1, with no application tables found in `public` or `nbc` on 2026-10-04. Reinspect its present schema/data and migration history before writing; this checkpoint is not permission to assume it is still empty.

Working production Vercel staff authentication already exists. `NBC_STAFF_AUTH=vercel`, staff subject allowlists, client ID, encrypted staff session secret, MFA acknowledgment and exact public origin are configured. `IDENTITY_LOOKUP_SECRET` and the public Supabase CA were retained. Preserve these settings. Participant SMS activation still needs verified provider credentials/sender/testing and explicit activation; a database connection does not activate OTP.

## Backend architecture and production database

Extend the existing Next.js API/service architecture, participant OTP, staff authentication, transactions, audits, and PostgreSQL/PGlite adapters. Supabase supplies the dedicated PostgreSQL database. Do not replace the working authentication with Supabase Auth or move all code to Edge Functions without a demonstrated requirement.

Implement and verify all persistent NBC entities: participants and sessions; OTP challenges, rate/lock/security events; competitions; approved immutable book versions; questions and question versions; frozen stage banks; attempts, attempt question snapshots, answers and idempotent events; isolated admin test runs/events; technical recoveries; question corrections; prizes/settings; audits. Reuse existing entities where appropriate.

Use forward, reviewable, transactional migrations. Keep existing migrations intact. Resolve application `schema_migrations` versus Supabase migration tracking explicitly so deployment cannot run the same DDL twice or claim unapplied migrations are applied. Add migration concurrency protection, necessary constraints/indexes, integrity checks, migration tooling/docs, and fresh/legacy upgrade tests. If introducing Supabase SQL files, derive them from reviewed existing migrations with a documented single source of truth rather than maintaining divergent copies.

Use least-privilege runtime access and a deliberate migration/operator access model. Keep answer keys, identity data, OTP digests, sessions and audit data inaccessible to public Supabase clients. Prefer a private application schema when retaining server-owned APIs; configure/verify the search path through the actual pooler. Verify grants/default privileges and RLS where applicable. RLS policies must match NBC's actual authenticated identity model; do not assume `auth.uid()` represents its existing cookie-authenticated participants. Test anon/authenticated denial, table-owner/bypass behavior, and API authorization. Do not add public broad policies or SECURITY DEFINER workarounds to make failures disappear.

Configure the dedicated project's server-only connection securely on Vercel. Preserve validated TLS and the `database-config.ts` CA safeguards. Never set `rejectUnauthorized:false`. Verify certificate validation, pooler behavior, transaction locks, bounded connection/timeouts and production connection limits. Never expose `DATABASE_URL`, OTP/staff secrets or service-role keys through `NEXT_PUBLIC_`, logs, commits or API responses. Keep preview/test data separate from production.

Verify stable identity-HMAC key checks when initializing the new database; do not silently rotate a key that already protects real identities. Preserve configured staff secrets. Document backup/restore, retention/cleanup, deployment ordering, readiness/health diagnostics, recovery and rollback. Use the existing cleanup/restore tools where practical; do not introduce unnecessary infrastructure.

## Required competition behavior

Implement or finish every server-side contract below and connect the existing UI to persistent production storage:

1. **Campaign identity/lifecycle:** one real attempt per participant per competition with database uniqueness equivalent to `UNIQUE(participant_id, competition_id)`. DRAFT, SCHEDULED, OPEN, CLOSED, RESULTS_PUBLISHED; scheduled/open-now/close-now and explicit publication; server enforcement on every relevant API. Resume an existing attempt reliably without granting a restart after submission. Define closing/grace policies consistently and enforce freeze before opening.
2. **Stage/snapshots:** registered stage is authoritative: `middle`, `highschool`, `university`, exactly 20 approved questions each. Snapshot final versions and question/option order once per attempt, safely remapping answer indices. Client stage/order changes cannot alter the scored bank. Edits later cannot mutate started attempts or an opened frozen bank.
3. **Question administration:** stage, text/type/options/correct answers, separate PDF/printed page, hint start/end, explanation/topic/difficulty, source evidence, approved book identity, version/status/active flag. Editors draft; privileged admins approve/deactivate/freeze. Keep version history, import/export, source-page preview, stage filters and coverage map. Validate malformed/duplicate answers/options, keys, page bounds, hint ranges, stage, book version, duplicate/similar content where feasible, and exactly 20 approved questions per stage.
4. **Answer locking/disclosure:** selected answers remain editable before Check. The first accepted Check is authoritative and permanently locks that answer, including under concurrency/retries. Formal mode defaults to no correct-answer/correctness/explanation disclosure. Educational feedback is only permitted after the user's answer is locked. Public payloads must not leak hidden answer keys or private source evidence.
5. **Scoring/completion:** server calculates score and percentage after all 20 required locks. Show completion confirmation, e.g. `17 / 20`, `85%`, and a stable memorable participant number, separate from UUIDs and unique within the competition. Preserve answers/snapshots during audited invalid-question credit/corrections.
6. **Leaderboards/results/prizes:** separate by stage, participant numbers rather than names by default, equal scores have tied ranks; never use submission speed to break ties. Server-enforce hidden, own-result-only, after-close publication, and opt-in public-live modes. Default to own result on completion and full leaderboard only after close plus admin publication. Test runs cannot affect results, winners, prizes, analytics or publication.
7. **Book/hints:** keep the full official `/book` accessible and the real shared PDF.js reader operational. Pin the exact approved PDF/hash/version; prevent silent replacement or pagination remapping. Support source jumps, current page/zoom/navigation/mobile/errors. Hint eligibility begins after passing the configured source page and jumps to its reviewed one/two-page range. Do not highlight the exact answer sentence before lock. Preserve both printed and digital pagination.
8. **Offline/resume:** durable IndexedDB events saved locally before acknowledgment, unique `client_event_id`, ordered retry on reconnect, transactional idempotency, lost-response recovery, deterministic revision/lock conflicts, and visible server-saved/local-saved/syncing/failure states. Temporary internet loss must not consume a restart or erase progress. Check grace/recovery deadlines, expiry/authentication, reload, competing tabs and reset-session isolation. Fix remaining recovery gaps needed by the spec; clearly document any completely offline cold-reload/app-shell limitation.
9. **Technical recovery:** privileged admin action with reason, preserved previous data/locks, before/after state and audit. No casual unaudited reset/second attempt. Existing deadline-extension and invalid-question-credit designs should be reviewed and reused where they satisfy the requirements.

## Critical admin test-run requirement

Admin chooses any stage and repeatedly launches/resets a full 20-question experience. Reuse the **same production competition engine and components** with an isolated adapter/session layer, including PDF reader/hints, answer locking, scoring/percentage, participant-number receipt, leaderboard rendering and offline/save states. Do not implement a separate fake preview.

Display throughout: **وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة**.

Test runs must be authenticated, admin-owned, repeatable/resettable, and isolated in storage and local queue namespaces. They must create no real participant/attempt/result, appear in no real leaderboard/analytics, affect no prizes/winners/publication, and send no reminders. A test reset must invalidate/isolate queued events from its old session. Verify another admin/editor/participant cannot access or mutate an admin's test session. Use this system for production validation without inserting real attempts.

## Prize saving regression to resolve on the correct database

The admin **الجوائز والتصميم → حفظ الجوائز والتصميم** must persist values and layout, return the committed values/version, show accurate success/failure, support successive saves, survive a fresh admin read, and update the public homepage. Reject stale concurrent saves and audit the actual staff actor.

When storage is unavailable, label defaults as unsaved and disable dependent edits; do not claim success or render fictional saved prizes. After connecting NBC, verify the complete real authenticated save → fresh read → independent public render, including relevant cache invalidation. Restore verified original prize settings after any test edits. The earlier code hotfix already handles the committed response/version; preserve it while reconciling upstream.

## Security and content gates

Preserve participant OTP and production fake-provider guards, real staff sign-in/MFA/allowlists, cookie security, request-origin/CSRF protections, rate limits, audit/identity protection, and mandatory PostgreSQL in production. Never enable remote demo login, default OTPs, unauthenticated admin actions, public answer-key endpoints, or PGlite fallback to pass tests.

Review existing Unifonic integration and OTP readiness/test/activation workflow. Finish backend/provider configuration that can be done securely; request only truly missing credentials or human provider steps. Do not claim real SMS activation from mocks. Do not replace it with a fake success. Any remaining external provider dependency must be explicit while unrelated backend work continues.

The official PDF is `public/documents/national-belonging.pdf` (66 digital pages, recorded SHA-256 `ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd`). Arabic extraction was unreliable. Do not invent 60 factual questions or turn local synthetic fixtures into production content. Build/verify the production import/approval/freeze system; author questions only from reliably reviewed exact pages. If review cannot be completed, update `QUESTION_BANK_PENDING_REVIEW.md` with exact remaining content work and keep launch blocked by content gates. Separate a finished backend from an unapproved question bank and any accessible transcript requirement.

## Validation and completion criteria

Run meaningful tests against disposable databases plus a controlled verification of the dedicated Supabase deployment. Cover lifecycle boundaries/resume/submitted restart denial; all three server-derived 20-question banks; immutable snapshots/order; selection/first-check/concurrent locks; formal non-disclosure and educational post-lock feedback; pages/hints; offline queues, duplicate events, lost responses/conflicts; scoring/percentage/number uniqueness; stage ranks/ties/privacy/visibility; recovery/corrections; repeatable/resettable isolated admin tests; role/ownership authorization; prize persistence/version conflicts; RLS/grants; OTP/security and staff-access regressions; fresh/legacy/repeat/concurrent migrations.

Inspect and run the repository's actual commands, including `npm test`, `npm run test:integration`, `npm run test:postgres`, `npm run test:admin-access`, `npm run typecheck`, `npm run format:check`, `npm run build`, and `git diff --check`. Repair failures without weakening safeguards. Confirm test counts and distinguish skipped/mocked/local checks from real Supabase/live evidence. Do not seed synthetic participants/questions into production to execute tests.

Validate RTL/mobile/keyboard/error/loading states and the entire admin save/test-run flow on the real Vercel site after deployment. Check that production is demonstrably connected only to `eerfhnaduachqluowsdo`, not merely that the homepage loads. Verify migrations/expected tables and restricted privileges on NBC, actual committed settings, and stable data after redeployment. Restore any test-only configuration. Keep launch/publication gated until authorized content/security checks pass.

Deliver implemented code, forward migrations, import/seed tooling, updated automated tests, README/operator/runbook updates, and a concise `NBC_BACKEND_IMPLEMENTATION_REPORT.md`: architecture/entities, Supabase project and connection model without secrets, lifecycle, admin test isolation, offline design, question versioning/book integrity, leaderboard/prize behavior, authorization/RLS, backup/rollback, exact commands/results, live evidence, and clearly separated external/content blockers. Reconcile and publish only reviewed implementation changes; preserve unrelated local work. Do not describe backend work as complete while known core feature or migration/production integration failures remain.

Start by inspecting the actual repository and dedicated NBC project, then implement and verify the missing backend work.
