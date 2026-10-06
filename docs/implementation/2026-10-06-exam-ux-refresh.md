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

## Phase 3 review follow-up B: compact phone header

The phone header now has a single row at 320–430px: labelled question return,
LTR page stepper, current zoom with an adjustment popover, and a 44px "المزيد"
button. More contains visible labels for contents, page-by-page mode, night mode,
and opening the full PDF. Desktop controls keep their existing labels and layout.
Menus focus their first item, support arrow keys and Escape, and close on outside
interaction. Escape consumes the menu action before the document's reader-close
shortcut. Open menus keep the auto-hiding header visible.

All 12 touch cases and three desktop cases passed, including single-row height,
the More target, visible option labels, reader retention after menu Escape, and
the existing zoom/gesture/dock/hint/restore checks. The log is
`test-results/phase3-phone-header-reader.log`; refreshed `reader-*`, `zoom-*`,
`dock-*`, and `question-*` captures remain under `test-results/exam-ux/phase-3/`.
Typecheck passed. The design docs and Journey Lab were separately committed as
`e2a6624`, per review sub-task C. The contents follow-up is `3955e74`.

## Phase 4: result, result reader and introduction

The compact-header follow-up was committed as `0eeade5`. Phase 4 implements W8,
D5 and W2; Phase 5 has not started.

The result uses the existing server score in the Arabic sentence, with a small
secondary percentage. Its read-only icon-labelled strip grows over 420ms with a
40ms stagger, and skips animation under reduced motion. A dashed ticket keeps
the participant number readable and offers "نسخ الرقم" / "تم النسخ" for 1.6s.
Clipboard refusal falls back to the browser's copy action; if both paths fail,
a labelled selected read-only field allows manual copying without claiming
success. The four approved committee policy lines drive leaderboard visibility;
the existing Leaderboard component supplies the current rank when available.

Wrong answers produce distinct sorted page chips and expandable review rows
with the student's answer, server-provided correct answer and explanation, and
source-page action. All-correct results show the approved message without a
review list. Hidden scores omit the sentence, coloured strip, correctness
review, page chips and leaderboard; withheld feedback leaves only the student's
own answers. "واصل القراءة" remains. Result content has two columns when review
is available and stacks on narrow containers; results without a review column
use a centered single column.

Result page chips open a native modal dialog reusing the Phase 3 reader. The
sticky 56px header has a filled secondary "إغلاق" button with an x icon and a
96x44px minimum target at the RTL start. Button, Escape, wide-screen backdrop,
safe-area-aware phone bottom button and touch header swipe close the modal.
Opening focuses Close, keyboard focus stays inside, and closing restores the
exact opener chip. Wide dialogs are inset 24px; phone dialogs fill the screen.
The mounted reader retains page, zoom and night mode while closed. Layout-effect
opening makes different-page review links jump after the dialog becomes visible.
The PDF viewport fills the remaining dialog height and still keeps fewer than
ten page canvases near the viewport.

The introduction now greets the first name, displays the translated stage pill
and four icon facts, and keeps one primary action beside the relative closing
time where space permits. Phone typography and spacing fit the whole intro at
320x740 through 430x932 in all three identities. Opening dates retain Gregorian
Riyadh formatting with Latin digits. The flat cover renders the verified PDF's
real page 1 at 1400px with its own aspect ratio; no cover asset or dependency was
added. Its graceful loading/error/retry placeholder occupies the same slot.

The cover and reader share one cancellable PDF loader: cached or fetched bytes
must pass SHA-256 and PDF page-count checks before reuse or caching. Only a
verified cached book gets the offline-readiness claim. Loading, blocked cache
and verification failures keep the neutral "جارٍ تجهيز الكتاب" line; a verified
PDF can enable Start even when caching is unavailable. Student search/indexing
remains absent. Locked answers, server correctness, offline queue, hint rule and
isolated test runs remain unchanged; no backend or schema work was needed.

### Phase 4 verification and artifacts

All requested gates passed in the real checkout with the safe local runner,
fresh OS-temporary NBC_DATA_DIR and blocked environment-file loading:

- `npm run typecheck` (`tsc --noEmit`), all 71 unit tests, all 38 integration
  checks, `npm run format:check`, and `npm run build` passed. New unit coverage
  checks server-feedback review/hidden-score gating, unique sorted page chips,
  multi-select answer text, all four policy strings, clipboard fallback failure
  paths and rejection of modified PDF bytes. Integration restore uses only the
  previously authorized disposable source mirror.
- A separate Prettier check passed for the `.cjs` browser scripts and local
  isolation runners.
- `tests/exam-ui.cjs`: all five existing scenarios passed.
- `tests/exam-loop.cjs`: all 21 viewport/identity cases, actual online/offline
  20-lock review/submission flows and the six-option/legacy hint fixture passed.
- `tests/exam-ux.cjs`: all 21 viewport/identity cases and the complete Phase 1
  state, touch disclosure, pending/reconnect and normal-motion regression passed.
  Its intro selector now targets `.intro-window`, waits for PDF verification
  before focusing Start, and scopes the result motion check to the ticket button.
- `tests/reader-ui.cjs`: all 12 Chrome touch contexts (hasTouch, isMobile, DPR 2
  at 320x740, 360x740, 390x844 and 430x932 in all identities) and three desktop
  cases passed with the shared loader. The semantic-colour assertion now waits
  for the server-feedback paint before checking the same approved values.
- New `tests/result-intro-ui.cjs`: all 21 viewport/identity cases passed for
  verified cover/readiness, four facts, intro vertical fit, result sentence and
  small percentage, strip, server review content, sorted page chips, all-correct
  and hidden-score cases, responsive columns and no horizontal overflow. At
  390px and 1024px in every identity it checks native dialog focus/trapping,
  source-page jumps, full-height viewport, fewer than ten canvases, button/Escape
  closure, phone bottom-bar closure, wide backdrop closure, CDP touch swipe-down,
  opener restoration and zoom/night retention across close/reopen. Clipboard
  refusal, real legacy-copy fallback, both-copy-path refusal/manual selection,
  all four leaderboard policies and current rank are exercised separately.
  Four book-readiness cases passed: delayed bytes, denied caching, wrong SHA and
  wrong page count. Normal and reduced result-strip motion both passed. No
  browser page errors were reported.

The final browser runs used the optimized build served only on 127.0.0.1 in demo
mode; this was not a deployment. Screenshot review fixed unused desktop reader
space and checked the complete phone intro and sensible first result screen.
Result-reader captures use a real heading page instead of a blank verso when
the available source chips permit it.

Logs are `test-results/phase4-typecheck.log`, `phase4-unit.log`,
`phase4-integration.log`, `phase4-format.log`, `phase4-browser-format.log`,
`phase4-build.log`, `phase4-exam-ui.log`, `phase4-exam-loop.log`,
`phase4-exam-ux.log`, `phase4-reader-ui.log`, and
`phase4-result-intro-built.log`. Final Phase 4 screenshots are under
`test-results/exam-ux/phase-4/`: intro, result, expanded review, all-correct and
hidden states for all seven viewports and three identities; six result-reader
captures, denied-clipboard/manual-copy and loading captures. Examples:
`intro-official-320.png`, `intro-original-390.png`, `result-official-390.png`,
`review-original-390.png`, `result-reader-official-390.png`,
`result-reader-original-1024.png` and `all-correct-original-1366.png`.
These screenshots/logs remain local ignored artifacts.

Physical phones were unavailable. iOS Safari/Android browser chrome, real
safe-area insets, hardware gestures, clipboard permission prompts and low-memory
performance remain unverified on hardware. The existing emulated browser-back
reader case passed; it does not establish real hardware-back behavior. The PDF's
Type 3 text mapping prevents automatic readable Arabic outline extraction; the
visually verified provisional titles and pages still need committee review in
`2026-10-06-book-outline-candidates.md`. No other owner decision is needed for
Phase 4.

No production, migrations, Supabase, repository `.data/`, `tmp/` or `.env*`
values were touched. Unrelated tracked changes remain uncommitted: README.md,
`2026-10-04-admin-access-fix.md`, COMPETITION_OPERATIONS.md and
skill-observations/log.md, plus the existing untracked admin/Supabase/backend
notes and unrelated prize/deployment captures. The two local isolation scripts
remain as described above for the owner's keep/remove decision. Phase 5 has not
started.

## Post-Phase 4 review fixes

- The reader now opens on the cover for first-time exam reading. Opening on PDF 63 (the contents page) made the first scroll count as having read pages 63 and beyond, which unlocked almost every hint. `tests/exam-hint-gate.cjs` asserts a fresh exam opens on page 1 with the hint locked. The contents menu still reaches PDF 63.
- The result screen shows the first six "read again" page chips with a "عرض كل الصفحات (N)" toggle, so a long list of missed questions does not fill a phone screen. `tests/result-intro-ui.cjs` asserts six chips collapsed and all chips expanded.
- A leftover `next start` server on port 3101 from earlier testing served stale code. Stop servers after verification.

Open product decision: the hint rule counts the furthest page reached, and jumps (page box, contents menu) count as reading. Reading the source page and the next page, as the owner described, would need a visited-pages record. Not changed here.

All real-repository gates passed after these fixes: typecheck, 71 unit tests, 38 integration checks, format check and build, plus `reader-ui`, `result-intro-ui` and `exam-hint-gate`.

## Phase 5: 3D book (reviewed and built after Phase 4)

Phase 4 was re-checked first: the post-review fixes above are in place and its suites still pass. Phase 5 adds the 3D book to the intro and result screens only.

- `three` 0.186.1 and `@types/three` 0.186.0 are pinned exactly. Only `src/lib/book-scene.ts` imports `three`; `src/components/book-stage.tsx` loads it with a dynamic `import()` after the verified page-1 canvas has painted. The stage is mounted by the intro and the result screen, never by the exam, and `tests/book-model.test.ts` asserts that import graph.
- Front cover texture is the verified page 1 canvas the flat cover already renders (about 1400 px, same SHA-checked loader and cache). Proportions come from that canvas; thickness is `thicknessRatio(pageCount)`: 2.57% of the height at 66 pages, clamped to 1.5 to 6%. Spine on the right, stacked page edges drawn from a deterministic line texture, a 5 degree fore-edge curl, plain back in the cover's sampled paper colour with a narrow banner-green stripe sampled from the cover. Soft key, rim and hemisphere lights, no tone mapping, anisotropy up to 8, sRGB output and texture colour space, contact shadow plane.
- Parts are named `cover`, `pages`, `back`, `spine`. The factory has no randomness. Debug hook: set `window.__NBC_BOOK_DEBUG__ = true` before load, then `window.__nbcBook` gives `parts`, `explode(0..1)`, `renderAt(progress, seconds, frontal?)`, `frames`, `memory()` and `dispose()`. Without the flag nothing is exposed.
- Motion: Start opens the cover (650 ms, 146 degrees on the spine edge); the exam appears after the open animation and the attempt request, whichever finishes last. The result screen starts open and closes in 800 ms. Idle sway of 4 degrees and pointer parallax only for fine pointers. Under reduced motion there is no idle loop and open/close are instant. The camera dollies out as the cover opens so it stays in frame. A timer guarantees `open()` settles even when the tab is hidden.
- Fallback to the flat cover (unchanged slot) when WebGL is missing, on low-power devices (2 or fewer cores, 2 GB or less memory, data saver), when the chunk fails to load, or after a lost context. In the first two cases `three` is not downloaded at all. `open()` and `close()` resolve immediately without a scene, so Start is never blocked.
- Rendering pauses when the canvas is off screen or the tab is hidden; pixel ratio is capped at 2; unmount disposes geometries, materials, textures and the renderer.
- The result layout gained a `.result-top` row holding the heading and the book (book above the heading below 760 px).
- Verification, all against the real checkout on a disposable demo: typecheck, 78 unit tests, 38 integration checks, format check, build, and the browser suites `book-3d-ui` (new), `result-intro-ui`, `exam-hint-gate`, `reader-ui`, `exam-ux`, `exam-loop` and `exam-ui`. `book-3d-ui` covers part names, thickness, head-on colour fidelity against the PDF within 12 per channel at 1x and 2x, proportion within 5%, explode, disposal, Start timing (about 890 ms), reduced motion, close timing (800 ms) on desktop and phone, pixel-ratio cap, off-screen pause and resume, WebGL disabled and low power (no console errors, three never requested), chunk blocked, and no three request on the exam screen. Screenshots are in `test-results/exam-ux/phase-5/` (`cover-vs-3d-1x.png`, `cover-vs-3d-2x.png`, `intro-3d-*.png`, `result-3d-*.png`, `book-exploded.png`, `book-open-*.png`).
- `tests/result-intro-ui.cjs` now selects the flat canvas with `.book-cover-slot > canvas:not(.book-3d-canvas)`.
- Known limits: `renderer.info.memory.textures` keeps one entry after disposal that is not one of our five textures (it is three's own accounting); verified on headless Chrome with software WebGL only. Real-device GPU, iOS Safari WebGL, battery and low-memory behaviour are unverified. The open pose uses the cover's own inside colour, not a real inner page.

## Phase 6: committee launch control, workshop, coverage and admin-only search

Local demo only; no migration, `.data`, deployment or backend change. Every existing API action and the `feedbackMode: 'educational'` payload are unchanged.

- **Launch control (`admin-competition.tsx`, `src/lib/admin-launch.ts`).** A six-step track derived from the effective state and `frozenAt` (Arabic labels, `aria-current="step"`, no state code anywhere), one next-action card per step, and a preconditions list before opening: book approved (the SHA-256 sits behind a disclosure), approved questions per stage as `N من 20` with a progress bar that mirrors the server rule in `validateBank` (exactly 20 active, all approved, current book version) and links to the failing stage in the bank, and a rehearsal row that is informational and opens the test run (not a gate; the backend decision in handoff 6.2 is still open). Disabled actions always print their reason. Open, close, cancel-schedule and unpublish use `HoldButton` (1.1 s, pointer or Space/Enter, cancelled by release, blur and `pointercancel`; a plain click does nothing) with an impact sentence that carries the real registrant count (and the in-progress count for closing). Schedule shows Gregorian Latin-digit Riyadh time via `riyadhDateTime` plus a relative chip; the raw `datetime-local` input only appears on request and is always pre-filled. Four result-visibility radio cards with a live "ما الذي يراه الطالب" preview built from `result-presentation.ts` (`resultReceivedTitle`, `resultHiddenLine`, `leaderboardModeLines`, `resultSentence`). Closing policy is a segmented control with the computed grace sentence. The sticky save bar appears only with unsaved changes ("N تغييرات غير محفوظة", تجاهل, حفظ), and a `role="status"` toast confirms. The duplicate eyebrow and tagline are gone from the competition, bank and coverage tabs.
- **Copy fix found while building the preview.** For `leaderboardMode: 'hidden'` the server withholds the score, so the student screen already says "النتيجة محجوبة وفق سياسة المسابقة." but then the policy line promised "نتيجتك تظهر لك فقط". That line is now "لا تُعرض النتيجة ولا ترتيب المشاركين. تعتمد اللجنة الفائزين وتعلنهم بنفسها." (student screen, committee preview and the two tests). The handoff copy deck still shows the old string.
- **Workshop (`admin-question-bank.tsx`, `admin-question-editor.tsx`, `src/lib/admin-workshop.ts`).** Per-stage counters, a dense adaptive row list (a table cannot hold its title column on phones, so rows are a grid that becomes two-line cards under 760 px), a row action menu, bulk "اعتمد المحدد (N)" for approvers that loops over the existing approve action and stops at the first error, version history that names the changed fields with JSON behind a disclosure, and the JSON import/export unchanged. The editor shows the question exactly as a student sees it, read only: `question-card-parts.tsx` (`AnswerOption`, `AnswerFeedback`) is now used by both the exam and the preview. `hintPdfPageStart` and `hintPdfPageEnd` inputs are removed; saving writes `max(1, pdfPage - 1)` and `pdfPage`. Validation chips block an invalid save, including the last-page case. A single-page viewer (`admin-page-viewer.tsx`, same verified loader and cache) has a page stepper, a typed page number and "اجعلها صفحة المصدر".
- **Coverage.** One density strip (one cell per page, three or more questions is crowded), with per-page detail on click and empty and crowded counts. The 66-box grid is removed.
- **Admin-only search: not usable for this book.** Checked on the real PDF with pdf.js: only 1 of 66 pages (page 6, the licence text) returns Arabic letters; the body pages are Type 3 glyphs that decode to control codes. The search is therefore built and unit-tested (`src/lib/book-search.ts`: tashkeel and tatweel stripping, alef and ya normalisation, offset-preserving snippets, idle-time indexing with progress) but the UI refuses to pretend: it says "البحث غير متاح لهذا الكتاب" with the count of searchable pages and shows no search box. It loads only when the disclosure is opened (`next/dynamic` from `admin-page-viewer.tsx`). `tests/admin-search-graph.test.ts` proves no participant entry point reaches any `admin-*` module or the search, and that `getTextContent` appears only in `admin-book-search.tsx`; `tests/admin-ux.cjs` checks the participant routes never request that chunk.
- **Tests.** Unit: `admin-launch`, `admin-workshop`, `book-search` and `admin-search-graph` (100 unit tests in total). Browser: `tests/admin-ux.cjs` (mocked state machine for all eight step cases, hold semantics, settings, preview, save bar, toast, scheduling, workshop, editor, derived hint payload, bulk approve stop, history, page picker on the real PDF, search state, coverage, 7 viewports in 3 identities, reduced motion, then one real lifecycle: freeze, save policy, hold-open, hold-close, publish, hold-unpublish). It must start on a fresh demo data directory because it mutates it. Screenshots: `test-results/exam-ux/phase-6/`.
- **Not verified.** The available-search UI branch has only unit coverage because no readable-text PDF exists in the repo. Physical keyboards and touch for the hold button were emulated, not tried on devices. Admin pages were not checked with a screen reader. Rehearsal remains informational until the backend records it.
