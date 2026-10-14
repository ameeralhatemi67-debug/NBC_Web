# Competition operation

For the deployed NBC database, source-derived migration ordering, runtime/operator privileges, diagnostics and backup/rollback, use [NBC_BACKEND_OPERATIONS.md](NBC_BACKEND_OPERATIONS.md). The official bank remains empty pending human review. Administrator tests use explicitly labeled synthetic session snapshots when a stage has no complete bank; they never populate official content. Reset invalidates the previous session as well as creating a new queue namespace.

## Before opening

Keep the existing production OTP/staff identity configuration, PostgreSQL/TLS requirement, and deployment safeguards. Run `npm run db:migrate` with the production environment before starting the release, then `npm run build`. The build verifies the bundled official PDF and prepares its checksum-named URL and a self-hosted PDF.js worker. `npm run dev` prepares those assets too.

Open the application once after migration to initialize the current competition/book records. Production has no seeded questions. A migrated old competition is archived separately; its attempts, scores, answers, and question history remain preserved.

Admin > إدارة المسابقة controls the current campaign. Correct answers and explanations appear only after the server locks each answer, including campaigns saved with the legacy formal setting. Answers cannot be changed after locking. The default result policy is personal score after completion, full leaderboard after close and explicit publication, and a 60-minute synchronization grace period. Dates in the form use Riyadh time. Decide these policies before opening.

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

The server derives stage from the verified registration. It snapshots the frozen 20-question bank and shuffles question order and option order once. Reload/resume preserves that exact order and version. SELECT may change; the first successful CHECK permanently locks the scored answer. Correctness, answer keys and explanations are returned only for locked questions, including legacy formal campaigns. A final submission requires all 20 locked answers; the server computes score and percentage.

Each participant receives a stable competition-specific human-readable number, separate from database identifiers. Completed participants cannot restart the same campaign. Leaderboards show participant numbers, separate stages, and equal ranks for equal percentages. Submission time never breaks ties. Hidden/own-only leaderboards reject requests on the server. Own scores are hidden only under the fully hidden policy.

The PDF reader scrolls continuously through the full book, with page tracking, page navigation and zoom in its header. Nearby pages render on demand to limit canvas memory. A hint becomes available after visiting a digital page beyond the question's source page. Clicking it restricts the reader to the source page and its preceding page, with a button to return to the full book. The first-page boundary shows just page 1. Changing questions clears the restriction. No exact answer sentence is highlighted.

## Administrator test runs

Admin > تجربة الإدارة selects a stage. دخول الاختبار opens the same full-screen exam used by participants. The admin banner states: **وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة** and has خروج من الاختبار. Returning to the settings preserves the run and reading progress; متابعة التجربة الحالية resumes it. Both modes use the same Participation component, PDF reader, IndexedDB queue, answer-lock reducer, scoring, receipt, and leaderboard renderer.

Test runs use `admin_test_runs`/`admin_test_events`, authenticated administrator ownership, separate local queue keys, and a frozen private question snapshot. They never insert participants, real attempts, answers, leaderboard entries, analytics, winner/prize changes, or reminders. They do not change result publication. Tests can use the frozen bank or the validated draft bank before freeze, enabling review without opening the real competition.

Reset/new run creates a new session ID so old queued events cannot affect its replacement. Completed tests remain isolated for that administrator's test leaderboard. Administrators can simulate closed state and offline synchronization without changing the real campaign. Tests show feedback after server confirmation, just like real attempts. Editors cannot access this area.

## Dashboard simulation and participant practice

Admin > محاكاة المسابقة has two independent actions. بدء المحاكاة plays five minutes of illustrative competition activity through overview, analytics, reports and read-only results. Play/pause, seeking, phase markers and replay affect generated data only. Playback survives refresh in that browser and holds its final snapshot at 05:00. The data selector distinguishes البيانات الفعلية, بيانات المحاكاة and نتائج التجربة. Generated/practice views cannot export official CSV, publish results, credit questions or choose winners. Other management pages retain explicit real-data context.

فتح نافذة التجربة admits normally registered participants on the website for five server-clock minutes. Existing entrants get 15 minutes after admission closes to finish. Early closure starts those 15 minutes at the early close. Pause/seek/replay never changes these deadlines. End closes admission if still open and restores fresh official data, without erasing answers or cancelling completion time. Closure failure remains visible as an error.

The campaign must be DRAFT, with complete current-book stage banks and validated book/questions. Valid draft questions may be used without approval/freeze under an explicit practice notice; production fixture substitution is refused. The window captures immutable configuration and bank snapshots, then shuffles each entrant's form once. Stage/counts follow registration and the campaign, including 20/25/30. Normal registration and authentication apply. New normal registrations remain ordinary accounts; practice does not consume an official attempt.

`simulation_runs`, `simulation_attempts` and `simulation_events` keep practice separate. The shared engine enforces ownership, server-time source reading, answer handling, deduplication and aggregate-only results. Practice has no public leaderboard or prize eligibility. Admin practice reports refresh every five seconds. Official launch/scheduling or campaign switching is refused until completion time expires. Retained results stay readable to their owner. Expired queued writes stay local and return `PRACTICE_EXPIRED`; later windows get new run/attempt/queue IDs. Erasing an account that has practice history anonymizes it and revokes its sessions, rather than deleting referenced evidence.

Apply `014_simulation` and the private-schema grants/RLS before release. Local verification: after building, set `PLAYWRIGHT_MODULE` to an installed Playwright module and run `node tests/simulation-ui.cjs`. It starts a disposable loopback app with operator environment files blocked, uses installed Edge by default, and saves screenshots/results to `test-results/simulation`. `PLAYWRIGHT_CHANNEL` can select another installed Chromium browser.

## Connection loss and technical recovery

Every action is committed to IndexedDB before the UI acknowledges it. The queue retains unique event IDs and synchronizes in order when online, every 15 seconds, or on manual retry. Server writes are transactional and idempotent per attempt/event. An accepted write whose response was lost can be retried without duplicate scoring or revision changes. Revision conflicts reload server state; an existing server lock wins and rejected local events remain in the local conflict record. Other failures retain the queue.

UI states distinguish server saved, local saved, syncing, and failure. Locally checked answers stay provisionally locked, with feedback withheld until the server confirms. Navigation and reading progress survive reload. Stored participant profile data is limited to first name and stage; it excludes identity, phone, location, and institution. Use a private browser profile on shared devices.

The opened page continues answering during a temporary outage. The PDF is cached after its initial verified download where CacheStorage is available. The application shell is not a service worker/PWA: a completely offline cold visit/reload is not guaranteed to load the application. A lost device, cleared browser storage, or denied IndexedDB cannot be recovered from the client queue. Once app access returns, durable queued events resume; current login must still be valid for server synchronization.

A closing grace period accepts writes only for existing attempts. The server receipt time governs deadlines; it does not trust client timestamps. Expired-window events are retained locally for committee review. Admin > المشاركون provides an exceptional technical extension for an unsubmitted attempt, requiring a documented reason and duration. It preserves all answers, locks, versions, and previous data, and writes before/after state into `attempt_recoveries` and audit. This is an extension, not a second attempt/reset. Submitted results cannot be casually reset. Publication waits until grace and technical extensions expire.

If the committee invalidates a question, the admin Results area can grant that question's point to all affected attempts in the current campaign. It requires a reason, refuses published campaigns, recomputes completed scores, applies credit to future submissions, preserves original answers/snapshots, and records before/after scores in audit. The implemented fairness policy is equal full credit, with denominator 20.

Close and explicitly publish when review is complete. Public live mode is an intentional admin choice. Publishing does not send reminders. The existing reminder endpoint remains a local simulation and selects only real current-campaign participants.

## Book replacements

The current approved version is SHA-256 pinned. Replacing `national-belonging.pdf` causes asset preparation to fail until a new version is deliberately registered. Do not overwrite a checksum-named PDF. A future book requires a new immutable file/version record, reviewed pagination/question mappings, and a new campaign referencing that version. Existing campaigns must retain their original file. This release does not add a general-purpose PDF upload/publisher interface.

## Registration regions and cities

Admin > إدارة المسابقة > أهلية التسجيل controls who may register. The default is الشرقية with Dammam, Khobar, Dhahran, Jubail, Qatif and Hofuf. The committee can tick any of the 13 regions and edit each region's city list, one city per line: add a line to add an option, delete a line to remove it. Every selected region needs at least one city. The setting belongs to the competition, is saved with the other settings (blocked while results are published) and is inherited by a campaign created afterwards. The registration form reads it from `GET /api/registration-options`; with a single region it shows no region field, with several it shows a region field and then that region's cities. The server validates region and city again on every registration. Existing participants keep their stored region and city, and login does not check eligibility.

## Winners and the winners announcement

Admin > الفائزون والجوائز is available once the competition is closed and the synchronization grace and any technical extension have ended (the same rule as publishing results). For each stage the committee picks the participants for places 1–6 from the highest scores; amounts come from الجوائز والتصميم. Scores never decide a tie automatically and submission time is never used.

- Placing participants in score order needs no explanation.
- Any tie decision, a tied participant left just outside the places, a place order that differs from the scores, or skipping a higher score requires a written reason (15–1000 characters). The reason is stored with the decision and in the audit log.
- The media prize (التفاعل والتميز الإعلامي) is a free-text recipient, independent of exam scores.
- Publishing freezes a snapshot (places, amounts, scores, and participant numbers). Names and schools are included only if the committee ticks "إظهار الأسماء"; the default shows participant numbers only. Several winners may be minors, so confirm guardian consent before showing names.
- A published announcement appears on the home page and at `/winners`. While it is published, decisions and question credits are locked. Withdraw the announcement to change them; publish again to take a new snapshot. Every save, publication and withdrawal is audited.
- Each stage with completed attempts needs at least one winner before publishing.

Migration `008_winners` adds `competition_awards` and `competition_winner_publications`. After running `npm run db:migrate` on the NBC database, re-apply the runtime grants and row-level-security policy to the new tables, as described in NBC_BACKEND_OPERATIONS.md, before deploying the code.

## Participant records

Admin > المشاركون > إدارة سجلات المشاركين finds participants by name, school, city, **full phone number** or **identity number** (the identity is stored as a keyed hash, so it can be searched but never displayed). Editing a record needs a written reason (15+ characters) and is audited by field name only, never by personal value.

- **Changed phone:** enter the new number. The participant's sessions and pending codes end, and they sign in with the new number. This is the fix for a participant locked out after changing number.
- **Mistyped identity:** enter the corrected number. It is refused if another participant already holds it.
- **Stage:** can change only while the participant has no attempt in the current competition.
- **Duplicates:** merging accounts is deliberately not offered, because attempts are immutable and tied to their participant. Delete the empty duplicate instead.
- **Data-subject erasure** (hold the red button): a participant who never took part is deleted. One who did is anonymised: name, phone, identity, school and gender are removed, and the score stays under its anonymous participant number as part of the competition record. Refused while the participant's name appears in a published winners announcement.

The registration rules in إدارة المسابقة > التسجيل: *pause registration*, and *maximum registrations per phone number* (default 3, so siblings can use a parent's phone). Registration also closes automatically when the competition closes; existing participants can still sign in. A sent code is re-checked when verified, so a limit or closing that happens in between is respected.

## Campaign history

Admin > سجل المسابقات lists every campaign with counts. Selecting one shows per-stage totals and averages, the ranked results (paged, with names), the committee's winners and a CSV export for that campaign. Creating a new campaign never hides earlier results.

## Book versions

Admin > كتاب المسابقة uploads a new PDF (up to 40 MB). The browser hashes it and sends it in 3 MB parts; the server re-checks the hash, the `%PDF-` header and the page count, stores the file in the database and registers an **unapproved** version. It can be attached to the current campaign only while it is a draft whose question bank is not frozen; then approve the book as before. Questions belong to a book version, so a new book starts with an empty bank and earlier banks are kept. Readers download the stored file in the same parts and verify the SHA-256 before showing it. Not yet per-book: the cover artwork on the home and registration pages and the reader's table of contents (the bundled book's are built in).

## Editable site content

Admin > محتوى الموقع edits the home page introduction and about text, the book topics, the FAQ and the participation rules. Plain text only; the built-in wording is the default and is restored from the same screen. Saving needs the latest version (a newer edit elsewhere is refused).

## Public competition status

The home page shows whether the competition is not yet open, open (with the closing time and a countdown phrase), closed, or results published, and whether registration is open. When registration is closed the main button becomes a sign-in link. The leaderboard is paged (50 per page), shows the participant's own rank, and shows a retry button on a real error instead of claiming the results are unpublished.

Migrations `009_participant_admin` and `010_book_storage` support these features. On the NBC database they were applied together with `008_winners`, including row-level security and runtime-only grants.
