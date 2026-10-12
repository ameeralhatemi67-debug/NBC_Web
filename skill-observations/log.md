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
