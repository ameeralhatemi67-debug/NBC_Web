# Production OTP implementation and operator handover

Implemented on 2026-10-04 against `NBC_OTP_Production_Implementation_Spec.md` in this directory. Code and automated verification are complete. **Live production activation has not been performed**: no organization provider account, approved sender, production credentials, managed database, staff identity deployment, or real handset delivery was supplied or verified during implementation.

## Architecture and behavior

The existing two-step Arabic RTL registration/login UI calls a server-side OTP service. Registration holds validated pending data in a short-lived challenge; only successful verification creates the participant and an eight-hour session in one transaction. Login matches the keyed identity lookup and normalized registered phone before sending a fresh OTP, then resumes the same participant and saved attempt. Navigation and refresh reuse the session. Logout or expiry requires another OTP.

`Database` abstracts a PostgreSQL connection pool and local PGlite. Production requires PostgreSQL through `DATABASE_URL`. Explicit local demo/test mode retains PGlite convenience. Next.js was patched to 16.3.8; dependencies are pinned in the lockfile.

`OtpProvider` has Unifonic SMS and local fake implementations. The application generates and verifies OTPs. The fake provider is rejected in production; hosted Vercel always counts as production. Outside Vercel, deployments must set `NBC_RUNTIME_MODE=production`; explicit demo/test builds are local-only and must never be placed behind a public proxy.

Staff authentication uses Cloudflare Access human application JWTs verified by `jose` against the issuer's HTTPS JWKS. Signature, RS256 algorithm, issuer, audience, subject, expiry, issued-at, application token type, and maximum eight-hour token age are checked. Immutable subject allowlists assign admin/editor roles. Cloudflare/IdP must enforce MFA; the environment confirmation is an operator acknowledgment, not an independent MFA verifier. Editors cannot access any security setup/test/activation endpoint. Production ignores legacy/demo staff sessions and removes the role picker.

## Migrations and storage

Run `npm run db:migrate` with the actual deployment environment before releasing the app. The script reads process environment; it does not automatically load `.env.local`.

Ordered migrations are in `src/lib/migrations.ts`, tracked by `schema_migrations`, executed transactionally with a PostgreSQL advisory lock:

| Migration | Changes |
| --- | --- |
| `001_baseline` | Existing participants, sessions, questions, attempts, audit and settings schema, including demographic columns. |
| `002_secure_otp` | Session authentication source/actor; purpose-bound OTP challenges; shared security locks and rolling rate events; minimal security audit events; expiry/lookup indexes; readiness settings; identity-key fingerprint. |

Readable legacy National ID/Iqama values are converted to keyed HMAC lookups and valid phone numbers normalized. Existing participation records remain intact. Legacy sessions remain stored until retention cleanup but cannot authenticate in production. Migration refuses synthetic `DEMO-` identities in production; use a fresh production database. Existing malformed identities/phones require reviewed remediation before migration, not silent conversion or deletion. The old challenge table, if present, is unused and its expired records are covered by cleanup.

Production initialization never seeds synthetic participants. It initializes the existing example question set as **unapproved**; committee review is required before a competition can start. Default prizes and unpublished status are retained.

Provision UTF-8 PostgreSQL with verified TLS, least-privilege application access, managed backups/PITR, and an exercised restore procedure. Use a certificate-validating connection string suitable for the deployment (for example `sslmode=verify-full` with the managed provider's trust setup). The app does not disable certificate validation. Budget ten connections per application instance; use an appropriate managed pooler where needed. The test cluster is loopback-only and does not model production TLS.

Identity values use an independent `IDENTITY_LOOKUP_SECRET`; this secret must be retained securely alongside separately controlled recovery material. It cannot be casually rotated because an HMAC cannot recover the original identifier. Readiness rejects a key that does not match the database. Plan any rotation as an explicit data/reverification migration. Local PGlite restore removes sessions/challenges and resets activation, and refuses an existing destination. Production recovery uses PostgreSQL tooling, not the local backup endpoint.

## Provider documentation and decision

The adapter was implemented after reviewing current official documentation, including Context7 documentation lookup:

- [Unifonic SMS API overview](https://unifonic.readme.io/reference/sms-api), [SendMessage contract](https://unifonic.readme.io/reference/sendmessage), and [official first-SMS guide](https://www.unifonic.com/hubfs/Technical%20Writing/Sending%20Your%20First%20SMS%20via%20Unifonic%20API_Full.pdf).
- [Unifonic managed authentication documentation](https://docs.unifonic.com/articles/api-documentation/input-9). The reviewed material did not establish all required resend invalidation/purpose guarantees, so application-managed OTP was selected for this implementation.
- [Saudi sender registration NOC template](https://www.unifonic.com/hubfs/Technical%20Writing/NOC%20letter%20KSA.pdf) and [Unifonic SMS compliance documentation](https://docs.unifonic.com/articles/products-documentation/compliance-sms/). The organization must confirm the current account-specific sender process with Unifonic.
- [Twilio Saudi SMS guidelines](https://www.twilio.com/en-us/guidelines/sa/sms) identify domestic-brand registration restrictions; [Verify token/resend behavior](https://www.twilio.com/docs/verify/api/rate-limits-and-timeouts) also differs from the requested replacement behavior. It was not selected.
- [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) and [MFA policy requirements](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/).

Unifonic requests use HTTPS POST to `https://el.cloud.unifonic.com/rest/SMS/messages`, JSON fields `AppSid`, `SenderID`, `Recipient` (international digits without `+`), `Body`, and `CorrelationID`. The adapter requires the documented successful response shape/status/message ID, uses an eight-second timeout, rejects redirects, and sanitizes all provider errors. It does not automatically retry ambiguous sends; the failed challenge cannot authenticate and a later explicit request is subject to cooldown and budgets. `Sent`/`Queued` means provider acceptance, not handset delivery.

The health button makes a non-sending HEAD reachability probe to that documented endpoint. It is explicitly **not credential or sender validation**. A received OTP successfully entered by the admin is required to validate the actual account/sender/delivery path. No undocumented account/health API was invented. Provider dashboards may retain SMS bodies; restrict their access and establish vendor retention in the operational review.

## Security controls

- Cryptographic six-digit generation, five-minute expiry, maximum five failed code comparisons, constant-time keyed digest comparison, single use, and REGISTER/LOGIN/ADMIN_TEST purpose binding. The historical demo code is not an implicit production fallback.
- Sixty-second resend cooldown. A new send supersedes all older unused challenges for that phone and purpose. Production resends also avoid repeating the immediately preceding code. PostgreSQL row locks serialize challenge replacement, attempts, verification and shared rate reservations. Participant/session creation is atomic and unique identity conflicts fail safely.
- Per phone: five send reservations/hour and ten/day. Per IP: ten challenge/resend requests per ten minutes and sixty verification requests per ten minutes. Health probes: three/minute per admin. Failed sends consume quota; cooldown-rejected send reservations conservatively consume phone quota too. Counters persist across instances/restarts. Input-validation failures before issuing a challenge cannot trigger an SMS.
- OTP plaintext exists only transiently for sending/comparison. The database stores a challenge/purpose-bound HMAC, never the code. Successful/superseded challenges clear the digest and pending registration payload. No code in API responses, HTML, application logs, or audit events. Provider bodies are never logged or returned.
- Saudi mobile numbers normalize to E.164, accepting Arabic/Persian digits and common local/international forms. Public challenge responses include a masked destination. National ID/Iqama is HMAC indexed; audit/rate subjects are pseudonymous. Phone/name remain necessary personal data in protected server storage and require database access/retention controls.
- Generic login mismatch response does not reveal which of identity/phone failed. OTP proves phone access, **not National ID/Iqama ownership**. This is stated in the UI.
- Session bearer tokens are 32 random bytes; only SHA-256 hashes are stored. Production uses `__Host-nbc-session`, Secure, HttpOnly, SameSite=Strict, path `/`, eight-hour expiry. Existing valid sessions are not revoked by OTP maintenance mode.
- All mutations enforce the exact configured Origin and JSON requests. Request bodies are bounded to 24 KB while streaming, including requests without Content-Length. API responses/errors are no-store. Unknown errors are sanitized. Trusted proxy IP parsing rejects missing/multiple/invalid IPs.
- Secrets stay in server/deployment configuration. Readiness returns presence/status only. Configuration changes invalidate test evidence/activation through a server-only fingerprint. Activation is rechecked server-side, requires every readiness check, all acknowledgments, successful recent health (one hour) and real OTP verification (24 hours). Active operation does not require daily admin reactivation; an explicit failed health check, configuration change, acknowledgment change, or deactivation stops new auth.

Endpoints: POST `/api/auth/challenge`, `/api/auth/resend`, `/api/auth/verify`; GET `/api/admin/security`; POST `/api/admin/security/health`, `/setup`, `/test`, `/test-verify`, `/cleanup`. Admin tests bind to the authenticated admin and never create a participant or participant session.

Run `npm run db:cleanup` daily under the same secure environment. It removes challenges more than 24 hours past expiry, rate events older than 25 hours, idle lock rows older than 48 hours, expired sessions, and security events older than 90 days. Establish separate approved participant and backup retention schedules. Disable request-body capture in proxies/APM for authentication routes; the app cannot control external logging configuration.

## Admin workflow and exact remaining human steps

Admin > **إعداد التحقق والأمان** provides Arabic guidance and configured/missing status for database connection, migrations, UTF-8 and durable storage, Unifonic selection/credential/sender presence, independent security keys, HTTPS, persistent limits, trusted proxy, demo disablement, and staff authentication. It displays NOT_CONFIGURED / CONFIGURED / TESTED / ACTIVE / ERROR in Arabic, health/test timestamps, provider acceptance/failure/verification/rate-limit counts for the current Riyadh day, operational acknowledgments, cleanup, activation and deactivation. A database failure is visible to an otherwise authenticated admin; provider secrets are neither editable nor exposed in this UI.

Administrators/deployment owners must:

1. Provision the production database, verified TLS, backup/restore and daily cleanup job. Set deployment secrets and run migrations. Do not reuse the seeded demo database.
2. Create the organization's Unifonic account, complete KYC, arrange account funding and spending/abuse alerts, request a Saudi **transactional/OTP sender**, submit required organization/NOC/message samples and obtain provider/operator approval. Store the exact approved sender and AppSid in deployment configuration.
3. Configure Cloudflare Access with the organization's IdP and mandatory MFA. Protect `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`, and `/api/export` using the same application audience (configure all paths in the Access application). Keep participant pages and participant APIs public. Set session duration at most eight hours. Record the approved users' immutable JWT `sub` identifiers in the role allowlists, then confirm MFA configuration. Staff login/logout are handled by Access; browser logout uses `/cdn-cgi/access/logout`.
4. Set the canonical HTTPS origin. Configure a trusted edge to overwrite the chosen client IP header, strip client-supplied copies, and prevent requests bypassing that edge. With Cloudflare use `cf-connecting-ip`; use `x-vercel-forwarded-for` only when the Vercel edge is the verified source for the intended client IP. Test this in the actual proxy chain. Confirm anonymous and editor requests cannot access admin security APIs.
5. Generate two independent, cryptographically random 32-byte-or-longer hex secrets in the approved deployment secret manager. Keep them out of `NEXT_PUBLIC_*`, source control, browser fields and logs. Remove demo OTP/environment flags from production and deploy.
6. Open the Arabic readiness screen as an admin. Resolve every missing item. Run the provider connection check; send a test OTP to an authorized real Saudi handset and enter the received code. Confirm actual sender/content/delivery with the organization. Automated mocks do not fulfill this step.
7. Review privacy notice, vendor processing terms, SMS-content retention/access, data locations/transfers, incident contacts, participant/backup retention, cost alerts, and institutional requirements with responsible staff. Check the corresponding Arabic acknowledgments only after evidence exists; save them.
8. Click **تفعيل التحقق الفعلي**. Verify one real registration and returning-login flow, refresh/session reuse, logout, and recovery monitoring. Review/approve the competition's questions separately before launch. If anything fails, use **إيقاف التحقق مؤقتًا** and investigate through authorized provider/deployment tooling without logging codes.

## Environment variable names

| Name | Production requirement / purpose |
| --- | --- |
| `NBC_RUNTIME_MODE` | Required: `production`. Explicit `demo`/`test` only on isolated local environments. |
| `DATABASE_URL` | Required: durable UTF-8 PostgreSQL connection with appropriate TLS. Secret. |
| `OTP_PROVIDER` | Required: `unifonic`. |
| `UNIFONIC_APP_SID` | Required: provider credential, secret. |
| `OTP_SENDER_ID` | Required: approved sender name; current adapter accepts 2–11 permitted ASCII sender characters. Approval is separate from syntax validation. |
| `OTP_HMAC_SECRET` | Required: independent random hex, at least 64 characters. Secret. |
| `IDENTITY_LOOKUP_SECRET` | Required: independent random hex, at least 64 characters; must match database identity key. Secret. |
| `NBC_PUBLIC_ORIGIN` | Required: canonical HTTPS origin without path/query/fragment/credentials. |
| `CF_ACCESS_ISSUER` | Required: exact `https://<team>.cloudflareaccess.com`, no trailing slash. |
| `CF_ACCESS_AUD` | Required: Access application audience. |
| `NBC_ADMIN_SUBJECTS` | Required: comma-separated approved human JWT subjects. |
| `NBC_EDITOR_SUBJECTS` | Optional: comma-separated editor JWT subjects. Editors have no security setup access. |
| `NBC_STAFF_MFA_CONFIRMED` | Required: `true` only after enforcing and testing the IdP/Access MFA policy. |
| `NBC_TRUSTED_IP_HEADER` | Required: `cf-connecting-ip` or `x-vercel-forwarded-for`; edge configuration must support it. |
| `NBC_DATA_DIR` | Local PGlite directory only; ignored when PostgreSQL is configured. |
| `NBC_DEMO_OTP` | Explicit local six-digit fixture only; must be absent in production. No default code is silently chosen. |
| `NBC_DEMO_MODE`, `NBC_ALLOW_REMOTE_DEMO` | Legacy flags; must be absent or false in production. Remote demo access is unsupported. |
| `NODE_ENV`, `VERCEL` | Platform-managed runtime markers used for fail-closed production detection. Do not override to bypass it. |

Test scripts set `NBC_TEST_DATABASE_URL` internally or accept an explicitly isolated test database. It is not an application deployment variable. Never point tests at production. No real secret values are included in this handover.

## Verification results

- `npm run typecheck`: passed.
- `npm test`: 34 passed (domain, legacy migration, cryptography/OTP, provider contracts, shared limits, staff JWTs and request validation).
- `npm run build`: passed with Next.js 16.3.8.
- `npm run test:integration`: 43 passed (existing competition, reporting, authorization, persistence and backup/restore regressions).
- `npm run test:postgres`: 17 OTP/database tests passed on a real isolated UTF-8 PostgreSQL cluster, plus 17 production HTTP checks passed. Includes concurrent verification/resend/quotas, failed/ambiguous sends, production demo rejection, admin/editor isolation, activation evidence, secure sessions, logout/expiry and exact saved-participation resumption.
- `npm run format:check`: passed.
- `npm audit`: zero reported vulnerabilities after the Next.js patch update.
- Manual browser verification: Arabic RTL admin readiness and participant OTP views, masked phone and countdowns. Screenshots are local artifacts under `test-results/otp-ui/` (ignored by Git).

Production HTTP tests preload a scoped in-memory mock for only the documented Unifonic endpoint and test JWKS URL. They exercise the real production adapter and `jose` verifier. Test OTP capture is in memory/IPC, not HTTP responses or logs; assertions check absence from server logs and API data. No paid SMS was sent. This validates implementation behavior, not production account/sender approval or live delivery.

Final source review searches OTP literals, response fields, console logging, environment exposures and previous demo paths. Intentional OTP literals are local fixtures, negative tests, an explicit generator exclusion of the historical code, and historical/specification documentation. There is no live `demoCode` response or production fallback. Vendor responses and internal database errors are sanitized.

## Exact implementation file manifest

Added:

```text
docs/implementation/2026-10-04-production-otp.md
docs/implementation/NBC_OTP_Production_Implementation_Spec.md
scripts/cleanup.mjs
scripts/migrate.mjs
src/components/admin-security.tsx
src/components/otp-entry.tsx
src/lib/database.ts
src/lib/migrations.ts
src/lib/otp-crypto.ts
src/lib/otp-provider.ts
src/lib/otp-readiness.ts
src/lib/otp.ts
src/lib/request-security.ts
src/lib/runtime.ts
src/lib/security-store.ts
src/lib/staff-auth.ts
tests/migrations.test.ts
tests/mock-provider-network.mjs
tests/otp.test.ts
tests/postgres.mjs
tests/production-integration.mjs
tests/staff-auth.test.ts
```

Modified:

```text
.env.example
README.md
next.config.ts
package.json
package-lock.json
scripts/restore.mjs
src/app/admin/page.tsx
src/app/api/[...path]/route.ts
src/app/globals.css
src/app/register/page.tsx
src/app/terms/page.tsx
src/components/admin.tsx
src/components/registration.tsx
src/components/ui.tsx
src/lib/db.ts
src/lib/domain.ts
src/lib/service.ts
tests/integration.mjs
```

`next-env.d.ts` and `skill-observations/log.md` already had local changes when work began; they are not implementation changes. The ignored `.env.local` received only the three missing local defaults (`NBC_RUNTIME_MODE`, `OTP_PROVIDER`, `NBC_DEMO_OTP`) so local development remains usable. Existing environment values were not overwritten; no existing secrets were copied into this document.

## Remaining limitations and launch risks

Live provider delivery, Saudi sender approval, production database/TLS/backups, trusted edge behavior and real staff MFA remain external deployment verification steps, not completed claims. Readiness configuration badges establish presence and application checks; they cannot certify account ownership, regulatory approval, MFA enforcement or a secure proxy configuration by themselves.

SMS carries SIM-swap/reassignment and delivery risks. This flow provides phone possession only; identity ownership verification and assisted phone-change/account recovery require separate product policies and are not implemented here. Global provider spending controls and edge traffic protection remain necessary alongside the application phone/IP limits. Configure multi-instance connection budgets, monitor provider failures/rate limits and schedule retention. Independent production security review remains appropriate before accepting real participant data.
