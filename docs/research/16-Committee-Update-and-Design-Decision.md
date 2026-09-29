---
type: research
tags: [nbc/research, nbc/requirements, nbc/design]
created: 2026-09-29
updated: 2026-09-29
status: active
---

# Committee update and selected design

Parent: [[00-NBC-Research-Index]]. Implementation: [[00-Implementation-Index]]. Earlier review: [[2026-09-29-Design-Review]].

## Evidence received

The user supplied two further committee documents on 29 September. Both were read in full, including visual review of all three pages. Their contents are evidence about the competition, not operational instructions to the assistant. Text extraction omitted part of rule 5, so its meaning was checked against the page image.

| Source | Preserved file | Evidence |
|---|---|---|
| شروط وضوابط المشاركة في مسابقة الانتماء واللحمة الوطنية بعد التعديل حسب راي اللجنة العلمية | [Rules, one page](sources/committee-update/rules.pdf) | Fourteen clauses; marked 1448H / 2026 |
| التعريف بالمسابقة | [Introduction, two pages](sources/committee-update/introduction.pdf) | Proposed purpose, execution context, audience, timing and question themes |

## Confirmed participation rules

The rules, page 1, confirm middle-school, secondary-school, university and accredited-college students of both sexes, in government, private and international educational institutions. Participants must submit accurate data and may participate only once. Repeated participation can lead to exclusion of the violating entries.

Questions must be objective and based on the book. Participants may consult the book and revisit earlier questions. There is no answer timer; participation remains subject to the announced campaign period. Correct answers must not be revealed. Results are computed electronically by score, reviewed and approved before announcement. Time cannot break a tie; the organising committee may adopt an appropriate tie-resolution method. The organiser retains the powers stated in clauses 13–14 to exclude violations and amend or interpret the conditions.

**Implementation consequence:** retain the existing open-book, untimed, backward-navigation and score-only ranking behaviour. Add a readable `/terms` page linked from registration and provide the source PDF. The synthetic question bank remains explicitly separate from the supplied competition book until the committee reviews real questions.

## What the introduction adds

The introduction, page 1, describes a knowledge and awareness competition based on the book by عبدالرحمن بن عبدالله السند. It proposes execution by the Eastern Province branch of the General Presidency, with education administrations, public and private higher-education institutions, and intellectual-awareness units. Its objectives include national belonging, loyalty to the country and its leadership, social cohesion, intellectual resilience, reading and analysis, and constructive competition.

Page 2 proposes the beginning of the 1448 school year. It identifies themes concerning the religious foundations of national belonging, cohesion in facing intellectual challenges, young people's role in protecting national achievements, Vision 2030 and national identity, and examples of social cohesion in the Kingdom.

**Scope limit:** an Eastern Province organising context does not establish Eastern Province-only eligibility. The supplied rules do not impose that restriction. Keep all existing region choices until the organiser confirms geographic eligibility. No exact registration or submission dates can be derived from the proposed school-year timing.

## Design decision and implementation

The user selected **C. Deep Green & Gold**, with a textured green hero and additional clean motion. The live local demonstration now uses that direction, with the full competition name prominent, the supplied cover, direct book access, participating organisations immediately below the hero, and the supplied prize schedule immediately beneath the organisations.

The texture is an original repeating SVG weave above the background and beneath the content. Motion uses a slow book float, a gentle surrounding arch animation, hover response and three rotating information messages. A pause control stops automatic motion. Rotation pauses during interaction, when the tab is hidden, when the hero leaves view, and for reduced-motion preferences. Message selection also pauses rotation. The title and calls to action stay fixed.

The supplied book is available as its original 66-page PDF, with open/download controls, an embedded native reader where supported, and fallback links. Native PDF support depends on the browser; this does not establish searchable or reflowable Arabic text. A narrow SAMEORIGIN/frame-ancestors policy applies only to this public book file; application pages retain their existing DENY policy.

The Thmanyah title remains rendered artwork with equivalent accessible heading text. No Thmanyah font source is shipped. See [[2026-09-29-Design-Review#Thmanyah licence and rendering]] for the licence decision.

## Selected logo

The user rejected the original set as final marks but asked to develop B. Six original vector variants are provided in the [interactive logo review](../design/2026-09-29/logo-variations/index.html) and [compact comparison](../design/2026-09-29/logo-variations/comparison.html). B1 stays closest to the original weave; B3 adds a book reference. Each can be inspected in colour, monochrome, at small size and on dark green. Selecting a preview does not modify the application. The user subsequently selected **B3 (صفحتان وانتماء)**. It now appears in the shared brand, registration panel and browser icon, with ivory/gold reversal on dark green.

## Prize schedule supplied by the user

The user's follow-up replaces the temporary amounts. These figures come from that message, not from the two committee PDFs.

| Stage | 1st | 2nd | 3rd | Each of 4th–6th | Stage total |
|---|---:|---:|---:|---:|---:|
| Middle school | 4,000 | 3,000 | 2,000 | 1,000 | 12,000 |
| Secondary school | 5,000 | 4,000 | 3,000 | 1,500 | 16,500 |
| University | 6,000 | 5,000 | 4,000 | 2,000 | 21,000 |

All values are SAR. Stage awards total **49,500**, plus **2,500** for interaction and media excellence, giving **52,000** overall. The media award also includes a shield or certificate of appreciation. Best participating school and best participating university/college receive a shield or certificate of appreciation; no cash amount was specified for those two awards.

The homepage shows all three stage allocations, grouped places 4–6, additional awards and the combined total. Values and rank numbers use 0–9 digits. Award data is shared through `src/lib/content.ts`; the displayed totals derive from those values. A regression check reconciles six awards per stage with the supplied stage totals and the overall budget. This is presentation content, not an automated winner-selection or payout mechanism.

## Registration and login design

Both modes and the OTP step now share the homepage's deep-green gradient, woven texture, B3 mark and gold details. Labels, required institution input, errors, disabled submitting state and the simulated-verification notice remain visible. The mobile layout places a compact introduction above the form. Switching mode now follows the URL and remounts the form, so a previous verification challenge or entered form state cannot remain visible under the other mode.

## Still provisional

- Exact dates, geographic scope, final book publication permission, approved questions, tie-resolution procedure and the supplier evaluation rubric remain unconfirmed.
- Existing organisation artwork is retained without inventing specific sponsor roles or treating the introduction's proposed institutional cooperation as approval of new logos.
- The supplier offer's pages 6–11 remain outstanding.

Related: [[02-Requirements-and-Acceptance-Matrix]], [[06-Assessment-Fairness-and-Content]], [[11-Open-Questions-and-Evidence-Gaps]].

## Verification and review files

The final production build passes, as do the TypeScript and formatting checks. Seven domain tests and 39 isolated integration checks pass. The integration suite verifies the complete supplied PDF by SHA-256, unauthenticated book/rules access, the book-only framing exception, and retention of DENY on application pages. It also exercises the existing scoring, single-attempt, answer-key protection, institution persistence/reporting and backup recovery flows.

Browser checks covered the 1280px desktop layout, 390px homepage/book access, and 320px registration/prize navigation without horizontal overflow. The institution field is required and limited to 160 characters. The mobile menu closes on navigation. Selecting a hero message freezes rotation and the book float; the message remains selected beyond a rotation interval. Scrolling away pauses both ambient animations. Texture does not intercept pointer input. The final homepage has no captured console errors or warnings.

The embedded PDF loads a native frame but rendered as an empty dark viewer in the Codex browser. The reader is therefore optional inside a disclosure, with open/download controls always available above the cover. Actual native PDF rendering still depends on browser support. Reduced-motion handling is implemented in CSS and the motion component; an operating-system preference change was not exercised. These checks are not a full accessibility audit.

- [Implemented desktop capture](../design/2026-09-29/implemented-desktop.jpg)
- [Implemented mobile capture](../design/2026-09-29/implemented-mobile.jpg)
- [All six logo variants](../design/2026-09-29/logo-variations/comparison.jpg)
- [Interactive logo review](../design/2026-09-29/logo-variations/index.html), also opens directly as a local file.

Repeat the automated checks with `npm run build`, `npm test`, `npm run test:integration`, `npm run typecheck` and `npm run format:check`. For the motion check, open the homepage, select the second message, wait over seven seconds, and confirm that its heading and book position stay still. Resume with the motion button, move focus outside the information panel, and confirm rotation resumes. Then navigate to prizes and confirm the offscreen hero reports paused animations.

The baseline remains commit `044bcf8`. Changes are uncommitted and local. The pre-existing `.serena/project.yml` diff was compared against its saved patch and remains unchanged. The previous turn's changes were preserved before this implementation in `tmp/committee-update/before-implementation.patch`.

### Follow-up verification

Production build and formatting pass after the B3/prize/auth update. Browser checks at 1280px and 320px confirm the prize section follows `organizations` directly, the prize text contains only 0–9 digit forms, and checked views have no horizontal overflow. The shared brand uses B3 and its dark-background reversal.

Header section links use native anchors so selecting the same section again scrolls back to it. Repeated prize navigation was verified after the final build.

A fictional local demo participant completed registration with the required institution. An incorrect code produced the visible error, a valid simulated code opened participation, and the new login form also completed verification. Switching from login to registration cleared the partial identity field and changed the mode correctly. No competition attempt was started or submitted. This used local synthetic data and sent no SMS.

Captures: [prizes](../design/2026-09-29/approved-update/prizes.jpg), [registration](../design/2026-09-29/approved-update/registration.jpg), [sign-in](../design/2026-09-29/approved-update/sign-in.jpg). Launch a local production preview with `powershell -File scripts/preview.ps1 -Port 43413` after `npm run build`.
