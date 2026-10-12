# NBC repository cleanup

The user requested preservation of the website at `4c63e712156c145203653b26c5071db47f36898c`, alignment of `main`, corrected tracking, backup/removal of `NBC_web_wt`, and a commit/push of the cleanup.

The owner subsequently requested a safe stop to close the laptop. Local consolidation and verification are complete; push, new deployment verification and branch retirement are pending. See [resume handover](2026-10-12-cleanup-resume.md).

## Preserved release and history

Tag `release/nbc-working-2026-10-12` records the exact release baseline, including meeting implementation `04c157e` and logo correction `ce15157`. Vercel's public alias was verified against its READY production deployment before cleanup.

The release branch and `origin/codex/exam-integrity` diverged after `15a42ae`. The old worktree tip `08b3edb` includes old `main` tip `fa26a77`. An intentional `ours` history merge joins those commits while retaining the file tree from `4c63e71`. `main` can then move forward normally. Every prior commit is preserved without reapplying older exam behavior or requiring a force-push.

Cleanup changes tracking/documentation and ignores local `.vercel/` metadata. It leaves `src`, `public`, `scripts`, tests, dependencies, build/type configuration and migrations identical to the working release. No database records, provider settings, staff access configuration, question approvals or campaign state are changed.

## Worktree backup and removal

The old worktree was on `codex/exam-integrity` at `08b3edb62bec876700c489ac361e5cdd2ae6f119`, clean and fully pushed. Its local, ignored backup is:

`D:/Agents/main/projects/ideas/NBC_web/.data/backups/2026-10-12-NBC_web_wt/`

- `NBC_web_wt.zip`: 1,853 files, including environment configuration, local database, source and artifacts; 222,972,022 bytes.
- `manifest.json`: original branch/commit, sizes and SHA-256 inventory. ZIP bytes and current source files were compared before removal.
- `NBC-history.bundle`: history and refs captured before consolidation and validated with `git bundle verify`.
- `RESTORE.md`: recovery instructions. Git recreates the checkout at the recorded commit; the original shared `.git` pointer is not copied.

Shared Git metadata is retained in the bundle. The `node_modules` junction to the main checkout is excluded. Removal validates the exact named path, confirms the old checkout is clean and unchanged, verifies all hashes again, unlinks the junction without recursion, then uses `git worktree remove`. The main dependency package is hashed before and after. No primary checkout files are removed.

The archive contains private local configuration and must remain local.

## Canonical branch and tracking

`main` is the canonical branch and the configured production branch of Vercel project `nbc-web` (`prj_wsjRUAqamQTgnYoNuZIOUi95pGJh`, team `amir-3843`). The release tag is pushed with `main`. Superseded exam branches are retired only after its deployment is READY and the public alias points to the consolidated commit. The ancestral local backend-completion branch can also be retired.

Status.md, Roadmap.md, Progress.md, README and Compass's active findings reflect the committed implementation and current approval dependencies. The older pending-question note points to the supplied bank. Historic assertions remain recoverable from the baseline and Git bundle.

## Verification

- Archive and Git bundle verified before removal; every archived file matched the source byte-for-byte.
- Main dependencies remained present and unchanged after removal.
- Application/build paths match the baseline tag without differences.
- The local production build passed with operator environment loading blocked. Tracking links, Compass JSON and whitespace checks passed.
- Push `main` through a normal fast-forward. Check its exact Vercel commit and the public alias before retiring remote branches.

Raw verification logs stay under ignored `tmp/`. Official content approval and competition launch remain separate operational steps.
