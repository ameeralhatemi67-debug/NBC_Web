# Exam UX refresh

Local work on `codex/exam-ux-refresh`, starting from the dirty `codex/backend-completion` working tree. Earlier session changes remain uncommitted. No deployment, production access, schema changes, or repository secret/data reads.

## Phase 0

Created the refresh branch and recorded the starting changes in `test-results/ux-baseline/`. Commits include only this session's changes, using patches against that baseline for already-dirty files.

Next.js runs from a fresh OS-temporary source mirror with copied pinned dependencies, the existing Prettier configuration, no environment files, and an allowlisted process environment. The local preview uses `NBC_RUNTIME_MODE=demo`, `OTP_PROVIDER=fake`, a synthetic OTP fixture, and a disposable `NBC_DATA_DIR` at port 3100. This prevents Next.js from automatically loading the repository's operator environment files. Next-generated files stay inside the mirror.

The unit and integration runners now create their PGlite data in OS temporary directories. The restore regression invokes the unchanged restore script from its disposable test directory. Its new `.data/restored` directory contains only synthetic test data. The owner explicitly approved `.data` inside the disposable mirror/test workspace; the repository's `.data/` and `tmp/` remain untouched.

Baseline results:

- `npm run typecheck`: passed.
- `npm test`: 53 passed. The sandbox initially blocked `tsx`'s OS username lookup; the same isolated command passed with approved process permissions.
- `npm run test:integration`: 38 passed, including snapshot restore and test-run isolation.
- `npm run format:check`: passed.
- `npm run build`: passed.
- `tests/exam-ui.cjs`: passed at 1366×768 original, 1024×768 official, 1280×720 hybrid, 390×844 original, and 320×740 official. No browser page errors. Screenshots are under the temporary mirror's `test-results/exam/`.

The Chrome browser tool rejected the prototype's `file://` URL. The owner opened NBC Journey Lab manually in the requested Chrome group, but the tool also rejected inspecting that existing local-file tab. The handoff, design system, previous implementation report, and relevant split prototype source were read. Automated visual inspection of the prototype remains unavailable through that tool.

## Phase 1

Implemented W1 and the shared student motion rules from section 4.11.

- Added `src/lib/format.ts`: React `NumPair`/`pairLtr` numeric isolates, Arabic plural copy, exhaustive competition-state labels, relative closing phrases, Gregorian Riyadh time with Latin digits, and result sentences. The plural helper follows the handoff's explicit 100+ rule rather than the prototype's modulo rule.
- The result displays "أجبت إجابة صحيحة عن 5 من 20 سؤالًا." for five correct answers out of twenty. Hidden scores still omit this sentence. Progress and leaderboard score pairs use explicit LTR isolates.
- The intro displays Arabic competition states and retains OPEN-only Start gating. Its closing-time button shows a relative phrase and reveals exact Riyadh time on focus, click, or touch activation, with the exact time also in its title. Time-dependent copy updates every minute and cleans up the interval on unmount.
- Pending status counts distinct questions, so SELECT and CHECK events for one question produce one pending answer. It uses singular/dual/few/many Arabic forms and a separate pending-submission label. Status has an icon and polite live announcements. Pending locks show one neutral explanatory line; the retry action remains until Phase 2 supplies the offline banner.
- Added `src/app/exam-ux.css`, imported after the existing identity styles. It defines the approved easings and durations, press feedback, feedback reveal with `@starting-style` and an animation fallback, token-based copper focus, touch hover suppression, and reduced-motion timings. Component-specific question/sheet/popover/book motion will use these tokens when those components are implemented in later phases.

Validation:

- `npm run typecheck`: passed.
- `npm test`: 59 passed, including six new tests for plural boundaries, numeric isolation, every competition state, relative-time boundaries, Riyadh timezone/Gregorian dates, and result sentence order. A first concurrent run failed; the focused formatter tests and the full logged rerun passed.
- `npm run test:integration`: all 38 checks passed.
- `npm run format:check`: passed. The new `.cjs` browser script also passed a separate Prettier check because the existing npm format glob excludes `.cjs`.
- `npm run build`: passed.
- Existing `tests/exam-ui.cjs`: all five baseline scenarios passed. Its tested button names/selectors did not change in Phase 1, so it remains untouched. Lock immutability, correct/incorrect server feedback, continuous reading with fewer than ten canvases, two-page hints, return to full book, mobile focus, exit, resume, and reload remain covered.
- New `tests/exam-ux.cjs`: checked intro and result at all seven specified sizes in all three identities, with RTL, no horizontal overflow, score-hidden policy, reduced motion, and exact-time disclosure. The 5/20 result comes from actual server CHECK/SUBMIT events in an isolated admin test run; participant presentation uses test-only routed snapshots without participant writes. Additional checks cover all five state labels and Start gating, emulated phone touch activation and target size, singular/dual pending copy, deduplication of queue events, one pending feedback line, normal motion durations, reconnection, and immutable locks.

Screenshots are saved under `test-results/exam-ux/phase-1/`, including `result-original-390.png`, `intro-official-320.png`, and `pending-reconnected-original-1366.png`. Baseline exam captures are copied to `test-results/exam/`. Logs are retained in `test-results/phase1-unit.log` and `test-results/phase1-browser.log`.

This phase does not complete the new intro/result layouts or make every existing result action fit without scrolling. Those acceptance checks belong to Phase 4. Phone reader/dock/gesture checks belong to Phase 3; the new exam loop and its tests belong to Phase 2. No Phase 2 work has started.

Only this session's changes are committed. For `participation.tsx`, overlapping context from the earlier uncommitted exam work required a reviewed HEAD-based staging copy. The earlier exam, feedback markup, and hint implementation remain uncommitted in the working tree. Verification ran against the complete local working-tree state, as requested.

### Owner follow-up before Phase 2

Renamed TypeScript baseline/staging artifacts under `test-results/` to `.snapshot` files so the real repository's broad TypeScript include patterns no longer compile them. The intro resolves both stage keys and stored Arabic labels with `stageNames[registeredStage(participant.stage)]`, and its opening time now shares the Gregorian, Latin-digit Riyadh formatter. Motion tokens, the `--ease` override, button transitions, press feedback, focus colour, and feedback animation are scoped to the exam, intro, and receipt containers.

All gates were then run from the actual repository, not the source mirror: `tsc --noEmit`, `npm run typecheck`, 59 unit tests, 38 integration checks, formatting, and build passed. `scripts/local-ux-check.cjs` runs the requested npm/Node command in this checkout with an allowlisted demo environment and disposable OS-temporary data. Its inherited preload treats operator `.env*` files as absent before Next.js can load them; it neither reads nor edits their values. Example: `node scripts/local-ux-check.cjs run build`. The TypeScript snapshot fix also permits direct `npx tsc --noEmit`.

The 21-case Chrome script passed against the real-repository demo on port 3101, including assertions for the Arabic stage, Gregorian opening date/Riyadh time, and unchanged easing outside the competition screens. Next-generated `next-env.d.ts` was restored from its pre-run snapshot. Phase 1's commit was amended to include these corrections.

## Known scope notes

The existing safe-question payload includes source-page metadata before locking. The hint gate remains a UI rule. Changing this exposure needs an owner decision and is outside this refresh.

The rehearsal prerequisite needs its own reviewed backend decision in Phase 6. It remains informational until that work is approved.
