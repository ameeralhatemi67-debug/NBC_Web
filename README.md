---
type: guide
tags: [nbc, implementation, demo]
created: 2026-09-08
updated: 2026-09-08
---

# NBC competition demo

An Arabic, RTL demonstration of the **Contemporary Heritage** direction: warm stone surfaces, olive typography, restrained copper details, and balanced editorial motion.

Start with [[00-Implementation-Index]] for delivery status and [[00-NBC-Research-Index]] for the underlying research.

## Run locally

Requires Node.js 22.19 or a compatible supported newer version. Dependencies are pinned in the lockfile.

```powershell
npm ci
npm run build
npm run start
```

Open [the demo](http://127.0.0.1:3000) or [the committee workspace](http://127.0.0.1:3000/admin). For development, use `npm run dev` instead. Run one application process per database directory.

To launch a hidden preview on Windows after building:

```powershell
powershell -NoProfile -File scripts/preview.ps1
```

The script records its PID in `tmp/server/preview.pid` and logs in `tmp/server`. Stop only that preview process when needed. If the application reports that its port is occupied, use another port or stop the known preview; do not stop unrelated services.

## Try the demonstration

1. Register with a synthetic four-part name, a ten-digit synthetic identity starting with 1 or 2, and a synthetic mobile number starting with 05. Do not enter real personal data.
2. Use the visibly disclosed simulated OTP **123456**. Each challenge expires after five minutes and permits at most five incorrect attempts.
3. Start the ten-question sample participation. Open the reading panel, revisit questions, reload after a confirmed save, review, and submit.
4. Open `/admin` and choose the explicit local committee demo entry. The editor entry demonstrates restricted content permissions.
5. Review reports, tied scores, question versions, grade publication, reminder previews, and the audit trail.

> [!important] Demonstration boundaries
> SMS and identity verification are simulated. The reading material, questions, names, and results are synthetic. The official book is not included. This is a local presentation system, not a production deployment or an official competition website.

## Data and recovery

The local database uses **PGlite**, an embedded PostgreSQL build, stored in `.data/nbc`. The server owns this database; participant data is not stored in browser local storage. Browser session storage contains reading preferences only.

The committee overview offers a private `.tar.gz` database backup. To restore, use a **new** directory:

```powershell
node scripts/restore.mjs path/to/nbc-demo-backup.tar.gz .data/restored-demo
$env:NBC_DATA_DIR = '.data/restored-demo'
npm run start
```

Restoration refuses existing destinations and invalidates old sessions and OTP challenges. PGlite snapshots are for compatible PGlite versions; they are not a portable production PostgreSQL migration format.

For a fresh rehearsal, stop the preview, set `NBC_DATA_DIR` to a new path such as `.data/rehearsal-02`, and restart. The database seeds six synthetic participants and ten questions automatically. Existing data is preserved.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration
npm run format:check
```

Integration tests run a separate server on port 43187 and use unique databases under `.data`. They do not modify the presentation database. Results are written to `test-results/integration.json`. Some managed Windows sandboxes require permission for the local test port and test-runner OS access.

## Structure

- `src/app`: routes, styles, and authenticated server API.
- `src/components`: Arabic participant and committee interfaces.
- `src/lib`: sample reading content, question seeds, validation, scoring, database, and service logic.
- `tests`: domain and isolated API/recovery checks.
- `docs/implementation`: scope, evidence coverage, demo script, and production dependencies.

## Hosting boundary

The npm scripts bind to loopback. Remote demonstration requires explicit configuration and synthetic data only. Setting `NBC_DEMO_MODE=false` disables this demo API; a real authentication and integration implementation must replace the demo entry points before production. A managed PostgreSQL service, deployment scaling, actual institutional policies, and service contracts remain separate work.

No code or design is submitted to the organizer automatically.
