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

## Phase 2 validation checkpoint

Implemented the core exam loop from W3, W4, W7 and W6. A visual identity decision is pending before the phase commit.

- The question body scrolls inside its panel while the footer stays visible. The primary action is "ثبّت إجابتي", then "السؤال التالي", and finally "راجع وأرسل" once all answers are locked. A last question reached early links back to the first unlocked question. Enter hints appear only on a wide screen with a fine pointer.
- Option rows are at least 52px high. Their real radio/checkbox inputs are visually hidden. Server-confirmed answers have icons and text, unchosen rows dim to 62%, and a post-lock source-page chip scrolls the reader and flashes a copper outline for 1.4 seconds. The outline starts after the page canvas is ready, including when opening the reader on a phone. Repeated source requests also scroll to the beginning of the same page.
- The top bar contains one segmented question strip, with current, unanswered, correct, incorrect and pending states. Where cells would be narrower than 18px, an accessible 44px strip button opens a separate navigation grid. This grid is available before all answers are locked; the submission review remains gated on all locks.
- Keyboard selection, Enter locking/advancing, RTL arrows and Escape work without animation. Inputs used for typing retain their keys. Navigation focuses the question heading.
- Locked hints explain eligibility without exposing a page number. Eligible and active hints use the approved copy, show only the source and preceding page, and return to the whole book. Changing question or locking leaves the hint. Admin validation rejects a last-page source with an Arabic correction; a legacy last-page source unlocks on arrival at that page. Normal eligibility remains strictly after the source page.
- The top-bar status includes an icon and a polite live label. The offline banner supplies the retry action. Distinct pending answers and queued submission keep their approved Arabic copy. A pending lock stays neutral until the server returns correctness.
- The final review opens automatically after the last lock, starts focus on the submit action, traps forward/backward Tab, and restores focus after Escape or cancellation. Its cells close the dialog and navigate. Its two approved actions preserve the existing durable SUBMIT queue.

Verification in the real repository, with environment-file loading blocked and fresh disposable data:

- Direct `npx tsc --noEmit` and `npm run typecheck` passed.
- `npm test`: 62 passed. Three new tests cover normal/legacy last-page hint eligibility, last-page admin validation, and strip correctness requiring a locked answer plus server feedback.
- `npm run test:integration`: all 38 checks passed, including test-run isolation, offline events, immutability, server scoring and disposable restore.
- `npm run format:check` passed; `.cjs` files also passed a separate Prettier check.
- `npm run build` passed.
- Updated `tests/exam-ui.cjs`: all five existing scenarios passed, with the new button names, hidden input semantics, visible sticky action, source-page jump/flash, internal body scrolling, continuous reader with fewer than ten canvases, two-page hints, exit/resume and reload.
- New `tests/exam-loop.cjs`: all seven specified viewports in all three identities passed. It checks option semantics, source-chip gating, strip status, keyboard navigation, heading focus, compact navigation focus restoration, locked-answer immutability, no horizontal overflow and a visible primary action. Actual isolated admin runs passed both online and offline 20-lock review flows, including automatic opening, initial focus, Tab trap, Escape, cancellation, question jump, focus restoration, submit, queued submit and reconnect. A presentation-only fixture also passed long multi-select text, selection toggling, the typing guard and the legacy last-page two-page hint. That fixture returns only SELECT choices and never computes correctness.
- The focused Phase 1 browser regression passed Arabic labels/Start gating for every state, touch time disclosure, singular/dual pending copy, normal motion, reconnect and immutable locks. Its old numeric-counter selector now checks the pending strip cell.

The browser checks caught and fixed an inherited `align-self: start` reader height that initially retained too many canvases, a top bar that did not fill the available width, and review focus escaping/restoring to the wrong control. Test selectors were scoped where duplicate accessible text was expected, and checks wait for durable local writes, focus animation frames and server confirmation before asserting their respective states.

Screenshots are in `test-results/exam-ux/phase-2/`. Logs are `phase2-unit.log`, `phase2-integration.log`, `phase2-build.log`, `phase2-browser.log`, `phase2-existing-browser.log` and `phase2-phase1-regression.log` under `test-results/`.

Pending owner choice: W3 and DESIGN.md require green correctness states, but the existing `--olive`/`--olive-deep` variables map to blue in the official identity. The tested implementation currently follows those existing identity variables. Approval was requested for exam-scoped semantic correct-green/mint variables using DESIGN.md's approved colours, with action buttons retaining their identity colours. No colour exception is assumed, and Phase 2 is not yet committed.

Phone zoom, dock, gestures and the new reader toolbar remain Phase 3. The result/intro layouts and closable result reader remain Phase 4. The real-cover 3D book remains Phase 5; admin-only search and launch/workshop work remain Phase 6. No later phase has started. The prototype's local-file inspection limitation remains as recorded in Phase 0.

### Phase 2 owner review and completion

Applied the owner's follow-up decisions before committing. Semantic status variables are scoped to exam, intro and result containers and identical across all identities. Correct text/background/border use #256044 / #e8f4ec / #5a9f78; incorrect use #9a3328 / #fcebe7 / #cf7b6f. This includes rows, strip cells, feedback and icon-labelled review counts. Actions, pre-lock selection and focus retain the identity variables. Text contrast is 6.55:1 correct and 6.32:1 incorrect, exceeding 4.5:1. Correct green remains distinct from official blue selection.

Question-navigation arrows now leave the option group to its native behaviour. Number shortcuts cover every available option up to six and ignore larger keys. Browser checks exercise native radio arrows without question navigation, checkbox arrow guards, keys 5 and 6, and ignored key 7. Below 430px of strip width the compact control shows coloured ticks without digits and a visible NumPair position; its navigation grid retains labelled status icons.

The full real-repository rerun passed typecheck, 63 unit tests, 38 integration checks, formatting and build, the five existing exam UI scenarios, all 21 exam-loop viewport/identity cases plus online/offline review and long six-option/legacy hint cases, and the complete Phase 1 regression. Approved screenshots include `official-correct-incorrect-1024.png`, `official-correct-incorrect-320.png`, and the 320px/390px `loop-*` captures under `test-results/exam-ux/phase-2/`. Approved logs use the `phase2-approved-*` prefix.

Per the owner, the Phase 2 commit includes the 2026-10-05 exam-UI baseline and its related code: continuous verified/virtualized reader, post-lock server feedback, terms/content/admin settings copy, service/domain updates and their regression tests. Unrelated earlier changes remain uncommitted: README.md, docs/implementation/2026-10-04-admin-access-fix.md, docs/implementation/COMPETITION_OPERATIONS.md and skill-observations/log.md. Existing untracked design/handoff/prototype reference files, admin-access/resume and Supabase/backend notes, and unrelated prize/deployment captures also remain uncommitted.

The repository now contains `scripts/local-ux-check.cjs` and `scripts/local-ux-no-env.cjs`, committed in Phase 1. The former runs npm or Node commands in the real checkout with an allowlisted demo environment and a fresh OS-temporary NBC_DATA_DIR; the latter blocks Next and inherited child processes from reading operator .env* files. They allow testing this checkout without its production configuration. They may be retained or removed at the owner's discretion; ordinary npm gates still work with appropriately isolated runtime configuration.

The previously recorded colour decision is resolved. No Phase 4 work is included.

## Phase 3: reader toolbar and phone reading

Phase 2 was committed as `329eff4` (`feat: complete phase 2 exam UX including 2026-10-05 baseline`). Phase 3 implements W10 and W5 only.

The reader now has one toolbar with contents, an LTR page input/stepper, an LTR real-minus zoom group, night mode, page-by-page mode and a labelled/tooltip external-book action. Contents resolve named destinations and page references from `pdf.getOutline()`, including nested entries. This PDF has no outline, and PDF page 2 is blank, so its version-keyed presentation configuration starts at page 1 and supplies named cover/title entries plus numbered access to all 66 pages. The configurable fallback lives in `src/lib/reader-presentation.ts`; no schema or API changes were needed. The exam restores its durable session page, while standalone reading also restores a per-SHA local page. Night and page-mode choices persist per device. Night mode inverts page canvases over a dark desk and dims the cover. No student search or text indexing is imported; a unit test traverses the participant import graph to enforce that boundary.

Below 820px of the exam container, the default question view has a 44px book bar. It opens a full-screen reader dialog with a compact header that hides on downward scroll and returns on upward scroll or tap. Pages fit the available width. Native touch events support 100–300% pinch zoom, double-tap 100/200%, horizontal/vertical pan and RTL page-turn swipes in the optional page mode. Canvas rendering waits 150ms after scale changes and caps density at 2 and each canvas at 16M pixels. Continuous reading retains the existing near-viewport canvases rather than rendering the entire book.

The collapsed question dock stays at most 56px plus the safe-area inset; its 60dvh sheet contains the same question card and sticky action used in question view. Students can select and lock an answer, see server feedback and advance while the book remains open. Shared selectors apply the same font scale and approved semantic status colours inside the sheet. Two-page hints and return-to-full-book remain intact. Container resizing switches to the 5fr/6fr layout at 820px and preserves the reading anchor. Closing retains the mounted reader and exact scroll position. Escape and browser back close the phone dialog, restore the opener even when its button was recreated, and remove question-panel inertness. The dialog traps keyboard focus. No draggable split pane was added.

The verified PDF SHA/cache/page-count loader, locked answers, server-only correctness, durable offline queue, hint eligibility and isolated test runs remain in place. Existing `.cjs` selectors now expect a retained hidden reader after close. The legacy last-page fixture uses the explicit full-book action and asserts that Escape closes the phone dialog, as W5 requires.

Final real-repository verification used the two local isolation scripts described above, fresh OS-temporary data and blocked environment-file loading:

- Typecheck passed; build passed, including verified book/worker preparation and Next's TypeScript check.
- All 67 unit tests passed. New tests cover canvas/DPR limits, phone zoom bounds, version-keyed fallback/opening position, named/referenced/nested outline destinations and the participant import boundary.
- All 38 integration checks passed, including the disposable restore workspace.
- Format check passed; the browser `.cjs` files and isolation scripts also passed a separate Prettier check.
- `tests/exam-ui.cjs`: all five existing scenarios passed.
- `tests/exam-loop.cjs`: all 21 viewport/identity cases, online/offline 20-lock review flows, and six-option/legacy last-page fixture passed.
- `tests/exam-ux.cjs`: the full Phase 1 regression passed (21 viewport/identity cases plus state gating, touch disclosure, pending/reconnect and normal-motion cases).
- `tests/reader-ui.cjs`: all 12 real-touch-emulation contexts passed (`hasTouch`, `isMobile`, DPR 2 at 320x740, 360x740, 390x844 and 430x932 in each identity). Assertions cover width fit, contents fallback, dock answer/immutable lock, exact status colours, sticky action, pinch and sharpened raster, pixel cap, pan, header reveal, zoom buttons/double-tap, night filter, page swipe, orientation, hints, close/reopen scroll, browser back, Escape and focus restoration. All three 1024px desktop cases also passed toolbar row fit, page input/stepper, contents keyboard/focus, LTR zoom, no search, page/night/page-mode persistence and dimmed cover. No page errors were reported.

Browser checks and screenshot review caught and fixed page-size/filter transitions accidentally introduced by the legacy reduced-motion rule, stale scroll callbacks during navigation, programmatic page jumps hiding the toolbar, lost focus to unmounted opener buttons and missing question-card styles inside the dock. Phone Escape also closes reliably during the hint focus-restoration interval. An initial sandboxed unit invocation failed in Node's OS user lookup; the permitted local runner rerun completed with all 67 tests passing.

Logs use the `test-results/phase3-*` prefix. Phase 3 screenshots are in `test-results/exam-ux/phase-3/`: `reader-*`, `zoom-*`, `dock-*` and `question-*` for all four phone widths in all three identities, plus the three `reader-*-1024.png` desktop captures. Examples: `reader-original-320.png`, `zoom-official-390.png`, `dock-official-390.png`, `question-hybrid-430.png`. Approved Phase 2 captures remain under `test-results/exam-ux/phase-2/`, including `official-correct-incorrect-1024.png`, `official-correct-incorrect-320.png` and the 320/390px `loop-*` tick strips. Screenshots/logs are local ignored artifacts, not committed source.

Physical phones were unavailable. Chrome touch emulation and browser history were verified; iOS Safari/Android hardware back gestures, browser chrome/safe-area behavior and low-memory device performance still need physical-device checks. The real PDF's empty-outline fallback was exercised in the browser; non-empty outline resolution was verified with the unit fixture. No owner decision is needed for this phase. The unrelated tracked documentation and existing untracked references listed above remain uncommitted. Phase 4 has not started.

## Phase 3 review follow-up A: real contents data

`scripts/extract-book-outline.mjs` is a development-only PDF.js tool. It checks the
immutable SHA, reads all 66 pages, detects heading prefixes and large text when
Unicode is available, and writes candidate titles/PDF pages/printed pages plus
the first 80 extracted characters for every page to
`docs/implementation/2026-10-06-book-outline-candidates.md`.

The real PDF uses Type 3 glyphs without usable Unicode text mapping. Automatic
Arabic titles and printed-page numerals are therefore unavailable. The report
escapes the raw extracted characters and clearly identifies this limitation.
For this SHA, provisional headings and printed page numbers were transcribed
from the rendered contents page and checked against all nine chapter/index
opening pages. No readable text was invented and no student indexing code was
added. Committee review of the proposed titles and pages remains pending.

PDF 63, printed page 61, is the real contents page. New exam sessions open there;
existing durable session pages and standalone per-SHA saved pages still win.
Named cover/title/chapter/index entries appear first under "فصول الكتاب", with
LTR page numbers. Only untitled pages appear in the expandable "صفحات أخرى"
group. The participant import-boundary test still excludes development tools,
admin components and `getTextContent` indexing.

Typecheck and all 67 unit tests passed. The reader browser regression was updated
deliberately for the real first page and grouped contents, and checks chapter
jumps before numbered-page jumps. Rendered reference artifacts are local only
under `test-results/book-outline/`.

All 12 touch viewport/identity cases and three desktop reader cases passed. The
swipe fixture now explicitly navigates to PDF 10 before testing a next-page
gesture, so it cannot inadvertently begin at the last page. Format check passed.
The run log is `test-results/phase3-contents-reader.log`.
