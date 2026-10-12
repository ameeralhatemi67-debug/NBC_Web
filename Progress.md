# NBC competition platform — Progress

A dated log of what was done, with its evidence. Oldest first. Rebuilt from git history on 2026-10-09.

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
- Not committed yet: participant management, eligibility, campaigns, site content, book admin and winners announcement, with tests/eligibility.test.ts, tests/management.test.ts and tests/winners.test.ts.
