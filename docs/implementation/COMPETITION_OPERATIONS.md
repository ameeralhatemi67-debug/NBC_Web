# Competition operation

For the deployed NBC database, source-derived migration ordering, runtime/operator privileges, diagnostics and backup/rollback, use [NBC_BACKEND_OPERATIONS.md](NBC_BACKEND_OPERATIONS.md). The official bank remains empty pending human review. Administrator tests use explicitly labeled synthetic session snapshots when a stage has no complete bank; they never populate official content. Reset invalidates the previous session as well as creating a new queue namespace.

## Before opening

Keep the existing production OTP/staff identity configuration, PostgreSQL/TLS requirement, and deployment safeguards. Run `npm run db:migrate` with the production environment before starting the release, then `npm run build`. The build verifies the bundled official PDF and prepares its checksum-named URL and a self-hosted PDF.js worker. `npm run dev` prepares those assets too.

Open the application once after migration to initialize the current competition/book records. Production has no seeded questions. A migrated old competition is archived separately; its attempts, scores, answers, and question history remain preserved.

Admin > إدارة المسابقة controls the current campaign. The default policy is formal feedback, personal score after completion, full leaderboard after close and explicit publication, and a 60-minute synchronization grace period. Dates in the form use Riyadh time. Decide these policies before opening.

Review the official content as described in `QUESTION_BANK_PENDING_REVIEW.md`. Approve the book's exact hash, approve the 60 versions, then freeze. Freeze requires exactly 20 active approved questions per stage, valid options/keys/page bounds/hints, source evidence, and the approved immutable book. It rejects synthetic fixtures in production. A freeze made before opening may be replaced deliberately; an opened competition's frozen bank cannot be replaced.

Set opening/closing times and schedule, or choose open now. The server evaluates scheduled boundaries on every API request; no background scheduler or frontend button is required for enforcement. A closed competition cannot be reopened by changing its deadline. Create a new campaign for a new yearly competition. Participant uniqueness is `(participant_id, competition_id)`.

## Importing drafts

Admin > بنك الأسئلة supports JSON import/export, individual editing, page preview, version history, approval, and deactivation. JSON import saves records sequentially; an error stops the import and earlier valid drafts remain saved. Review the notice and correct the rejected record before continuing.

The CLI validates the whole file first and applies it in one transaction. Maximum 60 distinct records per file. Correct answer indices are zero-based; types are `single_choice` and `multi_select`; stage keys are `middle`, `highschool`, `university`; difficulty is `easy`, `medium`, `hard`. The service assigns the current book ID, versions, and draft approval status. Import never bypasses committee approval.

```powershell
# Use the intended database and security environment; this validates without writing.
npm run questions:import -- path/to/reviewed-bank.json
# Privileged database operator only; use the accountable committee/operator subject.
npm run questions:import -- path/to/reviewed-bank.json --apply --actor committee-subject
```

For a local environment file on Node 22:

```powershell
node --env-file=.env.local --import tsx scripts/import-questions.mjs path/to/reviewed-bank.json
```

`docs/question-bank/import-template.json` is deliberately a marked synthetic example. CLI production import refuses it. Production database credentials are privileged authorization for the CLI; `--actor` supplies audit attribution, not authentication. Ordinary editors should use the authenticated admin UI.

## Participant behavior

The server derives stage from the verified registration. It snapshots the frozen 20-question bank and shuffles question order and option order once. Reload/resume preserves that exact order and version. SELECT may change; the first successful CHECK permanently locks the scored answer. Formal mode returns no correctness, answer key, explanation, or source excerpt. Educational mode returns feedback only for locked questions. A final submission requires all 20 locked answers; the server computes score and percentage.

Each participant receives a stable competition-specific human-readable number, separate from database identifiers. Completed participants cannot restart the same campaign. Leaderboards show participant numbers, separate stages, and equal ranks for equal percentages. Submission time never breaks ties. Hidden/own-only leaderboards reject requests on the server. Own scores are hidden only under the fully hidden policy.

The PDF reader supports direct source-page navigation, page tracking, zoom, and mobile full-screen reading. A hint becomes available only after visiting a digital page beyond the question's source page; it jumps to the configured one/two-page range. This is a reading aid, not a security boundary: participants may freely browse the full book. No exact answer sentence is highlighted.

## Administrator test runs

Admin > تجربة الإدارة selects a stage and launches the same Participation component, PDF reader, IndexedDB queue, answer-lock reducer, scoring, receipt, and leaderboard renderer used by participants. The banner states: **وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة**.

Test runs use `admin_test_runs`/`admin_test_events`, authenticated administrator ownership, separate local queue keys, and a frozen private question snapshot. They never insert participants, real attempts, answers, leaderboard entries, analytics, winner/prize changes, or reminders. They do not change result publication. Tests can use the frozen bank or the validated draft bank before freeze, enabling review without opening the real competition.

Reset/new run creates a new session ID so old queued events cannot affect its replacement. Completed tests remain isolated for that administrator's test leaderboard. Administrators can simulate educational feedback, closed state, and offline synchronization without changing the real campaign. Editors cannot access this area.

## Connection loss and technical recovery

Every action is committed to IndexedDB before the UI acknowledges it. The queue retains unique event IDs and synchronizes in order when online, every 15 seconds, or on manual retry. Server writes are transactional and idempotent per attempt/event. An accepted write whose response was lost can be retried without duplicate scoring or revision changes. Revision conflicts reload server state; an existing server lock wins and rejected local events remain in the local conflict record. Other failures retain the queue.

UI states distinguish server saved, local saved, syncing, and failure. Locally checked answers stay provisionally locked, with feedback withheld until the server confirms. Navigation and reading progress survive reload. Stored participant profile data is limited to first name and stage; it excludes identity, phone, location, and institution. Use a private browser profile on shared devices.

The opened page continues answering during a temporary outage. The PDF is cached after its initial verified download where CacheStorage is available. The application shell is not a service worker/PWA: a completely offline cold visit/reload is not guaranteed to load the application. A lost device, cleared browser storage, or denied IndexedDB cannot be recovered from the client queue. Once app access returns, durable queued events resume; current login must still be valid for server synchronization.

A closing grace period accepts writes only for existing attempts. The server receipt time governs deadlines; it does not trust client timestamps. Expired-window events are retained locally for committee review. Admin > المشاركون provides an exceptional technical extension for an unsubmitted attempt, requiring a documented reason and duration. It preserves all answers, locks, versions, and previous data, and writes before/after state into `attempt_recoveries` and audit. This is an extension, not a second attempt/reset. Submitted results cannot be casually reset. Publication waits until grace and technical extensions expire.

If the committee invalidates a question, the admin Results area can grant that question's point to all affected attempts in the current campaign. It requires a reason, refuses published campaigns, recomputes completed scores, applies credit to future submissions, preserves original answers/snapshots, and records before/after scores in audit. The implemented fairness policy is equal full credit, with denominator 20.

Close and explicitly publish when review is complete. Public live mode is an intentional admin choice. Publishing does not send reminders. The existing reminder endpoint remains a local simulation and selects only real current-campaign participants.

## Book replacements

The current approved version is SHA-256 pinned. Replacing `national-belonging.pdf` causes asset preparation to fail until a new version is deliberately registered. Do not overwrite a checksum-named PDF. A future book requires a new immutable file/version record, reviewed pagination/question mappings, and a new campaign referencing that version. Existing campaigns must retain their original file. This release does not add a general-purpose PDF upload/publisher interface.
