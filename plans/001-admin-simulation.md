# Plan 001: Add a five-minute admin simulation and public practice window

Status: DONE; production migration and deployment verified. Priority: P2. Effort: L. Implementation risk: medium.
Planned against commit `11990be` on 2026-10-14, including the working-tree state inspected that day.
Category: product direction. Dependencies: none.

## Purpose and agreed scope

Add a control at the top of the admin page that plays five minutes of simulated competition activity through the existing dashboard. It must support play, pause, seeking to any time, replay, and end. Separately, allow an administrator to open a five-minute practice admission window on the actual website. The user explicitly selected open entry for registered participants, without an invitation link requirement. These actions can run together.

The user authorized implementation and production release on 2026-10-14, including five-minute admission and 15 minutes to finish after entry closes, with a backup before permanent changes. The feature is implemented and deployed. The original baseline evidence below describes the code before implementation.

Use two clocks. A reversible playback clock controls generated dashboard data. An irreversible server clock controls public admission and practice writes. Moving the track must never undo a person's answers, alter a deadline, or change the official competition state.

## Current state and evidence

- `src/components/admin.tsx:118`: `load()` fetches `api<AdminData>('admin')`, stores the response and marks it ready. The effect at line 123 loads after session resolution. There is no ongoing dashboard polling in this component.
- `src/components/admin.tsx:439`: the page heading is a suitable location for the simulation toolbar. The quick competition control immediately before it operates on the real campaign and must stay visually distinct.
- `src/components/admin.tsx:486`: analytics receives `data.participants`. Overview and report tables also derive their values from that data. Participant management is a separate component with its own real-data endpoints.
- `src/components/admin-analytics.tsx:36`: `AdminAnalytics({ people })` already accepts a participant dataset and derives summaries, filters, maps, distributions and comparisons. Its CSV link at line 70 always requests the real `/api/export`; merely changing `people` would make the export disagree with the screen.
- `src/lib/service.ts:16`: `ParticipantReport` includes stage, institution, locality, registration/start/submission times, score, maximum score and reading flags. Use this shape for generated dashboard rows.
- `src/lib/service.ts:78`: `adminState()` reads real participants and current-campaign attempts. Reading observations explicitly exclude administrator tests. No simulation population should be inserted into these tables.
- `src/lib/competition-service.ts:361`: participant `start()` requires a participant session, locks participant/campaign rows, checks the official window and frozen bank, and inserts into real `attempts` and `attempt_questions`.
- `src/lib/competition-service.ts:680`: `startTest()` requires an administrator, selects the current book's frozen bank or active drafts, requires the stage's configured count, verifies the book and validates questions. It rejects fixture questions outside local mode. It writes isolated `admin_test_runs`.
- `src/lib/competition-service.ts:655`: `testState()` is administrator-owned. Broadening its allowed roles would expose the wrong ownership model.
- `src/lib/competition-service.ts:416`: `write()` shares the answer reducer, ownership checks, event deduplication, revision validation and server-time reading gates between official and admin-test paths. `recordReading()` follows the same two-mode distinction.
- `src/lib/competition-service.ts:291`: `project()` returns safe questions during an attempt, no per-question feedback, and only aggregate results after submission. Preserve this policy for practice.
- `src/components/participation.tsx:113`: state, writes and reading endpoints are selected using `testRunId`. `start()` at line 418 always calls `attempt/start`. Local keys at line 199 distinguish only `test` and `participant`; the fallback pointer uses `participant-active`.
- `src/components/participation.tsx:555`: the test banner describes an administrator test. Participant practice needs its own wording.
- `src/components/competition-result.tsx:15` and `src/components/leaderboard.tsx`: result navigation must also distinguish practice from official and administrator tests.
- `src/app/api/[...path]/route.ts:40`: the router already resolves sessions, enforces request security, validates mutation bodies, uses `AppError`, and returns `Cache-Control: no-store`. Preserve those conventions.
- `src/lib/migrations.ts`: ordered, checksum-verified migrations are the only DDL source. The current final migration is `013_hero_intro_copy`; append the next available migration rather than rewriting an applied migration.
- `tests/database-fixture.ts`: `disposableDatabase()` supports isolated PGlite and PostgreSQL tests. `tests/postgres.mjs` explicitly lists engine suites, so a new suite must be added there.

Short drift-check excerpts:

```ts
// src/components/admin.tsx:118
async function load() {
  const state = await api<AdminData>('admin');
  setData(state);
  setDataReady(true);
}

// src/lib/competition-service.ts:680
async startTest(s: Session, body: Record<string, unknown>, tx: Queryable = this.db) {
  requireRole(s, ['admin']);

// src/components/participation.tsx:113
const readPath = testRunId ? `admin/test-run?id=${encodeURIComponent(testRunId)}` : 'participant';
const writePath = testRunId ? 'admin/test-run/event' : 'attempt/event';
```

Some older operating notes describe synthetic fallback or answer feedback that the current production code rejects. Treat the inspected source and current secrecy/reading tests as authoritative for those behaviors. Production database state was not inspected for this plan.

## Product behavior

### Admin toolbar

Place the toolbar in the main admin heading area and keep it mounted across tab switches. Only administrators see controls. Before starting, show `بدء المحاكاة` and a separate `فتح نافذة التجربة`. Opening the test window is an explicit action; starting dashboard playback alone does not admit people to an exam.

During playback show:

- `المحاكاة` status, play/pause, elapsed time and `05:00`, a keyboard-accessible track, phase markers and `إنهاء المحاكاة`.
- A separate practice status with the actual closing time and remaining admission time. Pausing or seeking cannot change it.
- A data selector for `بيانات المحاكاة`, `نتائج التجربة`, and `البيانات الفعلية`. Never silently combine the populations.
- A clearly labeled button/link that opens the website practice entry in a new tab for checking the real participant journey. Entry still uses normal participant authentication.

Generated playback stays local to that admin browser and survives refresh through session storage. Store only scenario seed, local run ID, position, anchor time and play state. Reconstruct the dataset rather than storing a large generated population. Other administrators may run their own playback independently; all see the same server-backed practice-window status.

At 05:00 stop playback and hold the final snapshot for inspection. Replay restarts generated activity only. End clears the generated view, reloads real data, and requests early admission closure if the associated public window is still open. If closure fails, keep showing the active window and error; never imply it closed.

### Five-minute scenario

Use one fixed, deterministic scenario in the first release, for example 240 obviously synthetic participants distributed across the three configured stages and enabled cities. This number is a proposed visual fixture, not a forecast or capacity claim. No real identities or phone numbers are generated.

| Playback position | Dashboard activity                                                 |
| ----------------- | ------------------------------------------------------------------ |
| 00:00–00:30       | Initial arrivals and registrations                                 |
| 00:30–02:00       | Exam starts; more schools, cities and stages appear                |
| 02:00–03:30       | First submissions; score and duration distributions fill           |
| 03:30–04:30       | Larger participation wave, varied outcomes and unfinished attempts |
| 04:30–05:00       | Closing phase and final summary                                    |

The track is a compressed representation of a competition period. Generate internally consistent event timestamps in a fixed fictional competition period; do not claim that the illustrated real exam duration is five minutes. Display that period so registration-date filters are understandable. Changing the browser clock must not regenerate different history.

Compute the visible rows from `(scenario version, seed, position, reference date)`, using events up to the selected position. Going backward rebuilds an earlier snapshot. Playing forward again produces the same IDs, rows and scores, without duplicates. Derive every KPI and chart from the same rows, using the existing analytics helpers. Incomplete attempts have null final scores. Registered, started and submitted counts must be consistent.

The synthetic view covers overview, analytics and the existing read-only report/results view. It must not fabricate question approval, book readiness, awards or system health. Real management tabs continue to show real records with explicit context, or are disabled while a generated dataset is selected. Reminder previews, participant edits, recovery, question-credit and winner actions must not operate on generated rows. For the first release disable CSV export in generated/practice views with explanatory text; real-data export remains available in the real-data view.

### Public practice window

Use these recommended first-release rules:

- Any normally registered and authenticated participant may enter while admission is open. No test link is required. A visible homepage/participant entry explains that practice does not count as an official attempt or win a prize.
- Keep normal registration, identity and stage validation. Practice does not bypass OTP if enabled or activate/deactivate OTP. Existing registration policy remains in force. New registrations through the normal form remain real registrations; their practice attempts are separate.
- For the first release allow opening only while the official campaign is DRAFT. Dashboard playback can still run in other states. The service must recheck official state at practice start/write and refuse practice once the campaign leaves DRAFT; the launch flow should report any still-active practice window before opening the real campaign.
- Require complete, valid current-book question banks for every advertised stage. Prefer frozen sets where available; otherwise explicitly labeled draft snapshots are allowed under the same validation rules as administrator rehearsal. Do not auto-approve, freeze or replace the official bank. No production fixture questions.
- Snapshot the practice configuration, immutable book ID and all stage question sets when the window opens. Each participant gets a stable shuffled snapshot on first entry and resumes it on refresh. Later bank edits cannot change that run.
- Admission expires after five real minutes, even if every admin browser closes. Evaluate deadlines on requests; do not rely on a browser timer, cron or a long-lived server process.
- Existing entrants get a fixed completion deadline of 15 minutes after admission closes. Early manual closure sets that deadline to 15 minutes after the early close. The UI states this time. These are proposed defaults to review before implementation.
- At expiry no new attempts start. Existing owned attempts may save, read and submit until the completion deadline. After it, preserve queued answers locally and return a specific expired-practice error. Reads of retained results remain available to their owner. A new window gets a new run ID and cannot accept another window's events.
- One practice attempt per participant per window, with a database unique constraint. Duplicate starts resume the attempt. A later window permits a new practice attempt and does not reset an official attempt.
- Preserve server-time reading evidence, exact-page gates, hints, answer-mode rules, submission locking, idempotency and aggregate-only result disclosure.
- Practice results are shown privately to each participant and to administrators in `نتائج التجربة`. Do not publish a practice leaderboard in the first release.

## Implementation boundaries

In scope, adjust only where required:

- New `src/lib/simulation-domain.ts`, `simulation-fixtures.ts`, `simulation-service.ts`.
- New `src/components/admin-simulation.tsx` and `simulation-entry.tsx`.
- `src/components/admin.tsx`, `admin-analytics.tsx`, `admin-quick-competition.tsx`.
- `src/components/participation.tsx`, `competition-intro.tsx`, `competition-result.tsx`.
- `src/lib/competition-service.ts`, `competition-domain.ts`, `competition-offline.ts`, `migrations.ts`.
- `src/app/api/[...path]/route.ts`, `src/app/page.tsx`, `src/app/participate/page.tsx`.
- `src/app/globals.css`, `src/app/designs.css`, or the existing admin stylesheet, only for scoped toolbar styles.
- New `tests/simulation.test.ts`, `tests/simulation-ui.cjs`; existing `tests/integration.mjs`, `production-integration.mjs`, `postgres.mjs`, `private-storage.mjs`, `migrations.test.ts`, and narrow extensions of reading/secrecy/offline suites.
- `docs/implementation/COMPETITION_OPERATIONS.md`, `NBC_BACKEND_OPERATIONS.md`, and this plan's index.

Out of scope: deployment/provider configuration changes, opening the official campaign, sending messages or SMS, approving questions, changing eligibility, changing prizes/winners, replacing participant authentication, general admin redesign, a public test leaderboard, scenario editors, load testing or automatic test-data deletion.

Do not add dependencies. Use existing `api`, `AppError`, controls, analytics functions, PDF reader and durable session. Match `DESIGN.md`: RTL Arabic, existing identities/tokens, tabular LTR-isolated times, labeled states, readable contrast and reduced motion. Track keyboard behavior must be documented and tested; keep elapsed/total numerals LTR within the RTL page. Announce phase changes, not every playback tick.

## Storage and server contracts

Add three isolated tables through the next source migration:

1. `simulation_runs`: campaign reference, creator, opened/admission-close/completion timestamps, closed-at value, version, immutable config/book/stage-bank snapshots. Serialize opening via a transaction lock on the current campaign and allow at most one unfinished public run per campaign.
2. `simulation_attempts`: run and participant references, stable shuffled questions, answer state, revision, participant number, timestamps, score/percentage and stage. Enforce unique `(run_id, participant_id)` and immutable snapshots/submitted results.
3. `simulation_events`: attempt reference, event ID and payload, unique per attempt/event. Preserve append-only behavior and record accepted server time for reading events.

Prefer reusing the existing scored event and projection logic. Keep official and admin-test public method signatures compatible. Add narrow service-owned simulation wrappers plus an internal explicit context for resolving the three owned storage paths. Table selection must use fixed code constants and authenticated context, never request-provided table names or a client `simulation=true` flag. Do not build a general storage framework or copy a second scoring engine.

`SimulationService` owns public-window lifecycle, immutable bank selection, participant practice ownership and admin practice reports. It uses the same injected `now()` testing pattern as `CompetitionService`. Opening/closing and practice writes use transactions and coordinate on the run row, so an early close racing a start has a defined ordering. Versioned admin lifecycle changes reject stale edits with a conflict; early close is idempotent.

Suggested routes inside the existing router:

| Method and route                            | Access and purpose                                               |
| ------------------------------------------- | ---------------------------------------------------------------- |
| GET `/api/simulation/status`                | Public admission state, run ID and deadlines only                |
| GET `/api/admin/simulation`                 | Admin readiness, active run and practice report                  |
| POST `/api/admin/simulation`                | Admin `open` or `close`, expected version; validates readiness   |
| GET `/api/simulation/participant?runId=...` | Participant's own state only                                     |
| POST `/api/simulation/start`                | Participant session, run ID; stage comes from registration       |
| POST `/api/simulation/event`                | Owned practice attempt; same event validation as official writes |
| POST `/api/simulation/reading`              | Owned practice attempt; server-timed evidence                    |

Return no answer keys/source excerpts in public or participant responses. Apply existing request security, strict body keys, authorization, structured errors and no-store responses. Other admins can inspect and close a public window; mutations record the acting staff subject. Audit practice actions with an explicit simulation marker; exclude those observations from official reading analytics.

New tables need the backend's existing private-schema grants/RLS and append-only permissions. Update isolated private-storage tests and the operator runbook. Production migration/grants are a separate release action using authorized operator access; runtime handlers cannot run DDL. No production database operation is authorized by this planning request.

## Ordered implementation and verification

### 1. Establish the source baseline

Run `git diff --stat 11990be..HEAD -- src tests docs/implementation` and `git status --short`. Compare the excerpts above with the live code. There were existing uncommitted UI changes when planned; preserve them and record their scope. Read installed Next.js 16.3.8 guides before coding and use Context7 for library-specific questions.

Verify with `npm run typecheck` and `npm test`, expecting exit 0. If pre-existing failures occur, record them before attributing failures to this work. Do not install or format unrelated files.

### 2. Build deterministic dashboard playback

Add pure event generation/projection and playback transitions, plus focused tests. Anchor elapsed time to timestamps so a background tab resumes accurately; pause freezes position. Seeking recomputes without mutation. Clamp positions to 0–300 seconds and validate saved session data.

Wire the toolbar and data selection through `Admin`. Keep generated data separate from the saved `AdminData`; ending reloads fresh real data. Pass an explicit view/source to analytics and disable mismatched exports/actions. Keep playback state across tab switches and restore it on refresh.

Verify `node --import tsx --test tests/simulation.test.ts` for identical repeated seeks, boundaries, pause/replay, valid score/count/time relations and no persistence side effects. Verify typecheck.

### 3. Add isolated practice persistence and lifecycle

Append the migration and implement `SimulationService`. Reuse current-book bank validation and immutable snapshots. Implement five-minute admission and fixed completion deadlines, DRAFT-only gating, unique starts, transaction/version conflicts and server-enforced ownership. Add routes using existing session/request checks.

Test with injected clocks, exact close boundaries and concurrent starts/closes. Verify that expired browser-independent admission closes without a scheduler. Compare official table/config snapshots before and after an entire practice cycle, allowing only explicitly marked audit entries and normal registration changes if the test intentionally exercises registration.

Run `node --import tsx --test tests/simulation.test.ts tests/migrations.test.ts tests/reading-controls.test.ts tests/start-readiness.test.ts tests/result-secrecy.test.ts`, expecting all pass. Add the new suite to the PostgreSQL runner and private-schema checks.

### 4. Connect the real participant journey

Add practice discovery on the homepage and participation entry. Use `/participate?practice=<runId>` as a presentation choice, not authorization. Server status decides availability and authenticated APIs decide ownership. Preserve official participation as the default path.

Extend `Participation` with an explicit practice run context. Update every state/start/event/reading endpoint choice, reload fallback, result action and local pointer. Use keys such as `simulation:<runId>:<attemptId>` and a separate practice-active pointer. Never let a restored practice queue call official endpoints or replace `participant-active`. Keep administrator `testRunId` behavior unchanged.

Show `تجربة عامة — لا تُحتسب ضمن نتائج المسابقة` and any draft-content notice throughout intro, exam and result. Explain admission close versus completion deadline. Practice results show only aggregate scores and no official leaderboard link.

Run the focused reading, secrecy, offline and simulation suites plus `npm run typecheck`. Verify three distinct journeys: official participant, owned administrator test, and owned participant practice.

### 5. Show actual practice activity and verify the UI

Poll the admin practice report every five seconds while a public run is open or entrants may still finish. Stop when hidden/unmounted, resume on focus, avoid overlapping requests and discard stale run responses. Preserve existing data on failure and show stale/update status. Reuse the current analytics components for practice rows. Poll the official dashboard similarly when its real-data view is selected, using the existing admin endpoint; this enables the same live response outside simulation.

Use the existing browser-test style for `tests/simulation-ui.cjs`. Test desktop/mobile and the three visual identities: top placement, keyboard seeking, pause, replay, end, tab/refresh continuity, filters/map, no overflow and reduced motion. Use a separate participant browser context to start and submit actual practice; assert its stats appear without seeking the generated track. Check wrong-owner/wrong-role requests through the API, not only hidden buttons.

Verify the UI suite with `node tests/simulation-ui.cjs` against an isolated local test server, following the setup convention in `tests/admin-ux.cjs`. It must report passing assertions and save evidence. Do not authenticate a real participant or create live attempts for planning verification.

### 6. Release verification and handover

Run the repository gates below and update both operating guides with the clock, isolation, registration and completion rules. Record evidence and mark the plan DONE only after the feature is implemented and checks pass. Prepare a release note listing the additive migration and private-schema permissions. Deploy only in a separately authorized implementation/release task.

| Command                     | Expected result                                                |
| --------------------------- | -------------------------------------------------------------- |
| `npm run typecheck`         | Exit 0, no type errors                                         |
| `npm test`                  | Exit 0, including new simulation tests                         |
| `npm run build`             | Exit 0; official PDF preparation succeeds                      |
| `npm run test:integration`  | Exit 0, including practice HTTP and unchanged official flows   |
| `npm run test:postgres`     | Exit 0, including new engine, role and storage checks          |
| `npm run test:admin-access` | Exit 0; existing staff access preserved                        |
| `npm run format:check`      | Exit 0 or documented pre-existing failures outside this change |

There is no separate lint script in this repository. Do not invent one.

## Required acceptance tests

- Playback at 0, 1, 150, 299 and 300 seconds; arbitrary seek backward/forward, pause, background elapsed time, refresh and replay are deterministic.
- Generated rows never enter the database or alter official counts; all displayed simulated statistics use the same projected population.
- Dashboard-only playback works with an incomplete bank. Public practice opening reports incomplete-stage/book blockers rather than synthesizing questions.
- Open entry works for registered participants across all configured stages, including 20/25/30 counts; the server derives stage and validates the run.
- Complete and incomplete bank selection, current-book filtering, no production fixtures, immutable question/book snapshots and same shuffle after resume.
- Unauthenticated/editor open/close and wrong participant access are refused. A practice ID cannot read an admin run or official attempt, and vice versa.
- Concurrent starts yield exactly one attempt per participant/run. Concurrent opens yield one active window. Stale close versions conflict; repeated close is safe.
- Admission closes at five real minutes while generated playback is paused or its browser is closed. Seeking/replaying never extends it.
- A late entrant can finish during the recommended completion period; new starts fail after admission closure and writes fail after completion expiry.
- Early closure and official DRAFT exit are enforced on the server. Accepted duplicate events can be safely retried; changed payload reuse fails.
- Real-page reading gates and aggregate-only result secrecy match official behavior. Client timestamps and seek position cannot fabricate reading time.
- Practice queue restart/resume, response-loss retry, expiry conflicts and old/new run IDs never cross into official storage or pointers.
- Practice reports update automatically and retain last data with a stale label after failure. Generated seek has no effect on actual practice stats.
- Official campaign state, frozen sets, official attempts, answers, leaderboards, prizes, winners and reminder selections are unchanged by practice.
- New ordinary registrations remain normal accounts and are clearly distinguished from isolated practice attempts.

## Stop conditions and maintenance

Stop and report if implementation requires weakening participant reading/secrecy rules, admitting unregistered users, turning on fake production authentication, rewriting applied migrations, changing an official campaign to open, modifying out-of-scope provider settings, or losing existing working-tree changes. If bank or book readiness is absent, keep dashboard playback usable and public practice unavailable with explicit blockers.

Keep scenario version/seed stable across seeking and saved-session restore. Recheck practice context routing whenever adding an exam endpoint or local queue pointer. Keep bank counts, immutable book selection, role/grant checks and result policy aligned with later official exam changes. Retention of practice history needs a later explicit policy; this plan does not schedule destructive cleanup.

References read for this plan: installed `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`; Context7 Next.js authentication guidance at https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/authentication.mdx. Installed version-specific documentation takes precedence where it differs.

## Implementation record, 2026-10-14

Both requested paths are implemented. A deterministic 240-row dashboard scenario supports transport, keyboard seeking, phase markers, replay and browser-session restoration. Generated, practice and actual reports stay separate. Registered participants enter isolated practice using the existing exam component and reducer, reading gates and aggregate-only result policy. Server deadlines admit entrants for five minutes and permit completion for exactly 15 minutes after automatic or early admission closure. Early close uses one captured timestamp; an advancing-clock regression protects the duration.

Added migration `014_simulation` with three separate tables and immutable snapshot/submission/event/deadline guards. Opening/starting/closing uses transactions and owned sessions. Public status omits banks/answers; current official launch/campaign switching refuses unfinished practice. Practice snapshots keep their captured stage after profile edits. Participant erasure preserves referenced practice evidence by anonymizing the account. The private-schema exporters and checks include append-only simulation events.

Necessary scope extensions: `src/app/layout.tsx` imports the scoped stylesheet; `src/lib/participant-admin.ts` handles practice-backed erasure; both existing schema-export scripts preserve simulation event permissions; `tests/admin-access.mjs` had one stale homepage-text assertion updated to the existing default-prize fallback. No unrelated UI changes were overwritten and no dependency was added.

Verification: full 148-test unit suite; six final focused simulation tests including the advancing clock; typecheck; production webpack build; 50 existing HTTP integration checks; 10 staff-access checks; PostgreSQL verification covering 22 auth tests, 36 competition/migration tests, nine private-storage checks and 32 production HTTP checks. Browser verification passed desktop/mobile in all three identities, transport/refresh/filter/report behavior, real registered practice entry/resume/submission, automatic practice reporting, exact early-close grace and separate IndexedDB pointers, without page errors. Evidence: `test-results/simulation/verification.json` and adjacent screenshots.

All changed source/test/script files pass scoped formatting and `git diff --check`. Repository-wide formatting still reports 57 pre-existing unrelated violations. Windows sandbox junction restrictions require the webpack build flag and loopback permission for browser/database tests.

Production release completed on 2026-10-14. Before migration or Git push, a verified source archive, Git history bundle and Windows-user-encrypted full database snapshot were saved under `.data/simulation-release-2026-10-14/`; `backup-manifest.json` records checksums and verification. The database migration `nbc_014_simulation` and permissions scoped to the three new tables/two new functions were applied to the authorized NBC project. Existing critical table contents were unchanged; RLS, append-only event permissions and the security advisor passed.

Source commit `20581c0c6591596367af9f646a118a0955b25747` is deployed at `https://nbc-web-two.vercel.app`, deployment `dpl_3435XqbERZitB5C1fRsJ9hDDMQKe`. All 29 existing live checks and eight additional simulation-route checks passed. The new routes reject unauthorized writes, the public practice window is closed, and the official campaign remains DRAFT with four participants and zero official attempts. No runtime errors were returned by the bounded release log check. Authenticated exam and dashboard journeys were verified locally; the live browser showed the public homepage and staff sign-in gate.

The previous deployment `dpl_BcTFDq9wSNs3igQqb3dMYc42GCNq` remains available as a rollback reference. The public test window remains gated by DRAFT campaign state and valid current-book stage banks. Detailed release evidence is saved in `.data/simulation-release-2026-10-14/release-verification.json`.
