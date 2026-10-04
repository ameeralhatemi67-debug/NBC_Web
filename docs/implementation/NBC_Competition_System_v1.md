# NBC Web — Book-Based Competition System v1

**Project:** `ameeralhatemi67-debug/NBC_Web`<br>
**Purpose:** Expand the existing Arabic RTL competition platform into a production-ready, book-based competition experience using *الانتماء واللحمة الوطنية* as the approved source material.

---

## 1. Executive Summary

The current NBC Web project already contains a strong foundation:

- Participant registration and OTP authentication
- Three education stages:
  - المرحلة المتوسطة
  - المرحلة الثانوية
  - المرحلة الجامعية
- One-attempt behavior
- PostgreSQL/PGlite database layer and migrations
- Server-side scoring
- Question versioning and approval workflow
- Admin question editing
- Saved participant answers
- Admin result views and CSV export
- Audit logging
- Book access
- A one-question-at-a-time participation interface
- Progress UI and question navigation
- A split question/book layout concept
- Production-focused security work

The new feature should **extend this existing architecture instead of replacing it**.

The target is a real book-reading competition where each participant receives **20 questions appropriate to their registered stage**, can read the official book during the attempt, receives page-based guidance, and can participate only once in each competition campaign.

The full question bank contains **60 questions total**:

- 20 for middle school
- 20 for high school
- 20 for university

Each question must be connected to the exact source page(s) in the book.

---

# 2. Core Product Goal

The competition should reward participants for **reading and understanding the book**, not merely guessing answers.

The experience should therefore combine:

1. The official book
2. Stage-specific questions
3. Page-linked source references
4. Hints that encourage reading rather than directly giving the answer
5. Clear progress and navigation
6. Reliable answer persistence
7. A strict one-attempt rule
8. Server-side scoring
9. Admin-controlled competition opening/closing
10. Auditable recovery tools for technical failures
11. A safe admin-only test-run mode

---

# 3. Important Book/Page Requirement

The uploaded/approved PDF has **66 digital PDF pages**, while the catalog information describes the book itself as **62 pages**.

This means the system must distinguish between:

- `pdf_page`
- `printed_page`

Example:

```text
PDF page:     29
Printed page: 27
```

Admins should be able to configure both.

Participants should normally see the **printed page number**, while the PDF renderer uses the actual digital PDF page internally.

This avoids incorrect question-to-page references caused by covers, front matter, or PDF pagination offsets.

The system should also store a stable identifier/checksum/version for the approved book so replacing the PDF cannot silently break question references.

---

# 4. Competition Model

Introduce a first-class competition/campaign model.

Do **not** make the one-attempt rule mean "one attempt for the lifetime of the account."

Instead:

```text
UNIQUE(participant_id, competition_id)
```

This means:

> A participant can attempt a specific competition only once.

But the same participant may participate in a future edition/campaign.

Example future campaigns:

```text
NBC 1448 / 2026
NBC 1449 / 2027
NBC 1450 / 2028
```

---

# 5. Competition Lifecycle

Use a state model similar to:

```text
DRAFT
  ↓
SCHEDULED
  ↓
OPEN
  ↓
CLOSED
  ↓
RESULTS_PUBLISHED
```

Admin capabilities should include:

- Create/configure the competition
- Set opening date/time
- Set closing date/time
- Open immediately
- Close immediately
- Publish/unpublish leaderboard/results
- Freeze the competition question set before launch
- Preview/test the competition before opening

The **server**, not only the UI, must enforce the competition state.

Calling an API manually must not allow a participant to start or modify an attempt outside the permitted competition window.

---

# 6. Education Stages

The participant already has a registered education stage.

The system should automatically select the correct question set:

```text
المرحلة المتوسطة → 20 questions
المرحلة الثانوية → 20 questions
المرحلة الجامعية → 20 questions
```

A user must not be able to switch stage during an active attempt.

If stage corrections are required, they should be handled by an auditable admin process before the attempt begins.

---

# 7. Question Bank

## Required total

- 20 middle-school questions
- 20 high-school questions
- 20 university questions
- 60 questions total

The question sets should cover the book broadly rather than over-concentrating on a few pages.

The book contains multiple thematic sections, including topics visible in the introduction such as:

- تأصيل الانتماء للوطن ومحبة الوطن في نصوص الوحيين
- الانتماء والمواطنة في حياة السلف الصالح
- الانتماء واللحمة الوطنية في الشريعة
- حقوق الانتماء للوطن
- محاذير لا بد من التنبه لها

The final authored questions should be grounded strictly in the approved book content and reviewed by the scientific/competition committee.

---

# 8. Difficulty by Stage

Do not simply reuse the same question with easier/harder wording.

Use the same book material at different cognitive levels.

### Middle school

Prefer:

- Explicit comprehension
- Identifying the correct concept
- Recognizing examples
- Simple relationships between ideas

### High school

Prefer:

- Interpretation
- Applying ideas
- Understanding relationships
- Distinguishing between close concepts
- Basic inference

### University

Prefer:

- Deeper inference
- Comparison
- Argument structure
- Connecting statements across pages
- Distinguishing implications and reasoning

Questions must remain objective and defensible from the book.

---

# 9. Recommended Question Data Model

Expand the current question model to something similar to:

```ts
type CompetitionQuestion = {
  id: string
  competitionId: string
  stage: 'middle' | 'highschool' | 'university'

  title: string
  type: 'single_choice' | 'multi_select'

  options: QuestionOption[]
  correctAnswers: string[]

  pdfPage: number
  printedPage: number

  hintPdfPageStart: number
  hintPdfPageEnd: number

  sourceSection?: string
  sourceExcerpt?: string
  answerExplanation?: string

  topic?: string
  difficulty?: 'easy' | 'medium' | 'hard'

  version: number
  approved: boolean
  active: boolean
}
```

Question type support should include:

- Single choice
- Multi-select

The system can start with single-choice if multi-select adds too much implementation risk, but the model should not prevent adding it.

---

# 10. Question Versioning

Keep the repository's existing strong behavior:

> Existing attempts keep the exact question version they started with.

When a question is edited:

```text
Existing question
       ↓
New version
       ↓
Needs approval
       ↓
Approved for future attempts
```

Existing attempts must not change.

Do not mutate the historical question snapshot attached to an attempt.

---

# 11. Freeze / Publish Question Set

Before the competition opens, Admin should have an action similar to:

> اعتماد نسخة المسابقة

This action verifies:

- exactly 20 approved middle-school questions
- exactly 20 approved high-school questions
- exactly 20 approved university questions
- all questions have valid answers
- all questions have page references
- hint ranges are valid
- the book version is present
- no draft/unapproved question is included

After freezing, the live set should be immutable.

Later edits prepare a future version rather than modifying an already-running competition.

---

# 12. Participant Start Flow

Recommended flow:

```text
Login / OTP
      ↓
Determine active competition
      ↓
Competition OPEN?
      ├─ No → Show status / dates
      ↓ Yes
Already submitted?
      ├─ Yes → Result/receipt screen
      ↓ No
Existing active attempt?
      ├─ Yes → Resume
      ↓ No
Create attempt
      ↓
Snapshot 20 approved questions
      ↓
Begin question 1
```

---

# 13. One-Attempt Rule

Normal participants receive only one attempt per competition.

Once submitted:

- The attempt cannot be reopened by the participant
- Answers cannot be changed
- A second attempt cannot be created
- Starting the competition again shows the completed result state

Any admin recovery must be explicit, restricted, and audited.

---

# 14. Question Order and Option Order

To reduce answer sharing:

- Shuffle question order per participant
- Preferably shuffle option order per participant

However:

- The underlying content must remain equivalent
- Correct-answer mapping must remain reliable
- The shuffled state must be snapshotted into the attempt
- The participant must see the same order when resuming

Do not re-randomize on reload.

---

# 15. Main Competition UI

On desktop use a split layout approximately like:

```text
┌────────────────────────┬──────────────────────────┐
│                        │                          │
│       BOOK             │       QUESTION           │
│       50–55%           │       45–50%             │
│                        │                          │
│    Page navigation     │   Question 7 / 20        │
│                        │   ○ Answer A              │
│                        │   ○ Answer B              │
│                        │   ○ Answer C              │
│                        │   ○ Answer D              │
│                        │                          │
│                        │   [ Check answer ]        │
└────────────────────────┴──────────────────────────┘

             Progress: 7 / 20
```

The interface must provide:

- Current question number
- Total questions
- Overall progress bar
- Clearly visible selected answer
- Clear primary action
- Previous/next navigation where allowed
- Connection/save status
- Book page number
- Hint button when eligible
- Mobile responsive behavior
- Strong Arabic RTL design

---

# 16. Real Book Reader

The current repository has:

- a real PDF available through the `/book` page
- a separate demo `BookReader` that renders temporary text chapters

For the real competition, replace the competition-side demo reader with a real PDF page renderer.

Recommended implementation:

- PDF.js / `pdfjs-dist`
- Page-by-page rendering
- Programmatic page control
- Zoom controls
- Direct jump to a known PDF page
- Current page tracking
- Previous/next page
- Mobile-friendly rendering
- Accessible loading/error states

Do not rely only on a browser `<object>` PDF viewer because the competition needs programmatic page navigation and hints.

---

# 17. Hint Logic

Each question should have:

- answer/source page
- hint page start
- hint page end

Example:

```text
Answer/source page: 27
Hint pages: 26–27
```

Recommended behavior:

1. Participant can freely read the book.
2. No hint appears while they have not yet passed the answer page.
3. If they navigate beyond the answer page, show a subtle hint button.
4. Clicking the hint jumps to the configured one- or two-page hint range.
5. The hint should not reveal the exact answer sentence before the answer is locked.

Example:

> 💡 تحتاج إلى مساعدة؟<br>
> راجع الصفحتين 26–27

The admin must be able to configure the hint range manually.

---

# 18. "Check Answer" Behavior

The new competition concept uses:

```text
Choose answer
    ↓
Check answer
    ↓
Lock answer
    ↓
Feedback
    ↓
Next question
```

This is important.

Once the participant presses **Check answer**, the selected answer becomes immutable.

Never allow:

```text
Choose A
→ Check
→ See that C is correct
→ Change answer to C
```

The first checked answer is the scored answer.

---

# 19. Correct-Answer Disclosure Mode

There is an important rule conflict that should be handled safely.

Earlier competition research in the repository records a rule indicating that correct answers should **not** be disclosed after the test.

The desired new experience asks for the correct answer to be shown after pressing **Check answer**.

Therefore implement this as a competition-level setting instead of hard-coding one behavior.

Example:

```text
Answer feedback mode:

○ Formal competition mode
  Do not reveal correct answer

○ Educational feedback mode
  Reveal correct answer after the participant locks their answer
```

Recommended default:

> Preserve the formal/committee rule unless an authorized admin explicitly enables answer revelation.

If revelation is enabled, show:

- Correct/incorrect state
- Correct answer
- Page reference
- Optional short explanation
- Button to return to source page

If revelation is disabled, show only permitted feedback.

---

# 20. Answer Persistence

The current system saves answers to the server using revisions.

Keep that behavior, but strengthen it for unreliable internet.

The user must not lose the competition because their connection temporarily drops.

---

# 21. Offline / Connectivity Recovery

Recommended flow:

```text
Participant checks/selects an answer
          ↓
Persist locally first
          ↓
Queue sync event in IndexedDB
          ↓
Try server
          ↓
Offline?
   ├─ Yes → retain event safely
   ↓
Connection restored
          ↓
Automatically sync
          ↓
Server confirms
```

Use **IndexedDB** for durable browser-side queue/state.

Do not rely only on React state or `sessionStorage`.

Each write/check action should carry a unique idempotency/event ID, for example:

```text
client_event_id
```

The server must safely ignore duplicate retries of the same event.

---

# 22. Save Status UX

The UI should clearly distinguish:

### Fully synchronized

> ✓ محفوظ على الخادم

### Offline but safely stored locally

> ☁ لا يوجد اتصال — إجابتك محفوظة على هذا الجهاز وستُرسل تلقائيًا

### Syncing

> ↻ جارٍ مزامنة إجابتين…

### Problem requiring action

> تعذرت المزامنة — أعد المحاولة

Do not block the user immediately because of a short connectivity interruption.

---

# 23. Attempt Data Model

The current single JSON `answers` object is suitable for the demo, but the real competition would benefit from normalized answer records.

Recommended structure:

```text
competitions
participants
questions
attempts
attempt_questions
attempt_answers
```

Example:

```sql
attempts
- id
- participant_id
- competition_id
- stage
- started_at
- submitted_at
- score
- max_score
- percentage
- participant_number
- status

attempt_answers
- id
- attempt_id
- question_id
- selected_answer
- checked_at
- is_correct
- client_event_id
- synced_at
```

The exact schema may differ, but it must support:

- resume
- offline sync
- answer locking
- audit/history
- invalid-question correction
- appeals
- safe retries
- analytics

---

# 24. Completion Screen

After all 20 questions are complete:

Show:

- score
- percentage
- memorable participant number
- completion confirmation
- leaderboard state

Example:

```text
أحسنت يا محمد

نتيجتك
85%

17 / 20

رقم المشارك
284731

احتفظ بهذا الرقم،
سيُستخدم أثناء إعلان الجوائز.
```

Include:

- Copy button
- Optional QR representation
- Clear note explaining leaderboard publication status

Do not expose internal database IDs.

---

# 25. Participant Number

Generate a human-friendly number separate from:

- attempt UUID
- receipt ID
- participant database ID

Example:

```text
284731
```

Requirements:

- unique within the competition
- hard to guess sequentially if privacy matters
- stable after submission
- shown prominently
- suitable for prize-event lookup

---

# 26. Leaderboard

Use separate stage leaderboards:

- المرحلة المتوسطة
- المرحلة الثانوية
- المرحلة الجامعية

Do not combine all stages into one ranking because they have different question sets.

Recommended public fields:

- Rank
- Participant number
- Percentage
- Score

Avoid exposing participant names publicly unless the organizer explicitly approves it.

Example:

| Rank | Participant # | Result |
|---|---:|---:|
| 1 | 284731 | 100% |
| 1 | 730182 | 100% |
| 3 | 629410 | 95% |

Ties should share rank.

Do **not** use completion time as a tiebreaker unless the approved rules explicitly change.

---

# 27. Leaderboard Publication Setting

Admin should control visibility:

```text
Leaderboard visibility

○ Hidden
○ Participant sees only own result
○ Published after competition closes
○ Public live
```

Recommended default:

> Participant sees their own result after completion; the full leaderboard becomes visible only after the competition closes and the committee publishes it.

---

# 28. Admin Question Editor

Expand the existing admin question editor.

Recommended fields:

```text
المرحلة
[ الثانوية ▼ ]

السؤال
[ ...................................... ]

نوع السؤال
[ اختيار واحد ▼ ]

الخيار 1 [...]
الخيار 2 [...]
الخيار 3 [...]
الخيار 4 [...]

الإجابة الصحيحة
[ الخيار 3 ]

صفحة الكتاب المطبوعة
[ 27 ]

صفحة PDF
[ 29 ]

صفحات التلميح
[ 26 ] → [ 27 ]

التفسير بعد الإجابة
[ ...................................... ]

المحور
[ حقوق الانتماء للوطن ▼ ]

الصعوبة
[ متوسط ▼ ]

[ معاينة الصفحة ] [ حفظ كمسودة ]
```

Support:

- draft
- edit
- approve
- deactivate
- duplicate
- preview
- page preview
- question history/version

---

# 29. Question Coverage Map

Add an admin visualization showing book coverage.

Example:

```text
Book pages

01 02 03 04 05 06 07 08 09 10 ...
       •     •  •
```

Filters:

- Middle school
- High school
- University
- All

The purpose is to reveal:

- overused pages
- uncovered parts of the book
- poor distribution
- stage imbalance

---

# 30. Question Quality Validation

Before question approval/freeze, validate:

- missing page reference
- hint range invalid
- duplicate option text
- missing correct answer
- less/more than expected choices
- duplicate/similar question
- unsupported stage
- too many questions from same page
- missing book version
- answer/source page outside PDF range

Warn admins before competition freeze.

---

# 31. Admin Test-Run Mode

This is a critical new requirement.

Because the real competition allows only one attempt, the Admin page needs a **safe competition test-run environment**.

Admin should be able to repeatedly test the full experience without consuming a real participant attempt or polluting production results.

## Test-run goals

Admins need to verify:

- Competition opening/closing behavior
- Every question
- Stage filtering
- Question order
- Option shuffling
- Book reader
- PDF page mapping
- Hint appearance
- Hint navigation
- Check-answer behavior
- Correct/incorrect feedback
- Answer locking
- Offline/save indicators
- Resume behavior
- Completion screen
- Percentage calculation
- Participant number generation
- Leaderboard result rendering
- Mobile layout
- Accessibility
- Error states

---

# 32. Admin Test-Run Entry

Add a dedicated admin area such as:

> تجربة المسابقة

Admin chooses:

```text
Stage:
[ Middle School ]
[ High School ]
[ University ]

Mode:
[ Full test ]
[ Specific question preview ]

Answer feedback:
[ Use live competition setting ]

Question order:
[ Live randomized behavior ]
```

Then:

> ابدأ تجربة المسابقة

---

# 33. Test-Run Isolation

A test run must **never** behave like a real participant record.

Do not:

- create a real participant attempt
- consume the one-attempt limit
- appear in participant reports
- appear in leaderboards
- affect score statistics
- trigger prize logic
- cause results to be unpublished
- generate real reminders
- create fake production winners

Prefer a clearly separate test-run/session namespace.

Possible design:

```text
admin_test_runs
admin_test_run_answers
```

or an ephemeral server-side test session if appropriate.

The important requirement is logical isolation.

---

# 34. Test Run Should Reuse Real Competition Logic

Do not build a completely separate fake UI.

The test-run mode should reuse as much of the real participant system as possible:

- same question renderer
- same PDF reader
- same hint logic
- same answer evaluation
- same progress
- same completion component
- same responsive UI
- same accessibility behavior

Inject a test-run adapter/context around the real competition engine.

This minimizes the risk that:

> "Admin preview works, but production behaves differently."

---

# 35. Repeatable Test Runs

Unlike real participants, Admin should be able to:

- reset test run
- repeat test run
- choose another stage
- retry unlimited times
- jump to a specific question
- simulate already-passed source page
- simulate offline state
- simulate competition closed/open state
- simulate answer-reveal mode

Every test-run screen should have a clear banner such as:

> وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة

---

# 36. Test-Run Debug Panel

Optional but recommended in test mode only.

Admin may expand:

> معلومات الاختبار

to see:

- question ID
- question version
- stage
- source PDF page
- printed page
- hint range
- expected correct answer
- competition setting values
- sync state

This information must never be available to normal participants.

---

# 37. Admin Recovery for Real Participants

Normal one-attempt behavior must remain strict.

However, technical failures can happen.

Add a privileged admin action such as:

> معالجة عطل تقني

Possible actions:

- Resume an unfinished attempt
- Reopen a locked attempt only if approved policy allows
- Reset a failed attempt
- Grant a replacement attempt

Every action must:

- require a reason
- require privileged role
- create an audit event
- preserve previous data instead of silently deleting it
- record the admin actor
- record timestamp
- record before/after state

Do not make "reset attempt" a casual button.

---

# 38. Competition Close Behavior

This requires an explicit policy.

At minimum distinguish:

- New participant trying to start after close
- Participant already inside an unfinished attempt when close occurs
- Offline participant with locally queued writes
- Technical outage near deadline

Make the behavior a documented system setting or approved policy.

Recommended implementation support:

```text
At close:

○ Immediately lock all unfinished attempts
○ Allow attempts started before closing to finish within grace period
```

If grace period is supported:

- configure duration
- enforce server-side
- display clear countdown/status
- audit extensions

---

# 39. Results

Each completed attempt should store:

- score
- max score
- percentage
- stage
- participant number
- completion timestamp
- question versions
- competition version

The participant's result page should be readable after submission without allowing a new attempt.

---

# 40. Security / Fairness

Keep scoring and answer validation server-side.

Never trust:

- score from browser
- correct answer from browser
- participant stage supplied only by client
- question bank supplied only by client
- competition open/closed state supplied by client

The public question API must not expose correct answers before they are permitted by the configured feedback mode.

---

# 41. Audit Log

Continue and expand the current audit model.

Audit at minimum:

- competition created
- competition settings changed
- competition frozen
- competition opened
- competition closed
- question edited
- question approved
- leaderboard published/unpublished
- participant recovery action
- real attempt submitted
- test run started/reset if useful
- book version changed

Avoid logging sensitive answer content unnecessarily.

---

# 42. Accessibility

Preserve and expand the current strong accessibility work.

Requirements:

- Arabic RTL
- keyboard navigation
- visible focus states
- screen-reader labels
- accessible radio/checkbox semantics
- sufficient contrast
- clear save/offline status
- mobile reader behavior
- no color-only correctness indicators
- sensible font sizing
- touch-friendly controls

---

# 43. Mobile UX

On smaller screens, do not force a cramped 50/50 split.

Recommended:

```text
Question
↓
[ Open Book ]
```

Book opens as:

- full-screen panel
- sheet/dialog
- easy close/return
- keeps exact book page position

The participant's question state must not be lost when opening/closing the book.

---

# 44. Admin Dashboard Additions

Suggested admin navigation:

```text
Overview
Competition
Questions
Book Coverage
Test Run
Participants
Results
Prizes
Security
Audit
```

### Competition tab

- state
- schedule
- answer feedback mode
- leaderboard mode
- closing policy
- freeze/unfreeze policy
- current book version

### Questions tab

- stage filters
- approval filters
- topic filters
- difficulty filters

### Test Run tab

- full repeated admin testing

### Results tab

- ranking by stage
- ties
- exports
- result publication

---

# 45. Data Migration

Do not destroy existing development/demo data unnecessarily.

Add forward database migrations.

The current code has migration infrastructure; continue using it.

Potential new tables/changes:

```text
competitions
competition_question_sets
attempt_questions
attempt_answers
admin_test_runs
admin_test_answers
```

Exact naming is flexible.

Migrations must work for:

- PostgreSQL production
- existing local PGlite development/tests, where appropriate

---

# 46. Existing Demo Content

The repository currently contains 10 demo questions and four demo reading chapters.

Do not confuse them with the official competition bank.

Once the real system exists:

- keep demo fixtures only for local automated tests if useful
- clearly separate demo/sample content from production content
- production must not silently activate sample questions

---

# 47. Question Authoring / Import

Because 60 questions are substantial, add a repeatable import/export format.

Suggested JSON/CSV import fields:

```text
id
stage
question
type
option_a
option_b
option_c
option_d
correct_answer
pdf_page
printed_page
hint_page_start
hint_page_end
topic
difficulty
answer_explanation
approved
```

Admin should still be able to edit them individually after import.

All book-based content must be reviewed before production activation.

---

# 48. Content Governance

Questions should be created only from the approved book.

Do not invent facts based on general knowledge.

For every scored question, retain enough internal source metadata for committee review.

Recommended internal fields:

- source page
- source section
- optional excerpt
- reviewer
- approval date

---

# 49. Automated Tests

Expand automated test coverage.

At minimum test:

### Competition lifecycle

- cannot start before opening
- can start when open
- cannot start after close
- repeated real start returns/resumes same attempt
- cannot create second attempt after submission

### Stage bank

- middle receives only middle questions
- high school receives only high-school questions
- university receives only university questions
- exactly 20 questions

### Question snapshot

- later edits do not modify an existing attempt

### Answer lock

- answer can be selected before check
- first checked answer is stored
- checked answer cannot be changed

### Feedback mode

- correct answer hidden in formal mode
- correct answer shown only after lock in educational mode

### Book/page logic

- hint appears only according to configured rule
- hint jumps to configured pages
- page mapping validation works

### Offline/idempotency

- duplicate event ID does not double-apply
- queued answers can sync
- conflict handling is deterministic

### Submission

- score computed server-side
- percentage correct
- participant number generated
- one attempt remains enforced

### Leaderboard

- rankings separated by stage
- ties handled correctly
- time is not used to break ties
- hidden leaderboard is not publicly exposed

### Admin test run

- test run can be repeated
- test run never creates a real attempt
- test result never appears in leaderboard
- test result never changes publication state
- test run uses same core competition logic

### Authorization

- participant cannot use admin APIs
- editor/admin permissions remain correct
- production staff authentication remains intact

---

# 50. Acceptance Criteria

The feature is ready only when all of the following are true:

- [ ] Admin can configure competition dates/state
- [ ] Server enforces competition state
- [ ] Each stage has exactly 20 approved live questions
- [ ] Participant receives questions for their registered stage only
- [ ] Question order is stable for an attempt
- [ ] Real PDF book is available beside the questions
- [ ] Each question is linked to a valid page
- [ ] Hint logic works
- [ ] Check Answer locks the first checked answer
- [ ] Feedback respects configured reveal policy
- [ ] Answers survive reload and connectivity interruptions
- [ ] Offline queued answers safely synchronize
- [ ] Participant cannot obtain a second real attempt
- [ ] Completion page shows score/percentage and participant number
- [ ] Leaderboard is stage-specific
- [ ] Leaderboard visibility is admin-controlled
- [ ] Admin can edit/version/approve questions
- [ ] Admin can preview linked pages
- [ ] Admin coverage map exists
- [ ] Admin can run unlimited isolated competition test runs
- [ ] Test runs do not pollute real results or consume attempts
- [ ] Technical recovery actions are audited
- [ ] Existing OTP/security features still work
- [ ] Typecheck/build/tests pass
- [ ] Mobile and keyboard flows are usable

---

# 51. Recommended Implementation Order

## Phase 1 — Domain and database

- competitions
- competition settings
- question model
- attempts by competition
- normalized answer records
- migrations

## Phase 2 — Competition service/API

- stage-specific attempt creation
- lifecycle enforcement
- answer lock
- server scoring
- participant number
- feedback modes

## Phase 3 — Real book reader

- PDF.js integration
- page mapping
- hint behavior
- responsive book panel

## Phase 4 — Participant UX

- 20-question flow
- progress
- check answer
- feedback
- completion
- result page

## Phase 5 — Offline recovery

- IndexedDB queue
- idempotent server writes
- reconnection/sync UX

## Phase 6 — Admin tools

- competition settings
- expanded question editor
- question coverage map
- freeze validation
- result publication
- leaderboard controls

## Phase 7 — Admin test-run system

- stage selector
- unlimited isolated runs
- live-logic reuse
- reset/restart
- test debugging tools
- offline/closed-state simulation

## Phase 8 — Question bank

- import structure
- 60 book-grounded questions
- committee review/approval

## Phase 9 — Regression/security testing

- OTP
- staff auth
- production guards
- migrations
- competition tests
- accessibility
- mobile

---

# 52. Final Design Principle

This system is not just a quiz.

It should feel like:

> **Read → understand → find evidence → answer → learn → complete the competition fairly.**

At the same time, the competition infrastructure must remain:

- reliable
- auditable
- recoverable
- secure
- stage-aware
- future-proof
- easy for non-technical admins to operate

The existing NBC Web repository should be evolved into this system rather than rewritten from scratch.
