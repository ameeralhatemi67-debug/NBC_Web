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

## Known scope notes

The existing safe-question payload includes source-page metadata before locking. The hint gate remains a UI rule. Changing this exposure needs an owner decision and is outside this refresh.

The rehearsal prerequisite needs its own reviewed backend decision in Phase 6. It remains informational until that work is approved.
