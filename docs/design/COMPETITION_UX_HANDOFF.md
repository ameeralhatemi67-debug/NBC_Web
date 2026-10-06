# Competition UX Refresh: Implementation Handoff

Audience: Codex (or any engineer) implementing this in `NBC_web`.
Author: Claude (design review session, 2026-10-06). Owner decisions are in section 2 and override anything else in this file.

Read in this order: section 1, 2, 3, then the workstreams you are assigned. Section 11 lists the exact prototype files to open.

---

## 0. What this is, and how to see the prototype

The student competition screen (book on the left, questions on the right) and the committee console were reviewed and a working prototype was built. The owner approved most of it (section 2).

**The prototype is in this repo. You do not need claude.ai.**

- Open `docs/design/journey-lab/nbc-journey-lab.html` in Chrome. It is one standalone file. It needs internet only for Three.js (cdnjs) and Google Fonts.
- Source split into readable parts: `docs/design/journey-lab/src-parts/` (see section 11).
- Screenshots of the **current** build used as evidence: `docs/design/journey-lab/screenshots/`.
- Design system written down: `/DESIGN.md` at the repo root.

The original page is a private artifact at `https://claude.ai/artifact/KoQMQC4c52P1EMKPiN6xqL`. It is private to the owner, so do not rely on it. Everything needed is copied into the repo.

The prototype is vanilla JS and CSS. **Do not copy it.** Re-implement each behaviour in the project's React and TypeScript components, using the project's conventions, CSS variables and tests.

---

## 1. Context and hard constraints

Product: Arabic, right-to-left web app for the national competition "الانتماء واللحمة الوطنية". Students in three stages (middle, high school, university) read a 66-page PDF book and answer 20 questions. Next.js 16, React 19, TypeScript, npm project, PGlite locally, Supabase in production.

Constraints you must respect:

1. **Never touch production.** Work only against the local demo (`NBC_RUNTIME_MODE=demo`, `OTP_PROVIDER=fake`, see `README.md`). Do not deploy. Do not run migrations against any remote database. Do not read `.data/`, `tmp/` or any `.env*` values; they contain operator secrets.
2. **Run the dev server on a disposable data directory**, because PGlite allows one process per directory. Example: `NBC_DATA_DIR=<temp dir> npx next dev --hostname 127.0.0.1 --port 3100`. Next.js generates `AGENTS.md`, `CLAUDE.md` and edits `next-env.d.ts` on start. Delete or `git checkout` those afterwards.
3. **The working tree is dirty with earlier, unrelated work** on branch `codex/backend-completion`. Run `git status` first. Do not revert or commit files you did not change. Put your work on a new branch such as `codex/exam-ux-refresh` and commit only your own files.
4. **Behaviour that must not change** (it is correct and tested):
   - Answers are immutable after locking. Correctness and explanations come from the server only after a lock. Unchecked questions never carry keys or explanations.
   - The offline queue (`DurableCompetitionSession` in `src/lib/competition-offline.ts`): selections and locks are stored on the device and synced. An offline lock shows "pending" until the server returns feedback. Server state wins on conflict.
   - Hint eligibility is `maxPageRead > question.pdfPage` and the hint shows exactly the pages `[max(1, pdfPage-1), pdfPage]` (`hintEligible`, `hintTarget` in `src/lib/competition-domain.ts`).
   - Book integrity: the reader verifies the PDF SHA-256 and page count and caches the file in Cache Storage (`nbc-books-v1`).
   - Admin test runs are isolated from real participants (separate IndexedDB and server namespaces).
5. **Three identities** exist: `original`, `official`, `hybrid` (`data-design` on `<html>`, tokens in `src/app/globals.css` and `src/app/designs.css`). Every new style must use the existing variables (`--paper`, `--cream`, `--sand`, `--ink`, `--olive`, `--olive-deep`, `--copper`, `--muted`, `--line`, `--white`, `--danger`, `--radius`, `--body`, `--display`) and must be checked in all three.
6. **Right-to-left and Arabic**: Latin digits are used today and stay. Any two numbers around a symbol must be wrapped in `<bdi dir="ltr">`.
7. Keep the existing quality gates green: `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run format:check`, `npm run build`, and the browser script `tests/exam-ui.cjs` (needs `NBC_PREVIEW_URL` and `PLAYWRIGHT_MODULE`; a Playwright install exists at `D:/Agents/main/projects/ideas/BookQuest/node_modules/playwright`).

---

## 2. Owner decisions (authoritative)

| # | Decision | Effect |
|---|---|---|
| D1 | Student journey approved as prototyped. | Build W1 to W9. |
| D2 | **Keep** the source-page chip after locking, correct or wrong, and keep the clear red state for a wrong answer. | W3. |
| D3 | **Keep** the hint behaviour: it unlocks after the student has read the page that holds the answer and the next one; it then shows two pages. Keep the locked-hint sentence. | W4. |
| D4 | **Keep** the "راجع إجاباتك قبل الإرسال" sheet with its two actions. | W6. |
| D5 | **Change:** in the result screen, the book opened from a "read again" chip is hard to close. Make closing obvious. | W8 (spec in 4.8). |
| D6 | **Change:** make the 3D "procedural book" much closer to the real competition book. | W9 (spec in 4.9). |
| D7 | Committee launch control approved. | W11. |
| D8 | **Change:** on phones, students must be able to actually **read the book**. The prototype's small lower pane is not enough. | W5 (spec in 4.5). |
| D9 | **No in-book search for students.** Search may exist for **admins only**. | W12. Remove the student search switch and code path. |
| D10 | Offline "Loses the connection" behaviour approved. | W7. |
| D11 | Everything else in the review is approved. | All other items in sections 4 and 5. |

---

## 3. Current state: facts to rely on

### 3.1 File map

| Area | Files |
|---|---|
| Student exam | `src/components/participation.tsx` (571 lines) |
| Book reader | `src/components/pdf-book-reader.tsx` (348), `src/components/book-reader.tsx` (wrapper) |
| Exam styles | `src/app/globals.css` (see `.exam-shell`, `.competition-grid`, `.answer-option`, `.question-map`, `.reader-*`, `.pdf-*`, `.receipt-*` around lines 1077 to 1410 and 4560 to 5286) |
| Identities | `src/app/designs.css` |
| Domain rules | `src/lib/competition-domain.ts` (stages, `hintEligible`, `hintTarget`, `safeQuestions`, `validateQuestion`) |
| Offline | `src/lib/competition-offline.ts` |
| Admin shell | `src/components/admin.tsx` (tabs list at line 57, `mutate` at 146) |
| Admin competition | `src/components/admin-competition.tsx` (211) |
| Admin questions and coverage | `src/components/admin-question-bank.tsx` (443) |
| Admin test run | `src/components/admin-test-run.tsx` (113) |
| Tests | `tests/competition.test.ts`, `tests/integration.mjs`, `tests/exam-ui.cjs` |
| Existing notes | `docs/implementation/2026-10-05-exam-ui.md` |

### 3.2 Findings with evidence

"Seen" means observed in the running demo. "Code" means read in source. Screenshots are in `docs/design/journey-lab/screenshots/`.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S1 | P1 | Result reads "20 / 5" for 5 correct of 20 (bidi flip). `participation.tsx:290` | Seen, `receipt.jpg` |
| S2 | P1 | Final Submit button is below the fold on question 20 at 1366x768; Next is disabled. `participation.tsx:479` | Seen, `exam_all_locked.jpg` |
| S3 | P1 | Intro prints raw `competition.state` ("OPEN"). `participation.tsx:250` | Code |
| S4 | P2 | Book opens on the cover with no contents, outline or remembered page. | Seen |
| S5 | P2 | Hint link appears from nowhere; rule never explained. | Seen and code |
| S6 | P2 | Reader toolbar cramped, zoom reads "+ 100% -", unlabeled download icon, title wraps at 1024px. | Seen, `exam_hint.jpg` |
| S7 | P2 | After lock the explanation has no link to the source page. | Code |
| S8 | P2 | Progress split across a 3px bar, a counter and a 20-cell map; none shows right or wrong; dropdown below 360px. | Seen |
| S9 | P2 | On phone the book is a full-screen dialog, the question disappears. | Seen, `m_exam.jpg` |
| S10 | P2 | Sync copy has wrong number agreement ("1 أحداث") and three near-duplicate lines on a pending lock. | Seen, `exam_all_locked.jpg` |
| S11 | P3 | No keyboard shortcuts; radio circle duplicates the letter badge. | Code |
| S12 | P3 | Result screen has no review, no pages to revisit; participant number in typewriter face. | Seen |
| S13 | P3 | Hint can never unlock when the source is the last page. | Code |
| A1 | P1 | Open, close, publish, unpublish run with no confirmation; seven equal buttons; no reason for disabled ones. `admin-competition.tsx:150` | Code |
| A2 | P1 | Raw `DRAFT` code and full SHA-256 in the main status line. | Seen, `admin_competition_top.jpg` |
| A3 | P2 | Native `mm/dd/yyyy` placeholders in an Arabic UI; a policy sentence floats in the form grid. | Seen, `admin_competition_actions.jpg` |
| A4 | P2 | Hint start and end inputs are stored and validated but the participant view ignores them. | Code |
| A5 | P2 | Question bank is 60 near-identical cards, no progress toward 20 per stage, JSON version history. | Seen, `admin_questions.jpg` |
| A6 | P2 | Coverage is 66 identical boxes. | Seen, `admin_coverage.jpg` |
| A7 | P2 | Settings are never shown next to what the student will see. | Seen |
| A8 | P3 | Duplicate headings and a marketing tagline in the work area. | Seen |

### 3.3 Integrity note (flag to the owner, out of scope)

`safeQuestions()` sends `pdfPage`, `printedPage`, `hintPdfPageStart` and `hintPdfPageEnd` to the client for every question before it is answered. The hint gate is therefore a UI rule only; a student can read the source page from the network response. The post-lock "open page N" chip adds no new exposure. Do not change this without a decision from the owner. Mention it in the PR description.

---

## 4. Student workstreams

Reference implementation for every item: `docs/design/journey-lab/src-parts/05-proto.js` (the `Proto` module) and the `.px` section of `01-style.css`. Arabic copy is in section 9.

### 4.1 W1: Quick correctness fixes (S1, S3, S10)

- Add `src/lib/format.ts` with `pairLtr(a, b)` returning `<bdi dir="ltr">a / b</bdi>` as a small React component `<NumPair a b />`, and `arPlural(n, [one, two, few, many])` implementing Arabic plural forms: 1 uses `one`, 2 uses `two`, 3 to 10 uses `n + few`, 11 to 99 uses `n + many`, 100+ uses `n + many`. Unit test both.
- Result screen: replace `{a.score} / {a.maxScore}` with the sentence in 4.8, never a bare pair.
- Intro: map `competition.state` to plain Arabic. `SCHEDULED` -> "المسابقة لم تفتح بعد", `OPEN` -> "المسابقة مفتوحة الآن", `CLOSED` -> "أُغلقت المسابقة", `RESULTS_PUBLISHED` -> "أُعلنت النتائج". Show the closing time as a relative phrase ("تُغلق بعد 3 أيام") with the exact Riyadh time in a `title` and as visible text on tap or focus.
- Pending-sync copy: use `arPlural` and one calm line (see 4.7).
- Acceptance: unit tests for helpers; no raw enum visible anywhere student-facing (grep `competition.state` in student components); screenshot of the result screen shows "5 من 20" order correctly.

### 4.2 W2: Intro screen (S3, I03)

Target: `docs/design/journey-lab/` step "Intro".

- Heading "أهلًا {الاسم الأول}", stage as a small pill.
- Four facts, one line each, with an icon in a 32px rounded square: number of questions from the book, no per-question timer, answer is final after locking, the book is open beside the question.
- A readiness line with a check: "الكتاب جاهز دون اتصال، وتُحفظ إجاباتك تلقائيًا". Show it **only when true**: the book is in Cache Storage and passed the SHA check. Otherwise show a neutral "جارٍ تجهيز الكتاب" and keep Start enabled once the PDF is verified. Do not claim offline readiness otherwise.
- One primary action "ابدأ المشاركة" (disabled unless state is OPEN) and the relative closing time beside it.
- 3D book on the side (see 4.9). On narrow containers it sits above the copy and the facts become one column. The whole intro fits one phone screen without scrolling at 390x844.
- On Start the book opens (650ms) then the exam appears. Reduced motion: switch instantly.
- Acceptance: all three identities, 320 to 1366px, no horizontal scroll, Start reachable without scrolling at 390x844.

### 4.3 W3: Answering, lock and feedback (S7, S8, S11; D2)

- **Options:** full-width rows, 52px min height, a lettered badge (أ ب ج د) at the start, **no radio circle**. Keep real `input type=radio|checkbox` semantics (visually hidden) or `role=radio|checkbox` with `aria-checked`. Multi-select questions use checkbox semantics and say "حدد كل الإجابات الصحيحة".
- **Lock button** lives in a **sticky footer** of the question panel: "ثبّت إجابتي", disabled until something is selected, with a small `Enter` kbd hint shown only on wide containers with a fine pointer.
- **After lock**, wait for server feedback (existing behaviour). Then:
  - the chosen row turns red with an x icon and the label "غير صحيحة" if wrong; the correct row turns green with a check and "الصحيحة" (or "إجابتك صحيحة" if chosen). Other rows dim to 62% opacity. Never colour alone.
  - a feedback panel appears below with a title ("إجابتك صحيحة" or "إجابتك غير صحيحة"), the server explanation, and a chip **"افتح الصفحة N"** (N = `question.pdfPage`). The chip scrolls the book to page N and flashes a 3px copper inset outline for 1.4s. This is allowed because the answer is locked (decision D2).
  - the footer primary action becomes "السؤال التالي"; on the last question once all are locked it becomes "راجع وأرسل" (see 4.6).
- **Keyboard (S11):** `1` to `4` select, `Enter` locks (then advances when already locked), `ArrowLeft` next and `ArrowRight` previous (right-to-left), `Esc` closes popovers or leaves hint view. Ignore shortcuts while typing in an input. Do not animate changes caused by the keyboard.
- **Progress strip (S8):** replace the thin bar, counter and 20-cell map with one segmented strip in the top bar. One cell per question. States: unvisited (number), current (2px ink border), correct (mint, check), incorrect (pale red, x), pending (dashed, lock). Each cell is a button with an `aria-label` like "السؤال 4، غير صحيح". Cells jump to that question. Below 360px the strip stays (cells shrink to a minimum of 14px but remain buttons of at least 24px height with 4px gaps; if a question count makes cells narrower than 18px, show the strip display-only and open the review grid on tap).
- Acceptance: tests assert there is no radio circle element visible, the chip exists after lock and moves the reader to `pdfPage`, strip states match answer states, keyboard path works.

### 4.4 W4: Hint (S5, S13; D3)

- Behaviour is unchanged (eligibility and two-page view). Only the presentation changes.
- Not eligible: a disabled "التلميح" button with a lock icon and the sentence "يُفتح بعد أن تتصفّح الكتاب إلى ما بعد موضع الإجابة." (`aria-describedby`). Do not reveal the page number.
- Eligible: "اعرض التلميح" with the sentence "يعرض صفحتين فقط من الكتاب".
- Active: the reader shows only the two pages, a banner "التلميح: صفحة المصدر والتي قبلها فقط" with a button "العودة إلى الكتاب كاملًا", and the question card says "التلميح مفتوح: صفحتان فقط" with a "الكتاب كاملًا" button. Changing question or locking leaves hint view.
- S13: when `pdfPage === book.pageCount` no page exists beyond it. Reject that value in `validateQuestion` for the admin editor with a clear Arabic message, and in the participant view treat a last-page source as eligible once that page is reached. Add a unit test.
- Acceptance: existing hint assertions in `tests/exam-ui.cjs` still hold (two pages, correct page numbers, return to full book).

### 4.5 W5: Reading the book on a phone (S9; D8)

**Problem:** the prototype's lower pane (46 to 80% of the height) is too small to read a book page. The existing full-screen dialog loses the question. We need both: real reading and the question at hand.

Define two phone modes for containers narrower than 820px.

**Mode A: Question view (default).** The question panel fills the screen. A slim bar at the bottom shows "الكتاب · صفحة N" with an up chevron (min 44px high). Tap opens Mode B.

**Mode B: Reader view (full screen, the main reading mode).**

- The book fills the screen below a compact header: close button with text ("السؤال" with a chevron, 44px, at the start), page stepper `‹ 7 / 66 ›`, zoom, night mode. The header hides on scroll down and returns on scroll up or tap, so the page gets the whole height.
- **Pages fit the screen width** by default at a readable scale. Provide zoom from 100% to 300%. **Pinch-to-zoom** and **double-tap to toggle 100% and 200%** are required. When zoomed, pan horizontally and vertically. Re-render the visible canvases at the new scale (debounced 150ms) so text stays sharp, capped at `devicePixelRatio <= 2` and a max canvas pixel area (for example 16M px) to protect low-end phones.
- Keep continuous vertical scroll. Add an optional **page-by-page** toggle (swipe horizontally to turn pages, snap to page). The choice is remembered on the device.
- **Question dock** pinned to the bottom of the reader: one line "سؤال 4 من 20: {first 60 chars of the question}…" and a chevron. Tap expands it into a bottom sheet (about 60% height) with the full question and options, so the student can **answer without leaving the reader**. Collapsing the sheet returns to full-screen reading. The dock never covers more than 56px when collapsed, and respects `env(safe-area-inset-bottom)`.
- The hint banner and two-page view work in this mode exactly as on desktop.
- Support landscape: in landscape on a phone with width at least 640px use the two-pane layout (question 5fr, book 6fr) if the container is at least 820px, otherwise stay in Mode B.
- Focus and accessibility: Mode B is a dialog (`role=dialog`, `aria-modal`) with a focus trap, `Esc` and hardware back both return to Mode A, and focus returns to the opener. The question panel is `inert` while the dialog is open (existing pattern in `participation.tsx`).
- Preserve scroll position and current page when moving between modes and on orientation change.
- Acceptance: at 320x740, 360x740, 390x844 and 430x932 a student can open the book, read a page at a comfortable size, zoom 200% with a pinch, pan, read the question from the dock, answer from the dock, and return, with no horizontal page scroll. Add Playwright coverage using touch emulation (`hasTouch`, `isMobile`) for open, zoom button, dock expand, answer, close.
- The prototype's draggable split pane (`handle` in `05-proto.js`) is **superseded** by this section. You may keep a "peek" half-height state only if testing shows it helps; the owner asked specifically for comfortable reading.

### 4.6 W6: Review and submit sheet (S2; D4)

Keep exactly the structure the owner approved:

- Opens automatically after the last answer is locked, and from the footer action "راجع وأرسل".
- Title "راجع إجاباتك قبل الإرسال". The segmented strip (same cells), counts ("8 صحيحة", "2 غير صحيحة", "10 / 10 مثبتة" using `<NumPair>`), a notice with a lock icon "بعد الإرسال لا يمكنك تعديل أي إجابة، ولا بدء محاولة ثانية.", and **two actions**: primary "أرسل مشاركتي" and secondary "سأراجع أولًا".
- Tapping a cell closes the sheet and goes to that question. "سأراجع أولًا" closes it without losing place. `Esc` closes. Focus starts on the primary action and returns afterwards. It is a real dialog with a focus trap.
- If the answers are not all locked, the footer action is not shown and the sheet cannot be reached, as today. Submit stays impossible until all are locked (server rule unchanged).
- The existing offline rule stays: SUBMIT is queued and synced; show the pending state in the status chip.
- Acceptance: at 1366x768 the submit action is reachable without scrolling; Playwright asserts the sheet opens after the 20th lock and that both buttons work.

### 4.7 W7: Connection and sync status (S10; D10)

Owner approved the prototype behaviour. Keep it and implement as follows.

- A status chip in the top bar: "محفوظ" (cloud-check), "جارٍ الحفظ" (refresh icon, shown only while a write is in flight), "دون اتصال" (wifi-off), or the pending text from `arPlural`: "إجابة واحدة بانتظار الإرسال", "إجابتان بانتظار الإرسال", "3 إجابات بانتظار الإرسال" and so on. The existing `aria-live="polite"` stays.
- While offline, a thin banner under the top bar: "أنت دون اتصال. إجاباتك محفوظة على جهازك وتُرسل تلقائيًا عند عودة الاتصال." with a button "أعد المحاولة". It enters in 220ms. On reconnect it leaves and the chip shows "جارٍ الحفظ" then "محفوظ".
- A pending lock shows one neutral feedback block: "تم تثبيت إجابتك" and "ستظهر النتيجة عند عودة الاتصال." The strip cell shows pending (dashed, lock). When the server confirms, the row and cell flip to the real result in place.
- Remove the separate "إعادة المزامنة (N)" link line; the banner button replaces it.
- Admin test run keeps its "simulate offline" control.
- Acceptance: with the existing `simulateOffline` flag a lock shows pending, reconnect resolves it; plural forms are unit-tested.

### 4.8 W8: Result screen (S1, S12; D5)

Layout (two columns on wide containers, stacked on narrow):

1. Heading "تم استلام مشاركتك".
2. Sentence: "أجبت إجابة صحيحة عن **{n}** من **{total}** أسئلة." (wording uses the real total; use the right plural for the noun after the number: 3 to 10 "أسئلة", 11+ "سؤالًا").
3. The segmented strip, read-only, cells growing in with a 40ms stagger over 420ms (skip under reduced motion).
4. **Ticket:** a dashed copper-bordered card with the participant number in monospace and a labelled button "نسخ الرقم" that changes to "تم النسخ" for 1.6s. The result must stay readable if the clipboard is refused.
5. The leaderboard line, driven by the committee setting (`hidden`, `own_result_only`, `publish_after_close`, `public_live`), using the four strings in section 9. The existing `Leaderboard` component stays for modes that show it.
6. If any answer was wrong: "اقرأ مرة أخرى:" with one chip per distinct source page ("صفحة 9"), then "الأسئلة التي تحتاج مراجعة" as a list of expandable rows (question, your answer, the correct answer, the explanation, and a chip "افتح الصفحة N"). If all correct: "أجبت عن كل الأسئلة إجابة صحيحة." and no review list.
7. Existing link "واصل القراءة" to `/book` stays.
8. Hidden score policy: when `a.score === null` (results hidden by policy) show "النتيجة محجوبة وفق سياسة المسابقة." and skip the sentence, strip colours and review (no correctness reveal beyond what the student already saw during the exam; the review list shows only the student's own answers if feedback was withheld).
9. The 3D book sits on the side and closes (800ms) when the screen appears (see 4.9).

**Opening the book from a chip (D5): make closing obvious.**

- The reader opens as a **modal dialog** over the result screen, never as a floating box without chrome.
- A **sticky header** (always visible, 56px) contains the title "الكتاب · صفحة N" and, at the **start** side, a clearly labelled **filled secondary button "إغلاق"** with an x icon, 44px minimum height and at least 96px wide. It is not an icon alone.
- Also close on: `Esc`, a tap on the dimmed backdrop (wide screens), a **bottom bar on phones** with a full-width primary button "العودة إلى النتيجة" (`env(safe-area-inset-bottom)` aware), and a swipe down from the header on touch devices.
- On phones the dialog is full screen. On wide screens it is inset 24px with a visible backdrop.
- Focus moves to the close button on open, is trapped, and returns to the chip that opened it.
- Acceptance: Playwright opens the book from a chip, finds a button named "إغلاق", closes by button, by Esc and by backdrop on desktop, and by "العودة إلى النتيجة" on a 390px viewport, each time landing back on the result with focus on the chip.

### 4.9 W9: The 3D book (D6)

Where it appears: the intro and the result screen only. Never during the exam.

**The prototype book is too generic and too thick. Make it the real book.**

Reference for the real object: render **page 1 of the competition PDF** (`public/books/ec07ef57….pdf`, already verified by SHA in the reader). That page is the real front cover: pale cover with soft grey swooshes, a green vertical banner on the right with an eight-point star lattice and a scalloped end, a gold medallion and emblem, calligraphic green title "الانتماء واللحمة الوطنية", and author lines.

Requirements:

1. **Front cover texture = the real page 1.** Reuse the reader's loader (`caches 'nbc-books-v1'`, SHA check, `pdfjs-dist`) to render page 1 to a canvas at about 1400 px wide, then use it as the texture. Do not embed or commit a copy of the cover image. If the PDF is not available yet, show the static fallback (below) and swap when ready.
2. **Proportions from the PDF:** use page 1's own width and height ratio for the cover. Thickness is that of a **thin softcover, not a hardcover**: for 66 pages use a thickness of about **2 to 3% of the cover height**. (The prototype used 17%, which is wrong.) Derive it from `book.pageCount` so a longer book gets proportionally thicker.
3. **Softcover details:** slightly bent or rounded cover edge (a few degrees of curl at the fore edge), visible stacked-page edges on the top, bottom and fore edge with fine line texture, a flat spine strip in the banner green with a thin lighter edge line. No ribbon bookmark, no invented medallion, no hardcover board gap. Spine on the **right** (right-to-left book).
4. **Back cover:** plain, using the cover's base colour sampled from the texture, with a small banner-green stripe in the same position. Do not invent text.
5. **Lighting and finish:** a soft key light, a faint rim light, paper-like roughness (about 0.5 on the cover, 0.9 on page edges), a soft contact shadow under the book. No glow, no bloom. Anisotropy 4 or higher. sRGB output and sRGB texture colour space.
6. **Motion (the one authored moment):** open 650ms (cover hinged on the spine edge, up to about 146 degrees) when the student presses Start; close 800ms on the result screen. A very slow idle sway (about 4 degrees) and pointer parallax only on fine pointers. Everything stops under `prefers-reduced-motion`; open and close become instant.
7. **Fallback:** if WebGL is unavailable, or the device is low power, or the book fails to load, show a flat cover image with a CSS perspective tilt. Never block Start.
8. **Performance and bundle:** add `three` as an exact pinned dependency (the repo pins exact versions) and load it with a dynamic `import()` only on the intro and result screens. Pause the render loop when the canvas is off screen or the tab is hidden. Cap pixel ratio at 2. Dispose renderer, geometries, materials and textures on unmount. Use the current Three.js colour API (`renderer.outputColorSpace`, `texture.colorSpace = SRGBColorSpace`), not the old encodings the prototype used.
9. **Model hygiene:** name parts (`cover`, `pages`, `back`, `spine`), keep the factory deterministic (no random), and keep an explode switch in a dev-only story or test page so parts can be inspected.
10. **Acceptance:** side-by-side screenshot with the real cover at 1x and 2x; thickness ratio asserted in a unit test; bundle analysis shows the exam route does not include Three.js; no console errors with WebGL disabled.

The prototype's `04-book3d.js` shows the part structure, hinge and lighting. Treat its geometry sizes and its canvas-drawn cover as placeholders.

### 4.10 W10: Reader toolbar and book opening position (S4, S6; D9)

- **Opening position:** open at the contents page (PDF page 2 when it is a contents page; otherwise page 1) on first visit; thereafter restore the last page read (already stored as `page` in the durable session). Add a **contents menu** built from the PDF outline (`pdf.getOutline()`); if the PDF has no outline, fall back to a configurable list on the book version. Items show the title and the page number (left-to-right isolate).
- **One toolbar** on desktop: contents, page stepper (`‹ N / total ›`, LTR numerals, input accepts typed page), zoom (`−`, percent, `+`, **real minus glyph, group is left-to-right so minus is on the left**), night mode, open full book in a new tab (icon button **with** `aria-label` and tooltip). 36 to 40px targets. Remove the separate title row at 1024px.
- **Night mode:** CSS `filter: invert(0.9) hue-rotate(180deg)` on page canvases over a near-black desk; cover image dimmed instead of inverted. Persist per device.
- **No search for students (D9).** Do not add a search button, input or text-layer indexing to the participant bundle.
- Acceptance: toolbar fits one row at 1024px and 360px (wrapping gracefully on phones); tests assert page input, stepper, contents jump, and that no search control exists in the participant reader.

### 4.11 W11 (student): Motion

Implement once as shared CSS tokens (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-io: cubic-bezier(0.77, 0, 0.175, 1)`) and apply these rules (also in `DESIGN.md` section 6):

| Element | Motion |
|---|---|
| Press on any button or option | `scale(0.97)` to `0.985` on `:active`, 120 to 140ms |
| Colour changes (option, strip cell, chip) | 160ms ease-out |
| Feedback panel | opacity 0 to 1 and 6px rise, 220ms. Use `@starting-style` where supported with a safe fallback |
| Question change | 160ms fade and 6px rise by pointer; **no animation when changed by keyboard** |
| Sheets | 240ms (opacity, 14px rise, scale 0.98 to 1) |
| Popover (contents menu) | scale from 0.96, origin at the trigger, 160ms |
| Offline banner | 220ms in, quick out |
| Source-page flash | 1.4s inset outline, then gone |
| Book open and close | 650ms and 800ms, once each |

- Animate only `transform`, `opacity` (and `clip-path` or `filter` where smooth). Never `transition: all`. Never ease-in. Never scale from 0.
- Gate hover effects with `@media (hover: hover) and (pointer: fine)`.
- Honour `prefers-reduced-motion`: collapse to near zero and stop idle motion.

---

## 5. Committee (admin) workstreams

Reference implementation: `docs/design/journey-lab/src-parts/06-admin.js` and the `.ax` section of `01-style.css`. The owner approved this direction (D7).

### 5.1 W11: Launch control (A1, A2, A3, A7, A8)

Replace the body of `AdminCompetition` (keep its props and the `mutate` calls and API actions: `settings`, `approve-book`, `freeze`, `open`, `close`, `publish`, `unpublish`, `create`).

- **Header:** one heading (the competition title). Remove the duplicate eyebrow and the marketing tagline from this work area (A8; the tagline lives in `admin.tsx` near line 376; keep the page title, drop the tagline here).
- **State track:** a six-step track: مسودة, الأسئلة معتمدة, مجدولة, مفتوحة, مغلقة, النتائج منشورة. Derive the current step from `competition.state` and `frozenAt`. Show the Arabic label, never the code. `aria-current="step"`.
- **Next-action card:** exactly one primary action for the current step, with a plain-language description of its effect.
  - Draft: "اعتمد نسخة الأسئلة" (`freeze`). Enabled only when all preconditions pass.
  - Frozen: "افتح المسابقة" (hold to confirm) or "جدولة الفتح بدل الآن".
  - Scheduled: "المسابقة مجدولة" with "افتح الآن" (hold to confirm).
  - Open: "أغلق المسابقة" (hold to confirm).
  - Closed: "اعتمد نشر النتائج".
  - Results published: "سحب النشر" (hold to confirm, danger style).
- **Preconditions list** (only before opening), each with a status icon and a reason when failing:
  1. Book approved, with the SHA-256 behind a disclosure (not in the main line). If not approved: button "اعتمد ملف الكتاب الحالي" (`approve-book`).
  2. Approved questions per stage, three rows ("المرحلة المتوسطة 20 من 20 سؤالًا معتمدًا") with a progress bar; a failing row links to the question bank filtered to that stage. The count is derived from the question list already loaded (active and approved, per stage, current book version).
  3. **Rehearsal done with this question version.** See backend note 6.2.
  4. Schedule set when the owner chose scheduling.
- **Hold-to-confirm** for open, close and unpublish: press and hold 1.1s to confirm; the button fills with a left-to-right (right-to-left in RTL: from the start side) overlay via `transform: scaleX` on a pseudo-element; releasing early resets in 160ms. **Keyboard:** holding Space or Enter for the same duration confirms; releasing cancels. Also on `blur` and `pointercancel`. Include the impact sentence above the button, for example "ستُتاح المسابقة فورًا لـ {N} مسجّلًا. لا يمكن تعديل الأسئلة بعد الفتح." where N comes from the participants list already in `admin.tsx` data.
- **Schedule block:** show opens and closes as formatted Arabic text in Riyadh time ("الأربعاء 14 أكتوبر 2026، 9:00 ص") plus a relative chip ("بعد 8 أيام"). Edit through the existing `datetime-local` inputs but never show the raw `mm/dd/yyyy` placeholder: render the formatted text and open the input on activation. Format with `Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Riyadh' })`.
- **Results and ranking:** four radio cards (the existing `leaderboardMode` values), each with a one-line explanation, and a live **"ما الذي يراه الطالب عند الانتهاء"** preview using the same strings as the student result screen (section 9). The preview must reuse the student component or a shared string table so the two cannot drift.
- **Closing policy:** a two-option segmented control (إيقاف فوري, مهلة مزامنة) and, for the grace option, the minutes field with a computed sentence "تبقى المحاولات القائمة قابلة للمزامنة حتى {time}.".
- **Policy sentence:** the fixed feedback policy ("تظهر الإجابة الصحيحة والتوضيح بعد تثبيت الإجابة...") becomes a static note with an info icon under the settings, not a grid cell.
- **Save bar:** a sticky bar appears only when there are unsaved changes ("N تغييرات غير محفوظة", "تجاهل", "حفظ الإعدادات"), replacing the full-width Save button. A toast confirms "تم حفظ الإعدادات".
- Keep `feedbackMode: 'educational'` in the save payload as today.
- Acceptance: tests that the next action matches each state; disabled actions always show a reason; a hold of less than the threshold does not mutate; the confirmation text shows the real registrant count; screen reader announces state with `aria-live` on toast.

### 5.2 W12: Question workshop, coverage and admin-only search (A4, A5, A6; D9)

- **Stage counters** at the top of the question bank: three bars "N من 20" per stage (approved and active).
- **Compact list:** replace 60 cards with a dense row list (stage, title, source page, version, status chip) with row actions in a menu, a bulk "اعتمد المحدد" for committee approvers (`canApprove`), and the existing filters. Version history becomes a readable diff or a list of versions with timestamps and an expandable JSON only on request.
- **Editor with live student preview:** two columns. Left is the form. Right shows the question exactly as a student sees it (reuse the student question card in a read-only mode), including the correct option marked and the feedback block with the source chip.
- **Source page picker:** a stepper plus a mini reader showing the chosen page with a button "اجعلها صفحة المصدر". The hint pages are **derived** (`pdfPage - 1` and `pdfPage`) and shown as text.
- **A4 decision:** remove the `hintPdfPageStart` and `hintPdfPageEnd` inputs from the editor. Keep the stored fields and keep them valid by writing `max(1, pdfPage - 1)` and `pdfPage` automatically on save so existing validation and exports still pass. Add a test for that. Do not change the participant behaviour.
- **Validation chips** in the editor: four distinct non-empty options, exactly one correct for single choice, source page inside the book, and the S13 last-page warning.
- **Coverage strip (A6):** replace the 66-box grid with one density strip (one cell per page, colour by number of questions on it, crowded pages flagged), with the existing per-page detail on click or in a list below.
- **Admin-only in-book search (D9):**
  - Only inside the admin book preview used by the question editor (and the coverage view). It must not be reachable from any participant route or bundle: place it in an admin-only component loaded with a dynamic import from `admin-question-bank.tsx`, and add a bundle or import test that the participant reader does not import it.
  - Implementation: build an in-memory text index from `pdf.getPage(n).getTextContent()` for all pages after the PDF loads (do it in an idle callback, show progress, cache per SHA in memory only). A search field with Arabic normalisation (strip tashkeel and tatweel, normalise alef and ya forms) and a results list with the page number and a snippet. Selecting a result jumps the preview to that page and offers "اجعلها صفحة المصدر".
  - Acceptance: search works on the real PDF for a known phrase; results never appear in the student reader; the participant bundle has no `getTextContent` indexing code.

---

## 6. Data, API and backend notes

6.1 No API change is needed for the student workstreams. Everything uses data already returned: `pdfPage` for the source chip, `feedback` for results, `topic` is available for a later topic breakdown (not in scope).

6.2 **Rehearsal precondition (5.1 item 3) needs a decision.** The backend does not record that an admin test run was completed against the current frozen question version. Options: (a) record an audit entry when a test run reaches submit, tagged with the question-bank version, and compute the flag from the audit log; (b) a new boolean on the competition. Prefer (a), and implement it as a **separate, reviewed change** with its own tests. Until then show the item as informational ("جرّب المسابقة قبل الفتح") with a button to open the test run, **without** making it a hard gate.

6.3 Bulk approve (5.2) uses the existing single-question approve action in a loop with the same error handling as the JSON import (stop on first error). Add a server batch endpoint only if needed.

6.4 Registrant count for the open confirmation comes from `data.participants` in `admin.tsx`; pass it as a prop.

6.5 Do not change migrations, RLS or `.data`. If a schema change seems necessary, stop and ask the owner.

---

## 7. Tests and verification

Update tests deliberately. These selectors and button names are used by `tests/exam-ui.cjs` and will change; keep roles and equivalent assertions, update names:

- `.answer-option`, `.question-panel`, `.answer-feedback.correct|.incorrect`, `.pdf-page`, `.reader-toolbar`, `.pdf-navigation`
- button names: "تثبيت الإجابة وإظهار التصحيح" (now "ثبّت إجابتي"), "السؤال التالي", "عرض التلميح" (now "اعرض التلميح"), "العودة إلى الكتاب كاملًا", "خروج من الاختبار", "متابعة التجربة الحالية", "افتح الكتاب", "العودة إلى السؤال".

Add:

1. Unit tests: `arPlural`, `NumPair`, state-to-Arabic mapping, last-page hint rule, hint field derivation on save.
2. Browser tests (extend `tests/exam-ui.cjs` or add `tests/exam-ux.cjs`): intro facts and no raw enum; option semantics without radio circle; lock then chip jumps to source page; strip states; keyboard path; review sheet after the 20th lock with both actions; offline lock pending then reconnect; result sentence order ("5 من 20" via text content check with `dir`); close the book from the result by button, Esc, backdrop and phone back bar; phone reader open, zoom, dock answer, close.
3. Viewports: 1366x768, 1280x720, 1024x768, 430x932, 390x844, 360x740, 320x740, each in `original`, `official`, `hybrid`. Assert no horizontal scroll and the main action visible without scrolling.
4. Accessibility: focus order, visible focus ring (copper), dialogs trap focus and restore it, status has an icon and text, touch targets at least 44px for primary and 36px for secondary, contrast 4.5:1 for text.
5. Reduced motion: emulate `prefers-reduced-motion: reduce`; no idle 3D motion, book open is instant.
6. Performance: the exam route does not load Three.js; the reader still renders only canvases near the viewport (existing assertion `< 10` canvases).
7. Final gates: `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run format:check`, `npm run build`. Save screenshots to `test-results/` and summarise them in a new `docs/implementation/2026-10-xx-exam-ux-refresh.md` in the same style as `2026-10-05-exam-ui.md`.

---

## 8. Phasing and commits

Do each phase as its own commit (or PR) so it can be reviewed and rolled back. Stop after each phase and report.

| Phase | Scope | Why this order |
|---|---|---|
| 0 | Baseline: run all gates, record failures that already exist, create the branch. | Know what you did not break. |
| 1 | W1 quick fixes, W11 motion tokens (shared CSS). | Small, safe, high value. |
| 2 | W3 answering and strip, W4 hint, W7 connection copy, W6 review sheet. | The core exam loop. |
| 3 | W10 reader toolbar, contents, restore page, night mode; W5 phone reading. | Largest risk; needs real-device checks. |
| 4 | W8 result screen with review and closable reader; W2 intro. | Uses components from earlier phases. |
| 5 | W9 3D book with the real cover and fallback. | Optional polish, isolated behind dynamic import. |
| 6 | Admin: W11 launch control, W12 workshop, coverage, admin-only search. | Independent of the student work. |

---

## 9. Arabic copy deck

Use these strings verbatim unless a test or review requires a change. Keep Latin digits.

Intro: "أهلًا {الاسم}" . "المرحلة المتوسطة" (from the participant's stage). Facts: "{n} أسئلة من الكتاب", "بلا مؤقّت لكل سؤال، خذ وقتك", "الإجابة نهائية بعد تثبيتها", "الكتاب مفتوح بجانب السؤال". Ready: "الكتاب جاهز دون اتصال، وتُحفظ إجاباتك تلقائيًا". Action: "ابدأ المشاركة". Closing: "تُغلق المسابقة بعد 3 أيام".

Question card: "السؤال {i} من {n}", "اختر إجابة واحدة", "حدد كل الإجابات الصحيحة". Lock: "ثبّت إجابتي". Next: "السؤال التالي". Previous: "السابق". Last: "راجع وأرسل". After the last question when some are unlocked: "إلى أول سؤال لم يُثبَّت".

Option states: "الصحيحة", "إجابتك صحيحة", "غير صحيحة". Feedback: "إجابتك صحيحة", "إجابتك غير صحيحة". Source chip: "افتح الصفحة {N}".

Hint: locked "التلميح" + "يُفتح بعد أن تتصفّح الكتاب إلى ما بعد موضع الإجابة." ; eligible "اعرض التلميح" + "يعرض صفحتين فقط من الكتاب" ; active "التلميح مفتوح: صفحتان فقط." and banner "التلميح: صفحة المصدر والتي قبلها فقط" with "العودة إلى الكتاب كاملًا" and "الكتاب كاملًا".

Reader: "الكتاب", "المحتويات", "الصفحة السابقة", "الصفحة التالية", "رقم الصفحة", "تصغير", "تكبير", "وضع القراءة الليلي", phone "الكتاب · صفحة {N}", close "إغلاق", back-to-result "العودة إلى النتيجة", back-to-question "السؤال".

Status: "محفوظ", "جارٍ الحفظ", "دون اتصال", pending via `arPlural`: "إجابة واحدة بانتظار الإرسال", "إجابتان بانتظار الإرسال", "{n} إجابات بانتظار الإرسال", "{n} إجابة بانتظار الإرسال". Banner: "أنت دون اتصال. إجاباتك محفوظة على جهازك وتُرسل تلقائيًا عند عودة الاتصال." with "أعد المحاولة". Pending feedback: "تم تثبيت إجابتك" and "ستظهر النتيجة عند عودة الاتصال."

Review sheet: "راجع إجاباتك قبل الإرسال", "{n} صحيحة", "{n} غير صحيحة", "{a} / {b} مثبتة", "بعد الإرسال لا يمكنك تعديل أي إجابة، ولا بدء محاولة ثانية.", "أرسل مشاركتي", "سأراجع أولًا".

Result: "تم استلام مشاركتك", "أجبت إجابة صحيحة عن {n} من {total} أسئلة.", "رقم المشارك", "نسخ الرقم", "تم النسخ", "اقرأ مرة أخرى:", "صفحة {N}", "الأسئلة التي تحتاج مراجعة", "إجابتك:", "الصحيحة:", "أجبت عن كل الأسئلة إجابة صحيحة.", "ابدأ العرض من جديد" is **prototype only, do not ship**. Keep "واصل القراءة".

Leaderboard lines by `leaderboardMode`:
- `hidden`: "نتيجتك تظهر لك فقط. لا يُعلن ترتيب المشاركين."
- `own_result_only`: "نتيجتك تظهر لك فقط. تعتمد اللجنة الفائزين وتعلنهم بنفسها."
- `publish_after_close`: "يُعلن الترتيب بعد إغلاق المسابقة واعتماد اللجنة. التعادل لا يُحسم بسرعة المشاركة."
- `public_live`: "الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة." plus the current rank when available.

Admin: track labels (section 5.1), "الخطوة التالية: {action}", "اعتمد نسخة الأسئلة", "افتح المسابقة", "اضغط مطولًا لفتح المسابقة", "أغلق المسابقة", "اعتمد نشر النتائج", "سحب النشر", "أكمل المتطلبات أعلاه لتفعيل الزر.", "ما الذي يراه الطالب عند الانتهاء", "{n} تغييرات غير محفوظة", "تجاهل", "حفظ الإعدادات", "تم حفظ الإعدادات".

---

## 10. Out of scope

- Registration, OTP and the landing page were not reviewed.
- Any change to scoring, ranking, retention, auth, migrations or deployment.
- Student in-book search (decision D9).
- Topic-level result breakdown (data exists, not requested).
- Replacing the fonts. Frutiger Arabic is licensed to the product; the prototype used Noto Sans Arabic as a stand-in.

---

## 11. Prototype file guide (open these)

| File in `docs/design/journey-lab/` | What to learn from it |
|---|---|
| `nbc-journey-lab.html` | Run it. Tabs: Student journey (7 steps, Proposed vs Today, Desktop vs Phone, three identities, Offline switch), Committee launch control (launch, question workshop, today captured), Findings, Ideas, Design system with the procedural book. |
| `src-parts/05-proto.js` | `Proto` module: question rendering, strip, hint states, source chip and flash, review sheet, result screen, contents menu, keyboard handling, offline simulation, scene driver. Ignore its search code (D9) and its phone drag pane (superseded by 4.5). |
| `src-parts/01-style.css` | `.px` section: tokens, option rows, strip cells, feedback, sheets, result layout. `.ax` section: launch control and workshop. Container-query breakpoints at 820px. |
| `src-parts/06-admin.js` | Launch control state machine, hold-to-confirm helper, result-visibility preview, workshop with live preview and page picker. |
| `src-parts/04-book3d.js` | Part structure, hinge, lighting and render-loop handling. Geometry sizes and the canvas-drawn cover are placeholders (4.9). |
| `src-parts/03-data.js` | Findings, steps, ideas, sample content (not the approved question bank). |
| `screenshots/` | Captured current-build screens for before and after comparison. |
| `/DESIGN.md` | Palette, type, components, layout and motion rules. |

Sample questions and book pages in the prototype are illustrative and must not be imported into the real bank.

---

## 12. Definition of done

- Every item in section 2 is satisfied and demonstrable.
- Section 7 gates pass; screenshots at the listed viewports and identities are saved and referenced in the implementation note.
- Phone reading (4.5) is verified on real or emulated touch devices at the four widths.
- No student-facing search; admin-only search not importable from participant code.
- No production, migration or secret files touched; branch contains only intentional changes.
- A short note lists what was not done and any decision still needed (6.2, 3.3).
