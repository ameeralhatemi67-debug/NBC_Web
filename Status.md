# NBC competition platform status

Updated 2026-10-12.

Active checkpoint: committee content approval and launch readiness.

Repository cleanup is paused at the owner's request. The consolidation is saved on local `main`; the GitHub push, release-tag push, new main deployment verification and obsolete-branch retirement remain pending. GitHub `main` still points to `fa26a77`; the live website remains on the preserved `4c63e71` release. See [safe-stop handover](docs/implementation/2026-10-12-cleanup-resume.md).

## Release and repository

- `main` is the canonical development and production branch for Vercel project `nbc-web`.
- The working website baseline is `4c63e712156c145203653b26c5071db47f36898c`, preserved as `release/nbc-working-2026-10-12`. The public website was verified on this baseline before cleanup. Cleanup retains its application files unchanged and consolidates the older branch histories into `main`.
- Committee management and meeting updates were committed in `04c157e`; logo spacing was corrected in `ce15157`. Both are part of the preserved release.
- The obsolete `NBC_web_wt` worktree has been backed up and removed. Its source, local configuration, database and artifacts are in ignored `.data/backups/2026-10-12-NBC_web_wt/`, with a verified Git-history bundle. This private backup must stay local.
- Superseded development branches are retired after the consolidated `main` deployment is verified. Their commits remain in history and the backup bundle.
- See [cleanup evidence](docs/implementation/2026-10-12-repository-cleanup.md). Use GitHub `main` and the public Vercel alias to check the current deployment commit.

## Implemented and verified

- Participant management, eligibility, campaigns, content editing, book administration, winners management and the announcement page are committed with regression coverage.
- New campaigns use 20 middle, 25 secondary and 30 university questions. Answers remain editable until final submission; feedback arrives only after server-confirmed submission. Existing campaign rules and locked answers are preserved.
- The supplied 75 questions are unapproved drafts with original-row/source evidence. Organizer questions use official sources without book-page hints. Committee approval and freeze gates remain in place.
- The authority and eight partner logos, role labels, responsive spacing, twelve-city list and Arabic corrections are implemented. Name captions beneath logos are removed; alternative text remains.
- Applicable dark participation clauses are used in terms; privacy is staged for review. Red commentary and correspondence are excluded from participant pages. Prize amounts and the 52,000 SAR total are retained.
- Meeting verification passed 124 local regression tests, 13 final engine/compatibility checks, local and disposable PostgreSQL/HTTP suites, build/type checks and the 20/25/30 browser journeys. See [meeting handover](docs/implementation/2026-10-11-meeting/README.md) and [spacing review](docs/design/2026-10-12-logo-spacing/README.md).

## Next actions and release dependencies

- Review and approve the 75 drafts, source evidence, book rights and publication version through the committee workflow.
- Resolve privacy contact, minors' data handling, retention, prize/media-award criteria and patronage wording with the responsible owners.
- Confirm current production storage, staff authentication, SMS readiness, backups and incident procedures. Historical backend verification does not prove present configuration; cleanup changes no providers, database data or environment settings.
- Complete real SMS verification/activation only with the organization's approved sender/account and recorded readiness evidence.
- Complete the specialist approvals in the [technical gap report](docs/implementation/2026-10-11-meeting/TECHNICAL_GAPS.md), then approve the book, freeze the stage banks and schedule/open the competition.
- Real iPhone/Android testing and production recovery/capacity exercises remain separate checks.
