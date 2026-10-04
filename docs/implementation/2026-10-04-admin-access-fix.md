# Admin access and public homepage repair

The production deployment had only legacy demo environment variables. The OTP upgrade therefore correctly disabled the demo staff picker but left no configured staff login. The homepage separately failed because reading prize settings required a missing production database.

The user selected Vercel account sign-in. `NBC_STAFF_AUTH=vercel` now provides an Arabic sign-in button at `/admin`, a standard OIDC authorization-code flow with S256 PKCE, state, nonce, and verified ID-token signatures through pinned `openid-client`. Authorization uses immutable Vercel account IDs, not email, username, or browser roles. Only `openid` is requested; no project, deployment, email, offline, or account-management permissions are required.

Staff sessions use a separate encrypted, Secure, HttpOnly, SameSite=Strict host cookie with a maximum one-hour lifetime. OAuth flow cookies are encrypted, last ten minutes, and use SameSite=Lax for the external callback. Every staff request revalidates the access token and matching subject with Vercel UserInfo. Logout revokes the provider token before clearing cookies. Removing an account from its allowlist or rotating the session encryption key invalidates access. Provider errors and tokens are not logged or returned to the browser. Staff login works without the competition database so administrators can inspect readiness while setting up storage. Competition changes still require PostgreSQL.

The homepage now renders public content and the about section during database setup/outages. Prize values are withheld with an Arabic availability message when they cannot be loaded. Saved prize settings remain authoritative when the database works; no default prize values silently replace them.

Cloudflare Access remains supported when `NBC_STAFF_AUTH` is unset or `cloudflare`. Vercel mode does not accept Cloudflare assertions. Participant OTP and participant sessions are unchanged.

## Vercel app setup

1. In the owning team's Settings > Apps, create `NBC Admin` with slug `nbc-admin`.
2. Configure authorization-code login, only the `openid` permission, and public-client authentication method `none`. PKCE S256 is mandatory in the application. This is a registered public OAuth client, not unauthenticated access to NBC. No client secret is used.
3. Register exactly `https://nbc-web-two.vercel.app/api/staff/callback` as the callback URL. Do not allow wildcard callbacks.
4. Set the production variables below in the NBC project. Enable MFA on every allowed staff account before setting its acknowledgment flag. The owner's connected Vercel account reported MFA enabled during setup.
5. Redeploy, open `/admin`, and use **تسجيل الدخول عبر Vercel** with an allowlisted account. Confirm the requested identity-only consent. The callback returns to `/admin`.

| Variable | Value or requirement |
| --- | --- |
| `NBC_STAFF_AUTH` | `vercel` |
| `VERCEL_APP_CLIENT_ID` | Registered NBC Admin app's client ID |
| `NBC_STAFF_SESSION_SECRET` | Independent cryptographically random 32-byte-or-longer hex secret |
| `NBC_VERCEL_ADMIN_SUBJECTS` | Comma-separated approved Vercel user IDs |
| `NBC_VERCEL_EDITOR_SUBJECTS` | Optional separate editor user IDs |
| `NBC_STAFF_MFA_CONFIRMED` | `true` after checking allowed accounts' MFA |
| `NBC_PUBLIC_ORIGIN` | `https://nbc-web-two.vercel.app` |
| `NBC_RUNTIME_MODE` | `production` |

Use secure server environment storage. Do not set any of these as `NEXT_PUBLIC_*`. The independent participant OTP, database and sender requirements in the original handover still apply. Adding Vercel staff access does not activate participant SMS authentication. Its readiness fingerprint includes the new staff configuration.

## Verification

`npm test` includes four new OAuth security tests. `npm run test:admin-access` runs the production HTTP app without a database and mocks only the official Vercel identity endpoints. It checks public-page availability, the initial sign-in link, end-to-end callback/session/role checks, editor isolation, invalid callbacks, revocation, CSRF protection and absence of tokens in application logs. Existing OTP/PostgreSQL and competition tests remain in place.

Official sources: [Vercel authorization API](https://vercel.com/docs/sign-in-with-vercel/authorization-server-api), [Vercel app configuration](https://vercel.com/docs/sign-in-with-vercel/manage-from-dashboard), and [OpenID Client](https://github.com/panva/openid-client). Current documentation was checked through official sources and Context7 before implementation.
