# NBC competition platform — Roadmap

## Goal

A launch-ready Arabic book competition: eligible readers register, read the book and answer the 20 questions of their stage, and the committee runs, judges and announces the competition with a real admin team.

Task states: `[x]` done with evidence, `[/]` in progress, `[ ]` planned, `[-]` cut with a reason. Each checkpoint ends with a commit; evidence is the commit hash or the implementation note.

## Version 1 — Committee demo

### Checkpoint 1.1: Initial platform

- [x] Task 1.1.1 — Competition platform scaffold ready for Vercel deployment (80d2b21)
- [x] Task 1.1.2 — Initial UI, admin components, global styles and organization assets (044bcf8)
- [x] Task 1.1.3 — Web application with components, pages, security headers and tests (f9ffee4)

### Checkpoint 1.2: Official identity

- [x] Task 1.2.1 — Official brand identity assets, design documentation and components (b141663; docs/design/2026-10-01-official-identity)

## Version 2 — Production backend

### Checkpoint 2.1: Prizes, analytics, OTP and administration

- [x] Task 2.1.1 — Prize management and competition analytics (cdd3825; docs/implementation/2026-10-04-prizes-analytics.md)
- [x] Task 2.1.2 — Production-ready OTP authentication and administration system (5055152; docs/implementation/2026-10-04-production-otp.md)
- [x] Task 2.1.3 — Persist admin prize settings and verify successive saves (aed73f1, a4f9697; docs/implementation/2026-10-04-prize-save-fix.md)

### Checkpoint 2.2: Staff sign-in and the dedicated private backend

- [x] Task 2.2.1 — Vercel staff sign-in, public pages available during setup (1f8e7b4; docs/implementation/2026-10-04-admin-access-fix.md)
- [x] Task 2.2.2 — Private NBC competition backend and deployment safeguards (be4cbc8, 8f3732e)
- [x] Task 2.2.3 — Private storage readiness and live backend verification (fc4817f)
- [x] Task 2.2.4 — Persistent production storage after redeployment, recorded (2a78cdb)

### Checkpoint 2.3: Real SMS OTP activation

- [ ] Task 2.3.1 — Organization's Unifonic account and approved Saudi sender
- [ ] Task 2.3.2 — Production SMS secrets in secure deployment storage
- [ ] Task 2.3.3 — Real SMS verification test from Admin > إعداد التحقق والأمان, then activate

## Version 3 — Competition UX refresh

Branch `codex/exam-ux-refresh`, following docs/design/COMPETITION_UX_HANDOFF.md. Full record: docs/implementation/2026-10-06-exam-ux-refresh.md.

### Checkpoint 3.1: Student exam and reader

#### Phase 3.1.0: Baseline

- [x] Task 3.1.0.1 — Isolated exam UX baseline and gates (210041d)

#### Phase 3.1.1: Quick fixes and motion

- [x] Task 3.1.1.1 — Exam formatting fixes and shared motion tokens (e662963)

#### Phase 3.1.2: Core exam loop

- [x] Task 3.1.2.1 — Answering, lock and feedback, question strip, hint, connection status, review sheet (329eff4)

#### Phase 3.1.3: Reader toolbar and phone reading

- [x] Task 3.1.3.1 — Reader toolbar and phone reading UX (f968f4d)
- [x] Task 3.1.3.2 — Reader contents with provisional real book chapters (3955e74)
- [x] Task 3.1.3.3 — Phone reader toolbar on one row with labelled More menu (0eeade5)

#### Phase 3.1.4: Result, result reader and introduction

- [x] Task 3.1.4.1 — Result reader and verified-cover intro (8fa8ceb)
- [x] Task 3.1.4.2 — Hints locked on first open, long revisit lists collapsed (6a9a9c7)

#### Phase 3.1.5: 3D book

- [x] Task 3.1.5.1 — Lazy 3D book with the real verified cover and flat fallback (f9329a3)

#### Phase 3.1.7: Follow-up

- [x] Task 3.1.7.1 — Exam question screen easier to read and answer (15a42ae)

### Checkpoint 3.2: Committee tools

#### Phase 3.2.6: Launch control, workshop and coverage

- [x] Task 3.2.6.1 — Committee launch control, question workshop, coverage strip and admin-only search finding (3db36e9)

### Checkpoint 3.3: Merge and deploy

- [ ] Task 3.3.1 — Merge `codex/exam-ux-refresh` into `main` (the branch is 19 commits ahead)
- [ ] Task 3.3.2 — Deploy and check the live site

## Version 4 — Competition management

### Checkpoint 4.1: Competition management

- [/] Task 4.1.1 — Participant management: edit, correct, merge and delete participants (src/components/admin-participants.tsx, src/lib/participant-admin.ts)
- [/] Task 4.1.2 — Eligibility: Eastern Province (الشرقية) only, regions and cities editable by admins (src/lib/eligibility.ts, tests/eligibility.test.ts)
- [/] Task 4.1.3 — Campaigns, site content and book administration (src/lib/campaigns.ts, src/lib/site-content.ts, src/lib/book-store.ts)
- [/] Task 4.1.4 — Winners and the winners announcement page (src/lib/winners.ts, src/app/winners/, tests/winners.test.ts)
- [ ] Task 4.1.5 — Run all checks and commit the management work

## Version 5 — Launch

### Checkpoint 5.1: Launch decisions

- [ ] Task 5.1.1 — Book publication rights
- [ ] Task 5.1.2 — Final 60-question bank and who reviews it
- [ ] Task 5.1.3 — Committee review of the provisional chapter titles (docs/implementation/2026-10-06-book-outline-candidates.md)
- [ ] Task 5.1.4 — Tie and prize rules
- [ ] Task 5.1.5 — Privacy and guardian terms approved for publication
- [ ] Task 5.1.6 — Hint rule: furthest page reached, or pages actually visited

### Checkpoint 5.2: Operations

- [ ] Task 5.2.1 — Daily `npm run db:cleanup` scheduled with the production environment
- [ ] Task 5.2.2 — Backup restore tested on the production database
- [ ] Task 5.2.3 — Phone reading and exam checked on real iPhone and Android devices

### Checkpoint 5.3: Open the competition

- [ ] Task 5.3.1 — Import and approve the questions for all three stages
- [ ] Task 5.3.2 — Approve the book and freeze the three stage banks
- [ ] Task 5.3.3 — Schedule and open the competition
