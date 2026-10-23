# Skill Observation Log

### Observation 1: Verify Arabic competition rules visually before synthesis

**Status:** OPEN
**Date:** 2026-09-07
**Session context:** Competition research from a short Arabic PDF
**Skill:** deep-research and pdf
**Type:** open-source
**Phase/Area:** Attachment ingestion

**Issue:** Text extraction reversed Arabic and interleaved bullets. The file described platform operation, while the initial request could mean either participant success or winning the build proposal.

**Suggested improvement:** At ingestion, visually verify all rule-bearing pages and distinguish the competition's participant rules from the supplier-selection rubric. Resolve that scope ambiguity early while continuing independent research.

**Principle:** Confirm both the meaning of the source and the decision the user wants it to support before making strategic recommendations.

2026-09-08 deliverable checkpoint: research-note batches completed; no additional reusable observations beyond Observation 1. Deferred for a later skill review.

### Observation 2: Separate font design permission from font delivery permission

**Status:** OPEN
**Date:** 2026-09-29
**Session context:** Website redesign with a user-supplied commercial font family
**Skill:** New skill candidate: licensed asset review
**Type:** open-source
**Phase/Area:** Design preview and asset delivery

**Issue:** A font licence allowed commercial design while separately restricting extractable font files in websites. Treating the commercial allowance as unrestricted webfont permission would miss the delivery restriction.

**Suggested improvement:** Read both permitted-use and distribution clauses before embedding. Keep font sources outside public assets and version control until the delivery method is resolved. When design use is permitted, locally rendered title samples can support visual review without distributing the font program.

**Principle:** Permission to create a design and permission to distribute its underlying asset are separate checks.

2026-10-01 deliverable checkpoint: supplied identity artwork inspected and standalone visual preview verified; no new reusable observations beyond Observations 1 and 2.

2026-10-04 deliverable checkpoint: prize persistence, cohort analytics, and desktop/mobile verification completed; no new reusable observations beyond the existing entries.

2026-10-04 final checkpoint: independent review marked analytics contrast and Saudi-local calendar-year corrections resolved; implementation documentation completed. No new reusable observations.

### Observation 3: Verify the operator login before deploying an authentication upgrade

**Status:** OPEN
**Date:** 2026-10-04
**Session context:** Repairing production access after a security upgrade
**Skill:** Authentication and deployment verification
**Type:** open-source
**Phase/Area:** Production handover

**Issue:** Disabling a demo login without connecting a usable production identity provider left the operator unable to enter the setup screen. Public informational content also failed because it depended on a database that was still awaiting configuration.

**Suggested improvement:** Verify the operator's complete sign-in route on the actual hosting domain, with the actual configured provider, before describing an upgrade as operational. Test the public site and authenticated readiness screen with missing application infrastructure. Keep privileged actions fail-closed while making setup status reachable through real authentication.

**Principle:** Authentication hardening and operational access must be validated together.

2026-10-04 competition deliverable checkpoint: shared real/test engine, durable queue, production regressions, and content-review handoff completed. No new reusable skill observations beyond the existing Arabic source-ingestion and authentication entries.

### Observation 4: Distinguish default configuration from persistent admin data

**Status:** OPEN
**Date:** 2026-10-04
**Session context:** Repairing an admin settings form with unavailable production storage
**Skill:** Deployment and full-flow verification
**Type:** open-source
**Phase/Area:** Admin persistence

**Issue:** A setup fallback rendered default settings in an editable admin form even though the production database was absent. Authentication succeeded, creating the impression that configuration could be saved.

**Suggested improvement:** When authoritative storage cannot load, label defaults as unsaved, disable dependent mutations, and offer a retry. Return committed values and their version from successful writes. Verify the save, a fresh admin read, and the public consumer on the actual deployment.

**Principle:** A working login does not establish that dependent application storage is operational.

2026-10-04 live prize deliverable checkpoint: isolated database privileges and verified TLS, authenticated repeated saves, fresh admin/public reads, regression tests, restored design, and screenshot evidence completed. Observation 4 captures the reusable storage-readiness lesson.

### Observation 5: Verify the intended project before provisioning storage

**Status:** OPEN
**Date:** 2026-10-04
**Session context:** Correcting a database integration placed in another application project
**Skill:** supabase:supabase
**Type:** open-source
**Phase/Area:** Project discovery and database provisioning
**Reference file:** docs/implementation/2026-10-04-supabase-disconnection.md

**Issue:** A connector listed unrelated existing projects while the requested application's dedicated project was absent. General permission to choose a fitting database was incorrectly interpreted as permission to place the application inside another project's database. Private-schema isolation did not establish the user's intended project boundary.

**Suggested improvement:** In project discovery, match the destination to the user's application and confirm ambiguous project ownership before provisioning. If the intended project is missing, resolve its access or ask for its project ref while continuing independent code work. Do not infer project authorization from connector visibility.

**Principle:** Access to a resource and authorization to use it for a new application are separate decisions.

2026-10-06 exam UX Phase 0 and Phase 1 checkpoint: baseline isolation, formatting fixes, and local browser verification completed. No new reusable skill observations; existing observations remain open.

### Observation 6: Preserve Word run provenance when importing Arabic content

**Status:** OPEN
**Date:** 2026-10-11
**Session context:** Importing three Arabic question banks and selectively using a color-annotated policy document
**Skill:** docx and pdf
**Type:** open-source
**Phase/Area:** Source ingestion and review

**Issue:** Plain text loses run colors, automatic option numbering and legacy-font religious symbols. A policy title may occur in both red commentary and usable dark text, so banning every red substring creates false positives. Printed book pages also differed from digital page indices, with cover and range references requiring explicit metadata.

**Suggested improvement:** Retain original row/run/font/color/numbering evidence and source hashes. Verify symbols, quotation repairs and page mappings visually against the actual PDF. Select applicable dark clauses by provenance; exclude red commentary while allowing independently authorized shared labels. Keep imported questions unapproved with an explicit source-review gate.

**Principle:** Content meaning and formatting provenance must remain reviewable after import.

2026-10-11 meeting-update checkpoint: 75 unapproved supplied questions, nine official-source items, shared partner layout, final-submission flow, isolated preview, policy selection and technical gap report completed. Local/PGlite, disposable PostgreSQL, HTTP, build/type and browser journey checks passed. Observation 6 records the ingestion lesson; skill changes remain deferred.

2026-10-12 logo-caption review checkpoint: removed visible captions from the shared logo component, retained roles and descriptive alternative text, and passed production build and formatting checks. Browser visual verification was blocked by the browser URL policy. No new reusable skill observations.

### Observation 7: Inspect side effects of authenticated deployment checks

**Status:** OPEN
**Date:** 2026-10-12
**Session context:** Verifying a protected preview after an authorized Git push
**Skill:** vercel:access-protected-vercel-deployment
**Type:** open-source
**Phase/Area:** CLI authentication and verification cleanup

**Issue:** An authenticated HTTP helper silently generated a persistent project bypass credential and linked the checkout. A advertised global flag was forwarded to curl as an unsupported option. A nominally read-only verification therefore mutated remote access configuration and local project metadata before returning an error.

**Suggested improvement:** Inspect installed command behavior and authentication side effects before protected checks. Prefer existing short-lived access. If a helper creates verification-only access, identify and revoke only that credential after verification, confirm prior credentials and protection remain intact, and remove only helper-created local metadata. Do not broaden access to repair a read failure.

**Principle:** Verification helpers require the same scope and cleanup discipline as explicit mutations.

2026-10-12 publish checkpoint: application commit pushed to the existing review branch, exact Vercel commit reached READY, HTTP 200 confirmed nine logos without visible name captions, and helper-created access and metadata were removed. Observation 7 records the verification side effect; skills remain unchanged.

### Observation 8: Measure spacing across shared grid groups

**Status:** OPEN
**Date:** 2026-10-12
**Session context:** Correcting partner logos after visual review
**Skill:** impeccable, reference/layout.md, grouping and adaptation assessment
**Type:** open-source
**Phase/Area:** Inherited CSS and spatial verification

**Issue:** A shared logo grid inherited centered grid-item alignment. A nested group consequently used its intrinsic width, creating an excessive gap despite valid child dimensions, no overflow and all images loading. Earlier verification established reading order but did not compare column centers and label baselines.

**Suggested improvement:** Inspect inherited parent alignment and measure group bounds, consecutive centers and repeated-label baselines. Check artwork centers inside consistently sized frames. Verify desktop and narrow layouts with both geometry and screenshots before declaring spacing correct.

**Principle:** Correct element order and valid assets do not establish correct spatial distribution.

2026-10-12 spacing checkpoint: shared layout corrected, desktop/tablet/mobile geometry and screenshots verified, production build and formatting passed, and the reviewed correction was committed and pushed. The matching Vercel preview reached READY; production remains the separate environment.

2026-10-12 cleanup checkpoint: working release tagged, full old-worktree archive/history bundle verified, shared dependency junction unlinked safely, worktree removed and main dependencies preserved. History consolidation and corrected tracking are prepared; application-tree comparison, build, push and deployment verification remain in progress.

2026-10-12 safe-stop checkpoint: owner requested pausing cleanup to close the laptop. Verified local backup/worktree removal, unchanged release application files, build and tracking checks are saved with the consolidation. Remote main/tag push, production verification and branch retirement are deferred to the resume handover. Existing production remains unchanged.

### Observation 9: Guard production migration effects with live evidence

**Status:** OPEN
**Date:** 2026-10-13
**Session context:** Repairing city loading blocked by unapplied production migrations
**Skill:** ponytail, Before you write
**Type:** open-source
**Phase/Area:** Existing migration runner and production approval review

**Issue:** A required migration bundle was initially rejected because it contained draft cleanup, saved-copy replacements and permission statements, despite the affected tables being empty and permissions already restricted. A connector error then made the application outcome uncertain.

**Suggested improvement:** Before submitting an existing production migration bundle, inspect the affected row counts and permissions, then add transaction-local assertions for any assumptions that make destructive-looking steps no-ops. After an ambiguous connector error, read migration history before retrying. For destructive operations, make and verify a recoverable copy first, as requested by the user.

**Principle:** Verify mutation effects from current state, enforce safety assumptions atomically, and verify outcome before retrying.

2026-10-13 registration repair: confirmed production commit 05db9b824410ecead243ffee41c458077dc3e4c7 required migrations 011–013 while NBC history stopped at 010. Applied the source-derived guarded bundle through Supabase; all 13 checksums now match. Live registration renders 12 Eastern Province cities and accepts الدمام with no migration warning. Migration and eligibility tests passed 10/10. No participants, attempts, question sets or saved site-content rows were deleted; current permissions were unchanged. No application-source edits or deployment were required. Reviewed bundle is retained locally at .data/registration-repair-reviewed.sql.

### Observation 10: Test recovered dependencies through every rendering branch

**Status:** OPEN
**Date:** 2026-10-13
**Session context:** Repairing a homepage crash exposed when database access resumed
**Skill:** vercel:verification, Walk the Data Flow
**Type:** open-source
**Phase/Area:** Dependency recovery and server/client boundaries

**Issue:** Registration verification after a database repair passed, but the recovered database enabled a homepage branch that called a utility exported from a use-client module on the server. The page returned an error boundary. Some streamed error responses had HTTP 200, so status-only checks would miss the failure.

**Suggested improvement:** After restoring a shared dependency, test each dependent page with real data available. Assert visible content and absence of the error boundary in addition to HTTP status. Include a production Next.js regression against an initialized disposable PostgreSQL database, and confirm the exact source commit serving the live domain.

**Principle:** Dependency recovery changes reachable code paths; successful requests do not prove successful rendering.

2026-10-13 homepage repair: verified Git bundle and source ZIP plus live settings/competition/migration backup before edits. Production logs proved server invocation of client statusSentence. Moved its pure implementation to a shared library; committed and pushed focused fix 3d42b9e4c9c34ba6db1412681c3b74cd84a566e8. Canonical domain serves READY deployment dpl_Hu42aZPXtC65c9DabvWjTZx8KgPv. All nine page URLs and 25 live HTTP checks passed. Live browser confirmed full homepage, selectable 12-city registration, PDF navigation, and participant/admin sign-in gates. Tests passed 126 unit, 48 integration, 27 production HTTP, 19 PostgreSQL OTP, 18 PostgreSQL competition/migration and 9 private-storage checks. New deployment had no runtime error records. Live settings/competitions/migrations match the backup. Authenticated flows were tested in isolation with mocked SMS, not through a live account. Backup manifest and verification report are retained in .data/homepage-repair-2026-10-13.

2026-10-13 reading-label checkpoint: backed up src/lib/site-content.ts, added المطلب الأول through المطلب السادس to its six reading topics, and deployed focused commit 0df7c2774d1b0f04cb92213a0cd8cca0f0d26a41. READY production deployment dpl_HBmEaWGSh2qb8sktRZETB9So9Seo serves the canonical domain. Browser verified all six complete labels on /book; production build and 12 content/meeting tests passed. No new skill observations from this copy edit.

2026-10-13 reversible OTP checkpoint: verified source ZIP, Git bundle, configuration copy and admin component copy before changes. Preserved OTP/provider/error code behind NBC_OTP_ENABLED; production setting false disconnects OTP and its readiness blocker from participant entry. Direct registration/login retain validation, phone limits, role isolation, secure expiring sessions, logout and rate limits; restoring OTP rejects direct sessions. Numeral-only Unicode font faces cover numbers/separators while original letter fonts remain. Browser inspection found two shorthand font declarations missing the override; these were corrected before deploy. Quick admin start/close controls use existing launch prerequisites and versioned actions; local browser proved start/close and retained all six disposable participants. Commit fd14f53a5c762714ec7b041c8c0eb93ee2a9cecd serves READY production deployment dpl_BqVm9s9J5hePF18BpaoMzjTxzkjL. Passed build/typecheck, 129 unit, 48 integration, 31 production HTTP and full PostgreSQL phases, plus 29 live checks across nine page URLs. Live browser confirmed city selection, direct entry and actual numeral fonts in three designs. No runtime errors recorded. Live competition remains DRAFT with registration open; no real participant created and no live campaign lifecycle changed. Backup manifest and verification report retained in .data/otp-numbers-2026-10-13.

2026-10-13 first-round UI checkpoint: preserved existing working changes; refined header, book and participant preparation screens, corrected organizer-right and strategic-partners-left layout, applied numeral-only font fallback and ordinary grouping commas, added book navigation feedback/loading, and fixed viewport sidebar scrolling. No new reusable skill observations. All 129 unit tests and production webpack build passed. Browser confirmation at desktop/phone plus 320/768/1024 widths passed without console errors or overflow; delayed book navigation displayed feedback in 87 ms and PDF rendered; admin logout remained reachable at 600px height. Results retained in test-results/round-one. Changes are local, not deployed.


### Observation 11: Verify rehearsal content provenance beyond successful test flows

**Status:** OPEN
**Date:** 2026-10-14
**Session context:** Importing supplied question banks into a deployed competition and preparing administrator rehearsal
**Skill:** vercel:verification, Walk the Data Flow
**Type:** open-source
**Phase/Area:** Content import and persistent rehearsal sessions

**Issue:** Prepared source files and a successful rehearsal did not establish that deployed testing used supplied content. The deployed bank was empty, the test engine could substitute synthetic content, and older browser sessions could retain synthetic snapshots after import.

**Suggested improvement:** Inspect the target database, compare imported records to source records, and verify the question IDs and content source in newly created test snapshots. Audit resumed sessions and fallback paths as well as new-session creation.

**Principle:** Passing a user journey proves the workflow only when the tested content is the intended content; persistent snapshots and automatic substitutes require explicit provenance checks.

2026-10-14 admin testing checkpoint: imported the exact 75 supplied drafts into NBC production with version history and explicit user-authorized import audit. Deployed focused commits d141580, b7d3cf8 and 8b1bc53; the canonical domain serves READY deployment dpl_77wA5juH3RnNjhXjSj2YmD9ngR8F. Dashboard exposes book and stage blockers; production admin tests reject synthetic fallback and old synthetic snapshots and filter drafts by the current book. All 36 distinct source pages for 66 book questions were visually reviewed; nine official-source questions have no book hints. Checked cover, normal and range hints live and fixed exact page captions. Fresh live runs use 20/25/30 supplied questions, middle submission scored an independently verified 8/20 and locked 20 answers, and university resumed after refresh. Passed 132 unit, 48 integration, 22 PostgreSQL OTP/auth, 21 PostgreSQL competition/migration, 9 private-storage, 31 production HTTP and 29 live HTTP checks, typecheck and production build. The campaign remains DRAFT, all 75 records unapproved, no frozen sets and zero participant attempts. Evidence is retained at tmp/start-readiness/verification.json and related screenshots/logs.

### Observation 12: Verify rehearsal restrictions and result secrecy against the participant contract

**Status:** OPEN
**Date:** 2026-10-14
**Session context:** Repairing question approval, restoring reading controls and removing answer disclosure
**Skill:** vercel:verification, Walk the Data Flow
**Type:** open-source
**Phase/Area:** Rehearsal parity, timing evidence and result projection

**Issue:** Earlier reading tracking only recorded evidence and hint eligibility; it did not reject unread answers. Administrator rehearsals exposed answer feedback while participant responses hid it, and partial batch failure copy masked the source-review prerequisite.

**Suggested improvement:** Test the precise user contract in both rehearsal and participant APIs: unread SELECT/SUBMIT rejection, server-timed exact source-page coverage, replay/ownership/offline handling, and aggregate-only submitted responses. Validate an entire approval batch before committing it, with explicit source review and useful errors. Verify one real deployed journey through submission, not only a successful score in isolated tests.

**Principle:** A rehearsal must enforce participant restrictions, and removing a disclosure from the screen must also remove it from the response.

2026-10-14 reading-controls checkpoint: deployed commit 9297a37 to READY production deployment dpl_6uHmYeCfsGDRQGsGHU21itRFEZMi. Reading evidence uses server receipt time, exact source pages with a five-second minimum, active visible reader heartbeats, neutral gates and quiet pace/jump audit flags. Bulk review validates and approves atomically; stale batches write nothing. Submitted responses and results expose no per-question answers or feedback, including rehearsals and older cached result data. All 75 supplied questions score through the protected engine; live middle rehearsal submitted 20 answers and scored 8/20 after independent source-page reading. Desktop, mobile and two-page range checks passed. Passed 135 unit tests plus four focused render/bank checks, 48 local HTTP, 22 PostgreSQL auth, 24 competition/migration, 9 private-storage, 32 production HTTP and 29 live HTTP checks, build/typecheck. Live campaign remains DRAFT with 75 unapproved questions and zero participant attempts. Evidence retained in tmp/reading-controls/verification.json.

2026-10-14 analytics checkpoint: deployed commit 11990be to READY production deployment dpl_BcTFDq9wSNs3igQqb3dMYc42GCNq on the canonical domain. Added nine real-data visuals, five headline summaries, registration date filters, synchronized school-stage/city selections and matching CSV timing fields. Reading observations exclude rehearsals and other campaigns; averages exclude unfinished attempts and invalid clocks. Map uses published geoBoundaries/OSM geometry and GeoNames city centers, with the official Eastern Province Emirate location for Al-Bayda and explicit source licenses. Checked all 12 city positions and 96 isolated synthetic UI records, combined filters, all four school-stage selections, map selection and mobile overflow. Passed 142 unit tests, 16 final focused checks, 50 local HTTP, 22 PostgreSQL auth, 30 competition/migration, 9 private-storage, 32 production HTTP and 29 live HTTP checks, typecheck and production build. Live page has nine visuals and correctly reports one registration, zero completions and unavailable averages, with no console errors. Production content is unchanged: DRAFT campaign, 75 questions, one participant, zero completed participant attempts. No new reusable skill observations. Evidence retained at tmp/analytics-rollout/verification.json.

### Observation 13: Test one-event deadline arithmetic with an advancing clock

**Status:** OPEN
**Date:** 2026-10-14
**Session context:** Implementing a timed dashboard simulation and isolated participant practice
**Skill:** vercel:verification
**Type:** open-source
**Phase/Area:** Deadline calculation and deterministic regression tests

**Issue:** Frozen-clock tests passed while early closure computed its two timestamps with separate clock reads. A real browser assertion detected a one-millisecond completion-period discrepancy. The implementation now captures one close timestamp and the regression uses an advancing injected clock.

**Suggested improvement:** In the timing checks of the verification workflow, include an advancing-clock case alongside frozen-clock boundary tests and assert relationships between timestamps for a single logical event.

**Principle:** Fixed clocks make boundary tests reproducible but can hide drift from repeated clock reads; deadline arithmetic needs both fixed-boundary and advancing-clock verification.

**Reference file:** tests/simulation.test.ts

2026-10-14 partner visual checkpoint: reduced organizer logo by 15 percent in both dimensions across responsive layouts and reused its caption style for the strategic and educational groups. Applied to saved checkout and task worktree while preserving existing saved edits. Desktop and 390px mobile checks verified equal caption styles, loaded proportional logo, and no mobile overflow. Typecheck, targeted formatting, diff check, and design detector passed. Preview http://127.0.0.1:3015/#organizations. No deployment and no new reusable observations.

2026-10-14 homepage registration CTA checkpoint: increased existing gold action text from 13px to 16px, weight from 500 to 700, height from 50px to 56px, and padding to 12px 28px. Hero actions stack full-width at 760px and below. Saved checkout and task worktree match; preceding partner edits preserved. Desktop and 390px mobile browser checks confirmed initial-viewport CTA visibility, no mobile overflow, and successful clicks to the rendered registration form. Formatting, diff check, and design detector passed; no browser errors. CSS-only change, no full build or deployment, no new reusable observations.
