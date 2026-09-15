---
type: report
tags: [nbc, verification, handover]
created: 2026-09-08
updated: 2026-09-08
---

# Verification and handover

Parent: [[00-Implementation-Index]]

## Automated checks

| Check | Result | What it establishes |
|---|---|---|
| TypeScript | Passed | Source types and route/component interfaces compile |
| Production build | Passed | All five user-facing routes and the API build successfully |
| Domain tests | 6 passed | Digit normalization, key exclusion, deterministic scoring, forged-answer rejection, time-independent ties, CSV escaping |
| Isolated integration suite | 35 passed | Authentication simulation, authorization, concurrent writes, version snapshots, publication, report reconciliation, OTP exhaustion, backup and restore |
| Formatting | Checked separately with `npm run format:check` | Consistent formatting of newly created source files |

The integration report is generated at `test-results/integration.json`. Each run creates its own database and launches on port 43187. Test fixtures are separate from the presentation database. Port 3001 was found to return another local service's responses and is not used by this test suite.

The restoration test downloads an administrator-only compressed snapshot and restores into a new `.data/restored-*` directory. Participant and completed-submission counts match the source. Restored sessions and OTP challenges are invalidated. Existing databases are not overwritten.

## Browser checks performed

- Reviewed the Contemporary Heritage homepage on desktop.
- Registered a synthetic participant and verified wrong-code recovery followed by successful simulated OTP entry.
- Started an attempt, selected answers, and confirmed server save acknowledgements.
- Used keyboard arrow navigation to change an answer and verified the selected state.
- Reloaded the participation page and verified that the saved choice remained selected.
- Opened the reading text beside the question on desktop and in a dedicated mobile panel.
- Changed the reading chapter, closed the panel, and confirmed the same chapter returned after reopening.
- Completed all ten sample questions, reviewed the answers, confirmed final submission, and observed the receipt with results pending approval.
- Inspected the committee dashboard showing seven synthetic participants, including the browser test participant; five completed and two incomplete.
- Opened the reminder preview and verified that only the two incomplete synthetic participants appeared, with no message sent.
- Filtered the report to the university stage; the visible two records and export filter agreed.
- Checked 390px mobile layouts for participation and reports; the document width remained within the viewport.
- Checked the browser console on the reviewed page; no application error entries were returned.

These checks are observations of the local browser build, not an independent usability study or accessibility certification. Full screen-reader testing, physical-device performance testing, zoom/reflow testing across all pages, and reduced-motion runtime testing remain to be completed.

## Preview operation

Use the root README for installation and launch commands. The hidden Windows launcher is `scripts/preview.ps1`; it checks that the preview responds before reporting readiness and records its process ID and logs under `tmp/server`.

Managed execution sessions can terminate background processes when sessions are interrupted or cleaned up. If the preview becomes unavailable, relaunch it with the script or keep `npm run start` running in a normal terminal. Confirm that the chosen port is unused rather than stopping an unrelated local service.

The app reports connection and save failures in Arabic, preserves the current choices in memory, and offers retry. Only acknowledged saves are guaranteed after reload; unsaved edits should not be described as durable.

## Review boundaries

The interface and all assets are local. No proposal was submitted, no external SMS was sent, and no real identity service was contacted. No live hosting bill or other service purchase was made.

The following remain dependencies for further implementation:

1. Supplier pages 6–11: price, hosting, support, duration, handover, and commercial comparison.
2. Official invitation and rubric: submission format, deadline, and weighting.
3. Approved book and question governance: rights, source version, reviewed questions, and scoring rules.
4. Eligibility, privacy, staff authentication, real notifications, campaign dates, and result/tie policies.
5. Production infrastructure, load targets, security/accessibility assessment, data migration, monitoring, and support agreement.

Related: [[01-Demo-Requirements-Coverage]], [[02-Committee-Demo-and-Proposal]], [[03-Design-and-Technical-Decisions]].
