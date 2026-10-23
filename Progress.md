# NBC competition platform — Progress

A dated log of what was done, with its evidence. Oldest first. Updated from Git history and verification records on 2026-10-12.

## 2026-09-15 — Platform started

- 80d2b21 Initial commit: NBC competition platform ready for Vercel deployment

## 2026-09-16 — First UI and admin

- 044bcf8 feat: add initial UI and admin components, global styles, and organization assets
- 31bd6fd chore: expose detailed error in API responses for debugging
- 816c3bb chore: clean up error response

## 2026-09-29 — Web application for the committee demo

- f9ffee4 feat: initialize NBC web application with components, pages, security headers, and tests
- Evidence: docs/design/2026-09-29, docs/implementation/00-Implementation-Index.md

## 2026-10-01 — Official identity

- b141663 feat: add official brand identity assets, design documentation, and web application components

## 2026-10-04 — Production backend

- cdd3825 feat: add prize management and competition analytics
- 5055152 feat: implement production-ready OTP authentication and administration system
- 1f8e7b4 fix: add Vercel staff sign-in and keep public pages available during setup
- aed73f1 fix: persist admin prize settings with isolated Supabase storage
- a4f9697 fix: return committed prizes and verify successive admin saves
- be4cbc8 feat: complete private NBC competition backend and deployment safeguards
- 8f3732e merge: retain upstream prize fixes in completed NBC backend
- fc4817f feat: expose private storage readiness and record live backend verification
- 2a78cdb docs: record persistent production storage after redeployment
- Evidence: docs/implementation/2026-10-04-*.md, NBC_BACKEND_OPERATIONS.md

## 2026-10-06 — Competition UX refresh, phases 0–6

- 210041d test: establish isolated exam UX baseline
- e662963 feat: refresh exam formatting and shared motion
- 329eff4 feat: complete phase 2 exam UX including 2026-10-05 baseline
- f968f4d feat: complete phase 3 reader toolbar and phone reading UX
- 161e7d4 fix: clarify admin session loading and prevent duplicate Vercel sign-in
- 3955e74 feat: finish reader contents with provisional real book chapters
- e2a6624 docs: preserve approved competition UX handoff and journey prototype
- 0eeade5 feat: keep phone reader toolbar on one row with labelled More menu
- 8fa8ceb feat: complete phase 4 result reader and verified-cover intro
- 6a9a9c7 fix: keep hints locked on first open and collapse long revisit lists
- f9329a3 feat: add lazy 3D book with real verified cover and flat fallback
- 3db36e9 feat: committee launch control, question workshop, coverage strip and honest admin search
- Evidence: docs/implementation/2026-10-06-exam-ux-refresh.md, docs/implementation/2026-10-06-admin-signin-loading.md, docs/implementation/2026-10-06-book-outline-candidates.md

## 2026-10-08 — Exam screen follow-up

- 15a42ae feat: make the exam question screen easier to read and answer

## 2026-10-09 — Core files and competition management in progress

- Roadmap.md, Status.md and Progress.md created for Compass.
- At this checkpoint, participant management, eligibility, campaigns, site content, book admin and winners announcement were uncommitted. They were later included in `04c157e` on 2026-10-12, with their regression tests.

## 2026-10-11 to 2026-10-12: Meeting implementation and release

- `04c157e` committed the meeting updates and committee workflows, including the previously uncommitted management features.
- Prepared 75 unapproved questions, stage counts 20/25/30, final-submission locking and feedback, source evidence, logos/cities/Arabic corrections, applicable terms, draft privacy and technical gaps.
- Regression, disposable PostgreSQL, HTTP, build/type and browser journey checks passed. Evidence: docs/implementation/2026-10-11-meeting/README.md.
- `ce15157` corrected shared logo spacing and role alignment. Desktop, tablet and mobile measurements showed nine loaded images and no horizontal overflow. Evidence: docs/design/2026-10-12-logo-spacing/README.md.
- `4c63e71` committed Compass configuration and tracking files. Its application code matches `ce15157`.
- The public production alias was verified on `4c63e71`, deployment `dpl_7LyMKyMLHxT7MrGtFviEiDCLiYMH`, READY on 2026-10-12. Before cleanup, GitHub `main` still pointed to the older `fa26a77`.

## 2026-10-12: Repository cleanup

- Preserved the working release as `release/nbc-working-2026-10-12` at `4c63e71`.
- Joined older `main`/`codex/exam-integrity` history while retaining the complete application tree from the working release. Updated `main` through a fast-forward, without a force-push or applying the older exam implementation.
- Backed up `NBC_web_wt` at `08b3edb`: 1,853 files, local environment/database, artifacts, SHA-256 inventory and a verified Git-history bundle. The private backup is in ignored `.data/backups/2026-10-12-NBC_web_wt/`.
- Compared every archived file with ZIP contents and the source before removal. Unlinked only the shared dependency junction, removed the Git worktree and checked the main dependencies remained unchanged.
- Corrected Status.md, Roadmap.md, this log, README and active Compass findings. Earlier records remain recoverable from preserved Git history.
- Superseded-branch retirement is pending the consolidated `main` push and deployment verification. Commits are preserved in the consolidated local history and the backup.
- Content approval, question freeze, providers, database data and launch decisions remain separate. Evidence: docs/implementation/2026-10-12-repository-cleanup.md.

## 2026-10-12: Owner-requested safe stop

- Local archive/bundle verification, worktree removal, tracking checks, production build and application-tree comparison are complete.
- Consolidation and tracking are saved in a local commit on `main`. GitHub push, baseline-tag publication, new production verification and branch retirement remain pending.
- The existing production deployment and remote branches were left unchanged. Resume instructions: docs/implementation/2026-10-12-cleanup-resume.md.

## 2026-10-12 — Logged by Compass

- 58893d4 fix: withhold answer key, load approved terms, and refine partner logos

## 2026-10-13 — Logged by Compass

- d5700be fix: keep registration city list available when the backend is unavailable
