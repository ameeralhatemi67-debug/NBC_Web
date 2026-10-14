# Implementation plans

Prepared on 2026-10-14 using the Improve planning workflow. Plan 001 was subsequently authorized and implemented locally. Source baseline: `11990be` plus the inspected working tree.

| Plan | Title | Priority | Effort | Dependencies | Status |
|---|---|---|---|---|---|
| [001](001-admin-simulation.md) | Five-minute admin simulation and public practice window | P2 | L | None | DONE locally; release pending |

Both dashboard playback and registered participant practice are implemented and verified against an isolated local website. Production rollout requires source migration 014, its private-schema permissions and deployment. See the implementation record in 001 and the backend operating guide.

The user selected open practice entry for registered participants and approved five-minute admission plus fifteen-minute completion after admission closes. These use wall time independently of the playback track.

Approaches considered and rejected:

- Open the official competition temporarily: contaminates official participation and depends on official freeze/approval gates.
- Let seeking control public deadlines or existing attempts: rewinds irreversible human activity and permits indefinite admission through pause/replay.
- Reuse administrator-only test endpoints for participants: their ownership and authorization contract is wrong for public practice.
- Insert generated participants into official storage: makes analytics, exports, reminders and competition results unreliable.
- Automatically substitute synthetic exam questions in production: conflicts with current book/question provenance checks.
- Public practice leaderboard or scenario editor in the first release: unnecessary for the two requested actions.

No production data changes or deployments were performed. Existing uncommitted UI changes were preserved. Full unit, build, HTTP, PostgreSQL, staff-access and desktop/mobile browser checks passed; changed files are formatted, while the repository-wide formatter reports 57 pre-existing unrelated violations.
