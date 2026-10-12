# Admin access resume checkpoint

**Latest storage checkpoint (2026-10-04):** Staff authentication remains configured. The temporary BookQuest database connection has been revoked at the owner's request. Use only NBC Supabase project `eerfhnaduachqluowsdo` for the next backend phase. See [NBC_BACKEND_NEXT_SESSION_PROMPT.md](NBC_BACKEND_NEXT_SESSION_PROMPT.md); older database/setup notes below are historical.

Resumed at the user's request on 2026-10-04. The admin access repair is now deployed and verified with the owner's real Vercel account.

## Completed after resuming

- Registered `NBC Admin` (`nbc-admin`) in Vercel team `amir-3843`.
- Restricted provider sign-in to members of that team. NBC additionally checks its immutable staff subject allowlist.
- Configured public-client authentication `none`, identity scope `openid` only, and exact callback `https://nbc-web-two.vercel.app/api/staff/callback`.
- Saved production `VERCEL_APP_CLIENT_ID` in Vercel configuration and redeployed commit `1f8e7b4`.
- Deployment `dpl_7JYvrUzhcgVDjUwt48eTaM23kvdv` reached READY and serves `https://nbc-web-two.vercel.app`.
- Verified the homepage/about section, real owner sign-in, Arabic security readiness screen, persistence across page refresh, and logout on the live site.
- The database and participant OTP setup remain incomplete and are clearly displayed in Admin. No real SMS was sent and OTP activation was not enabled.

The following sections preserve the earlier checkpoint for context. Their pending sign-in items are superseded by the completion notes above.

## Saved work

- Commit `1f8e7b4a7450c71f4a42af998e32e721b4e89e75` was pushed to `origin/main`: Vercel staff sign-in and public homepage availability during database setup.
- Implementation and configuration details: `docs/implementation/2026-10-04-admin-access-fix.md`.
- Production deployment `dpl_B2zPVS7fC9ativsiprfuKbPpJk2G` was BUILDING at the last check. Its completion and live behavior have not been verified.
- Production configuration was saved for `NBC_STAFF_AUTH`, `NBC_STAFF_SESSION_SECRET`, `NBC_VERCEL_ADMIN_SUBJECTS`, `NBC_STAFF_MFA_CONFIRMED`, `NBC_PUBLIC_ORIGIN`, and `NBC_RUNTIME_MODE`. The session secret is stored only in Vercel sensitive configuration. Do not print it.
- `VERCEL_APP_CLIENT_ID` remains missing. Admin access deliberately remains closed until the registered client is configured.
- Production PostgreSQL and SMS provider setup remain outstanding. Vercel sign-in does not activate OTP.

## Validation completed

- Typecheck, build, format check, and git diff whitespace check passed.
- Unit tests: 38 passed.
- Integration tests: 43 passed.
- Production HTTP admin access tests with mocked Vercel identity endpoints: 8 passed.
- Dependency audit reported zero vulnerabilities.
- The PostgreSQL test command exited successfully but produced no test count; do not claim a confirmed PostgreSQL suite result from this run.
- Live Vercel sign-in has not yet been verified.

## Resume steps

1. Check repository status and the pending Vercel deployment for project `nbc-web` (`prj_wsjRUAqamQTgnYoNuZIOUi95pGJh`). Avoid overwriting local changes, including the task observation log.
2. Reconnect Chrome browser automation. The authenticated Vercel team is `amir-3843`. Inspect Settings > Apps for an existing `NBC Admin` / `nbc-admin` app before creating anything: clicking Save timed out, so creation outcome is unknown.
3. Finish the app registration using only `openid`, public-client authentication `none`, and exact callback `https://nbc-web-two.vercel.app/api/staff/callback`. The application already implements PKCE S256, state, nonce and signature verification.
4. Save the registered client ID as production `VERCEL_APP_CLIENT_ID`, then redeploy. Existing owner allowlist and MFA acknowledgment are configured. Do not replace authentication with a demo or shared role picker.
5. Verify the public homepage/about section and complete a real owner sign-in at `/admin`. Respect any human MFA prompt. Verify logout and readiness access.
6. Continue outstanding production database/provider readiness work within the original task scope. Never claim production OTP is active before actual provider credentials, sender approval, real testing and administrator activation.

Vercel connector calls worked when the explicit teamId was omitted; adding it resulted in a scope error. Browser timeouts were the reason for stopping setup, followed by the user's explicit pause. No further deployment or browser actions should be taken until they resume.
