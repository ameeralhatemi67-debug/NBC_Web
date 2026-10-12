# Cleanup safe-stop handover

Paused on 2026-10-12 at the owner's request to close the laptop.

## Saved locally

- The working application is preserved from `4c63e712156c145203653b26c5071db47f36898c`, with annotated tag `release/nbc-working-2026-10-12`.
- A history-only `ours` merge incorporates `08b3edb` and its ancestor `fa26a77` while retaining the released application tree. The consolidation and corrected tracking are committed locally. Local `main` is advanced normally to that commit and is the current checkout.
- No application, public asset, script, test, dependency, build/type configuration or migration differs from the preserved release. Production build, tracking JSON/links and whitespace checks passed.
- `NBC_web_wt` was backed up, verified and removed. The main dependency junction target was preserved.
- Private backup: `.data/backups/2026-10-12-NBC_web_wt/`, containing the 1,853-file ZIP, SHA-256 manifest, Git-history bundle and restore instructions. The backup stays ignored and local.
- The owned local preview server was stopped. No cleanup build or backup process remains running.

## Remote state at the pause

- GitHub `main`: `fa26a77e29a8000bf3adbaac889e4dc403623858`.
- GitHub `codex/exam-ux-refresh`: `4c63e712156c145203653b26c5071db47f36898c`.
- GitHub `codex/exam-integrity`: `08b3edb62bec876700c489ac361e5cdd2ae6f119`.
- Public Vercel website: working `4c63e71`, READY production deployment `dpl_7LyMKyMLHxT7MrGtFviEiDCLiYMH`.
- The baseline tag and consolidation have not yet been pushed. Obsolete branches remain available; no remote branch was removed.

## Resume the authorized cleanup

1. Fetch current GitHub metadata and inspect any remote changes before pushing. Do not force-push. Verify `origin/main` is ancestral to local `main` and the application diff from the baseline tag is empty.
2. Push local `main` and `refs/tags/release/nbc-working-2026-10-12`, preferably atomically. The user already authorized this cleanup, main update, commit and push.
3. Verify the exact main commit reaches READY in Vercel and that `nbc-web-two.vercel.app` points to it. Intended project: `nbc-web`, ID `prj_wsjRUAqamQTgnYoNuZIOUi95pGJh`, team `amir-3843` / `team_esYRC0Dnt9BlycZOvBkShY8T`; configured production branch is `main`.
4. Compare the public organization section with ignored `tmp/nbc-cleanup-public-before.html`. Use ordinary read-only HTTP or the existing scoped CLI inspection. Do not create a protection-bypass credential or change providers/access settings.
5. After main and production are verified, retire the superseded remote exam branches and their local counterparts, plus the ancestral local `codex/backend-completion` branch. First ensure each tip remains reachable in `main`; preserve the release tag and backup.
6. Record completion in tracking files, remove the paused-status wording, and commit/push that documentation update. Verify the final production commit and a clean checkout.

Do not re-import/approve questions, open the campaign, migrate production data, or change environment/provider settings as part of repository cleanup. Content and launch approvals remain separate.
