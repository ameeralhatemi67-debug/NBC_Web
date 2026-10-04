# NBC competition expansion — implementation report

Implemented locally on 2026-10-04 against [NBC_Competition_System_v1.md](NBC_Competition_System_v1.md), after reviewing the existing application, competition research, OTP/security, staff access, migrations, versioning, results, and tests. This change has not been deployed.

## Architecture and storage

The existing Next application, OTP/staff authentication, request protection, audit, PostgreSQL/PGlite adapters, administration, registration, prizes, and full `/book` access remain in place. The previous 10-question participation service is extended through a dedicated competition domain/service.

`competition-domain.ts` contains shared validation, public projections, locking, feedback, scoring, hint eligibility, and ranking. `competition-service.ts` supplies lifecycle enforcement and transactional adapters for real attempts and administrator test sessions. Both use the same reducer; `Participation`, `BookReader`, and `Leaderboard` are shared UI components.

Forward migration `003_book_competitions` adds `book_versions`, `competitions`, `competition_question_sets`, `question_versions`, `attempt_questions`, `attempt_answers`, `attempt_events`, `admin_test_runs`, `admin_test_events`, and `attempt_recoveries`. It extends attempts with competition, stage, participant number, percentage, and recovery deadline. Migration `004_question_corrections` adds audited committee credit decisions. Earlier migrations are unchanged.

Legacy attempts are preserved under an archived campaign. Lifetime participant uniqueness becomes `UNIQUE(participant_id, competition_id)`; participant numbers are independently unique within a campaign. Existing JSON snapshots remain for compatibility, while new question/answer child rows provide immutable ordered snapshots, locked answers, and durable event identity. Normalized answer rows are authoritative for new attempts. PostgreSQL row locks coordinate starts, writes, committee corrections, closing/publication, and question-bank changes.

## Lifecycle and participant flow

Campaigns begin DRAFT; freeze validates exactly 20 approved active questions per stage, source evidence, correct answers, option shape, hint bounds, duplicate text, and the approved book/hash. SCHEDULED opening/closing boundaries are evaluated on the server. Admin can open/close now and explicitly publish/unpublish. Closed competitions cannot reopen through deadline edits; a later yearly campaign permits one new attempt for the same participant. Publication waits for grace/technical deadlines.

The server derives stage from the verified participant record. It snapshots and shuffles question/option order once, remapping correct indices safely. SELECT remains editable; the first CHECK locks permanently. Final submission requires 20 locked answers and computes score/percentage on the server, with a stable human-readable participant number and receipt.

The repository's formal non-disclosure rule conflicts with educational answer feedback. Formal mode is the default and exposes no answer keys, correctness, explanation, or source excerpt. Educational mode is an audited admin setting and releases feedback only after lock. Personal score is available after completion under the default policy; fully hidden mode hides it too.

Leaderboards are separated by stage and use participant numbers. Equal percentages share ranks; time is never a tiebreaker. Hidden/own-only access is rejected by the server. Default full publication requires closure and explicit committee action; public live is opt-in. Test data never enters public leaderboards or winners/prize selection.

## Book and question administration

PDF.js renders the actual 66-page official PDF, with source jumps, page tracking, next/previous, zoom, checksum verification, and mobile full-screen reading. The original complete PDF remains available at `/book`. CacheStorage failure does not block online rendering. Generated immutable-book/worker assets are prepared by `predev`/`prebuild` and excluded from Git.

Questions store stage, single/multiple selection, options/keys, separate digital/printed pages, one/two-page hint range, explanation, topic, difficulty, source excerpt, book identity, version, approval, and active status. Editing creates an unapproved new version; prior attempts and opened frozen banks retain original versions. Editors draft; admins approve/freeze. Administration includes linked-page preview, version history, JSON import/export, stage filters, and a page coverage map.

The hint appears after the reader has visited a digital page beyond the source page and jumps to the configured range. Exact answer sentences are not highlighted. Reading progress is a UX condition rather than an anti-cheating boundary because the whole book is freely available.

## Isolated administrator test runs

Administrator-owned test sessions use separate tables and local queue namespaces. The same 20-question flow, renderer, reader, lock logic, server scoring, percentage/number receipt, sync statuses, and leaderboard renderer are used. Stage choice, reset/new run, educational feedback, closed-window simulation, and offline simulation are available. Reset creates a new ID to isolate old queued events. The required Arabic banner is visible throughout.

No real participant or attempt is created; real analytics, reminders, leaderboards, prizes, and publication state are untouched. Server authorization rejects participants, editors, and other administrators' session IDs. Automated tests complete 20 questions, repeat/reset runs, and check isolation/side effects.

## Offline and exceptional recovery

Native IndexedDB commits actions before UI acknowledgment. FIFO event IDs make retries idempotent even after a server commit with a lost response. Reconnect/manual/15-second retries refresh revisions. Server locks win conflicts; rejected events remain in the local conflict record, and other failures retain pending events. Cross-tab browser locks and server revision checks coordinate competing writes. UI distinguishes server saved, locally saved, syncing, and failure. Navigation is durable; cached profile data excludes identity, phone, location, and institution.

Grace applies only to existing attempts. Client timestamps cannot extend deadlines. Technical recovery is an admin-only documented deadline extension for unsubmitted attempts, preserving locks and history with before/after audit. It deliberately does not provide an unaudited reset or second submitted attempt. Invalid-question correction implements equal full credit, preserves original answers/snapshots, recomputes completed scores, and records reasons/before-after results. Published campaigns require unpublishing first.

## Validation performed

All final checks passed:

| Command | Result |
| --- | --- |
| `npm test` | 46 unit/domain/migration/security tests |
| `npm run test:integration` | 37 isolated HTTP/backup checks |
| `npm run test:postgres` | 17 PostgreSQL OTP tests and 17 production HTTP checks |
| `npm run test:admin-access` | 8 production staff/setup access checks |
| `npm run build` | Production compilation and static generation passed |
| `npm run typecheck` | Passed |
| `npm run format:check` | Passed |
| `git diff --check` | Passed |
| `node --import tsx .data/import-check.mjs` | Disposable CLI dry-run/import, fixture marker, draft state, and audit checked |

The disposable CLI harness invokes `node --import tsx scripts/import-questions.mjs docs/question-bank/import-template.json`, then repeats with `--apply --actor isolated-import-check`; only an isolated `.data/import-check-db` is changed. This harness/data are ignored test artifacts.

Browser verification used an isolated localhost test server on port 43416. Verified the actual cover and PDF page 29 (printed 27), source/hint navigation, answer locking, feedback after server confirmation, locally queued offline actions and reconnect, reload preserving the question/lock/PDF page, mobile full-screen reader and focus return, no horizontal overflow at 390px and 320px, and no browser error logs. This is a functional keyboard/mobile check, not an independent WCAG audit. Review the [desktop shared flow](competition-test-run-desktop.jpg) and [320px reader](competition-reader-mobile.jpg) screenshots; both use visibly marked local synthetic questions.

## Remaining launch dependencies and limits

- **The 60 factual questions are not authored/approved.** PDF extraction yielded unreliable encoded Arabic glyphs. Local fixtures are visibly synthetic and production cannot freeze them. See [QUESTION_BANK_PENDING_REVIEW.md](../../QUESTION_BANK_PENDING_REVIEW.md) for the exact content-review work and import example.
- The encoded PDF lacks a dependable accessible text edition. Canvas labels/controls are implemented; a reviewed transcript/text layer remains a content accessibility dependency.
- Durable queues protect temporary loss in an already opened application. No service worker caches the application shell, so a completely offline cold reload is not guaranteed. IndexedDB denial/clearing or device loss cannot preserve unsynchronized actions. Server synchronization still requires valid authentication and window/grace/recovery permission.
- Book replacement is intentionally immutable and requires registering a reviewed new version/file and campaign; a general PDF-upload workflow is not included.
- Similar concepts/ambiguous content need human review; automated duplicate validation checks normalized identical text. The committee must authorize educational disclosure, public-live ranking, invalid-question credit, and any broader future replacement-attempt policy.
- Production SMS/provider activation, staff identity configuration, managed database, and deployment remain existing operational prerequisites. No production credentials or deployment settings were changed by this implementation.

See [COMPETITION_OPERATIONS.md](COMPETITION_OPERATIONS.md) for the administrator launch and recovery workflow. Pre-existing local admin-access documentation and skill-observation changes were preserved.
