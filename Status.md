# NBC competition platform — Status

Updated 2026-10-09

Active checkpoint: 4.1 — Competition management

## Where things stand

- Working branch `codex/exam-ux-refresh` holds Versions 2 and 3 and is 19 commits ahead of `main`; it has not been merged or deployed from `main` yet.
- The competition management work of Checkpoint 4.1 (participants, eligibility, campaigns, site content, book admin, winners) is written and has its own tests, but is not committed.
- Real SMS OTP is implemented but not activated (Checkpoint 2.3).

## Verified

- UX refresh phases 0–6: typecheck, 100 unit tests, 38 integration checks, format check and build passed, plus the browser suites (exam-ux, exam-loop, reader-ui, result-intro-ui, exam-hint-gate, book-3d-ui, admin-ux). Record: docs/implementation/2026-10-06-exam-ux-refresh.md.
- Production backend on the dedicated NBC database, live and persistent after redeployment (2a78cdb).
- Not verified: real iPhone and Android phones (only Chrome touch emulation), real GPU for the 3D book, the admin search branch with a readable-text PDF.

## Next action

Run all checks on the uncommitted competition management work and commit it.

## Open questions

- When to merge `codex/exam-ux-refresh` into `main` and deploy.
- Hint rule: count the furthest page reached (current), or only pages actually visited.
- Committee review of the provisional chapter titles and pages.
- SMS provider setup: Unifonic account, approved sender and production secrets.
- Keep or remove the two local isolation scripts (`scripts/local-ux-check.cjs`, `scripts/local-ux-no-env.cjs`).
