# NBC Web — Production OTP & Authentication Implementation Specification

**Repository:** `https://github.com/ameeralhatemi67-debug/NBC_Web`  
**Purpose:** Convert the existing simulated participant OTP flow into a production-ready Saudi SMS OTP authentication system, while preserving the current UX and competition behavior. Add an Admin-side setup/readiness workflow so the software can be fully implemented by the coding agent and the remaining external/human steps can be completed and verified by authorized admins.

---

## 1. Current repository state

The project already contains a strong OTP-shaped authentication flow.

Relevant areas:

- `src/components/registration.tsx`
  - Registration and returning-user login
  - Two-step flow:
    1. identity + phone / registration data
    2. OTP verification
  - Currently displays a simulated OTP.
- `src/lib/service.ts`
  - `challenge(...)`
  - `verify(...)`
  - 5-minute challenge lifetime
  - maximum 5 incorrect attempts
  - single-use challenge
  - participant is created only after successful verification
  - sessions are random tokens and stored as hashes
- `src/lib/db.ts`
  - currently uses local PGlite
  - `participants`, `sessions`, `challenges`, `attempts`, `audit`, etc.
- `src/app/api/[...path]/route.ts`
  - API router
  - session cookie is `HttpOnly`, `SameSite=Strict`, secure on HTTPS
  - current session lifetime is 8 hours
  - contains demo-only staff authentication
- `src/components/admin.tsx`
  - admin/editor area with tabs for overview, participants, questions, results, reports, audit
  - current staff authentication is demo-only.
- `tests/integration.mjs`
  - already tests OTP-like challenge expiry/tries/single-use behavior and participant sessions.

The current demo code must remain useful for local development, but it must be impossible for a production deployment to silently fall back to the demo OTP.

---

## 2. Authentication behavior to implement

### 2.1 New participant registration

Flow:

1. Participant enters registration information.
2. Server validates input.
3. Server normalizes the Saudi phone number.
4. Server creates an OTP challenge.
5. Server sends the OTP by SMS to the participant's phone.
6. Participant enters the 6-digit OTP.
7. Server verifies the OTP.
8. Only after successful OTP verification:
   - create the participant record;
   - create the authenticated session;
   - redirect to `/participate`.

Do **not** create a real participant before phone verification succeeds.

### 2.2 Returning participant login

Flow:

1. Participant enters:
   - الهوية / الإقامة
   - رقم الجوال
2. Server matches the two values to an existing participant without revealing which individual field matched or did not match.
3. Server sends a new OTP to the registered phone.
4. Participant verifies the OTP.
5. Server creates a new participant session.
6. Existing attempt/answers are loaded and the participant resumes the competition.

### 2.3 OTP frequency

OTP is required for **every new login/session**, not only the first registration.

OTP is **not** required for:
- page refreshes;
- normal navigation;
- saving answers;
- opening the book;
- every API call.

Once OTP succeeds, the participant uses the normal authenticated session until logout or session expiry.

Keep the current 8-hour session duration initially unless repository constraints require a change.

### 2.4 Session behavior

Preserve the current good properties:
- random high-entropy session token;
- only a hash of the token stored server-side;
- `HttpOnly`;
- `SameSite=Strict`;
- `Secure` in production HTTPS;
- server-side expiry;
- logout revokes the session.

For production, prefer the cookie name `__Host-nbc-session` if compatible with the deployment.

---

## 3. Saudi phone normalization

Accept reasonable user input forms, including Arabic digits where the existing app already supports them.

Examples that should normalize to one canonical representation:

- `0551234567`
- `551234567`
- `966551234567`
- `+966551234567`

Canonical server-side format:

`+966551234567`

The UI may continue to display the familiar Saudi local form where appropriate.

Store a single canonical format for real phone numbers.

---

## 4. OTP policy

Default production policy:

- 6 numeric digits.
- 5-minute lifetime.
- single use.
- maximum 5 verification attempts per challenge.
- resend cooldown: 60 seconds.
- a newly issued/resend OTP invalidates the previous OTP for that login attempt.
- default send limits:
  - max 5 sends per phone per hour;
  - max 10 sends per phone per day;
  - max 10 OTP requests per IP per 10 minutes before blocking or requiring stronger anti-abuse handling.
- rate limiting must work across multiple application instances; do not use process-local memory in production.
- prefer PostgreSQL-backed rate limiting to avoid introducing another paid service unless a better already-connected infrastructure exists.
- use generic, non-enumerating login errors.
- do not reveal whether the identity exists separately from whether the phone exists.

Add clear retry metadata to APIs where useful (`retryAfter`, `expiresIn`) without leaking sensitive information.

---

## 5. OTP generation and storage

### Preferred approach

If the selected Saudi-compatible provider offers a reliable managed verification/OTP API, prefer provider-managed verification after checking the provider's **current official documentation**.

### If the application generates the OTP

Use a cryptographically secure random generator.

Never:
- return the OTP in an API response;
- place it in HTML;
- place it in client state before the user types it;
- log it;
- store it as plaintext;
- hash a 6-digit OTP with plain unsalted SHA-256 and assume it is safe.

Store a keyed digest such as:

`HMAC-SHA256(server_secret, challenge_id || purpose || otp)`

Use a server-only secret configured in production.

Use constant-time comparison where applicable.

---

## 6. Challenge model

Replace/upgrade the generic demo `challenges` design with a production OTP model.

Recommended conceptual fields:

```text
otp_challenges
--------------
id
participant_id nullable
purpose
phone_e164
provider
provider_reference nullable
otp_digest nullable
payload_json
attempt_count
send_count
last_sent_at
expires_at
used_at nullable
created_at
request_ip_hash nullable
```

Purposes should be explicit:

- `REGISTER`
- `LOGIN`

Design so future purposes can be added safely:
- `CHANGE_PHONE`
- `RECOVERY`

An OTP created for one purpose must never be accepted for another.

Store only the minimum temporary registration payload required to finish account creation after verification.

Expired/used challenges should be cleaned up by a defined retention policy.

---

## 7. National ID / Iqama handling

The existing OTP verifies phone possession. It does **not** independently prove ownership of the Saudi National ID/Iqama.

The UI/documentation must not claim that OTP verifies the identity document itself.

Review whether the real National ID/Iqama needs to be stored at all.

Preferred privacy-preserving design if staff do not need the readable number later:

- canonicalize the identity number;
- create a keyed HMAC lookup value;
- store the lookup HMAC instead of the plaintext number;
- use the HMAC for duplicate detection and returning-user lookup.

If the application truly needs the readable number later:
- store an encrypted value;
- also store a keyed lookup hash/HMAC;
- never expose it to normal admin exports unless explicitly required by the product.

Do not migrate synthetic demo identities into the production database.

---

## 8. Production database

The existing PGlite storage is suitable for local demo/testing, but not for a real Vercel-style production deployment.

Implement durable managed PostgreSQL support.

Preferred implementation characteristics:

- production uses `DATABASE_URL`;
- local demo/tests can retain PGlite if that materially helps the repository;
- do not use `/tmp` as the authoritative production database;
- add real schema migrations;
- keep transactions around security-sensitive flows;
- handle concurrent verification/resend requests safely;
- use indexes/constraints for uniqueness and rate-limit queries;
- do not seed demo participants into production.

If Supabase PostgreSQL is used, treat it as managed PostgreSQL; do not unnecessarily couple participant OTP to Supabase Auth unless there is a clear architectural reason.

---

## 9. SMS / OTP provider abstraction

Implement a small server-side provider abstraction rather than spreading vendor-specific code through authentication logic.

The coding agent must:

1. Verify current official provider documentation before implementing the production adapter.
2. Select at least one production provider that supports Saudi Arabia and the project's sender/OTP requirements.
3. Prefer a provider-managed verification API if appropriate.
4. Keep a local development adapter for tests/dev only.
5. Make it impossible to use the development adapter in a production deployment.

Provider secrets must never be sent to the browser.

Suggested interface concept:

```ts
interface OtpProvider {
  createChallenge(input: {
    phoneE164: string;
    purpose: 'REGISTER' | 'LOGIN';
  }): Promise<{
    providerReference?: string;
    expiresIn: number;
  }>;

  verifyChallenge(input: {
    providerReference?: string;
    challengeId: string;
    code: string;
  }): Promise<{ verified: boolean }>;

  healthCheck(): Promise<{
    ok: boolean;
    message?: string;
  }>;
}
```

If the chosen provider only sends raw SMS, adapt the implementation while keeping equivalent separation of concerns.

---

## 10. Secrets and configuration

**Do not turn the NBC admin page into a homemade secrets vault.**

The admin page should be the human setup/control center, but provider API secrets should normally live in deployment secret storage/environment variables unless a proper external secret vault is intentionally added.

Production configuration should include clear names such as:

```text
DATABASE_URL=
NBC_RUNTIME_MODE=production
OTP_PROVIDER=
OTP_PROVIDER_API_KEY=
OTP_SENDER_ID=
OTP_HMAC_SECRET=
IDENTITY_LOOKUP_SECRET=
```

Use provider-specific variables where required by the official API.

Requirements:
- secrets are server-only;
- never return secret values from an admin API;
- admin UI may show only `configured / missing`, not the value;
- logs must not print secrets;
- production mode must fail closed when critical configuration is missing;
- no `123456` fallback in production.

---

## 11. Admin-side OTP Setup & Readiness Center

Add a new admin-only tab, for example:

**الإعدادات والأمان** or **إعداد التحقق**

This is where the remaining human work is explained, validated, and completed operationally.

Only the `admin` role may access it. `editor` must not.

### 11.1 Readiness dashboard

Show clear status cards:

#### Database
- Production database connected
- Migrations current
- Durable storage confirmed

#### SMS provider
- Provider selected
- API credentials detected
- Sender ID configured
- Provider health check
- Production adapter active

#### Saudi sender setup
Human instructions:
- create/verify the organization's SMS provider account;
- complete any organization/KYC requirements;
- register/approve the sender name/ID required for Saudi delivery;
- enter the approved sender ID in deployment secrets;
- wait for provider/CST/carrier approval where applicable.

The page should explain that these steps occur outside the NBC application and cannot be automated by the website itself.

#### Security
- OTP HMAC/verification secret configured
- identity lookup secret configured
- HTTPS/prod cookie readiness
- rate limiter ready
- demo OTP disabled
- demo staff login disabled

#### Policy / privacy operational checklist
Provide a non-legal-advice checklist for the organization:
- Privacy Policy reviewed for phone/SMS processing
- chosen SMS processor/vendor reviewed
- data-processing/cross-border considerations reviewed
- incident contact/process recorded
- retention policy reviewed

Do not allow these checkboxes to imply legal certification. Label them as internal readiness acknowledgements.

### 11.2 Test SMS

Once provider configuration is detected, allow an authorized admin to:

1. enter a Saudi test phone number;
2. request a test OTP/SMS;
3. verify the test code;
4. see pass/fail diagnostics.

Rules:
- use the exact production provider path;
- apply sensible test rate limits;
- never show the generated OTP server-side;
- never put provider secrets in the response;
- audit who ran the test and whether it succeeded;
- mask the phone number in logs/audit.

### 11.3 Activation gate

Add a server-enforced production OTP status.

Suggested states:

```text
NOT_CONFIGURED
CONFIGURED
TESTED
ACTIVE
ERROR
```

The "Activate real OTP" action should only be possible when:
- production database is ready;
- required provider config exists;
- provider health check succeeds;
- a test verification has succeeded recently;
- demo OTP is disabled.

Activation must be enforced server-side, not just hidden in the UI.

If OTP is not active in production, participant registration/login should show a safe maintenance message rather than falling back to a fake code.

### 11.4 Operational metrics

Add useful admin visibility without exposing sensitive information:

- OTP sends today
- successful verifications today
- failed verification attempts
- rate-limit blocks
- provider send failures
- most recent provider health-check timestamp
- OTP mode/status

Do not expose:
- OTP codes
- full provider credentials
- full National IDs
- unnecessary full phone numbers

---

## 12. Participant UI changes

Preserve the existing design and Arabic RTL visual language.

In `registration.tsx`:

Remove the demo block that displays `123456`.

Step 2 should instead say approximately:

> أرسلنا رمز التحقق  
> تم إرسال رمز مكوّن من 6 أرقام إلى 05••••••34.  
> ينتهي الرمز خلال 5 دقائق.

Add:
- six-digit OTP input;
- resend countdown;
- resend button when allowed;
- clear expired-code state;
- clear too-many-attempts state;
- clear rate-limit state;
- ability to go back and correct details;
- accessible live status/error messages.

Do not redesign the page unnecessarily.

---

## 13. API design

The existing routes may be kept or cleaned up.

At minimum support the equivalent of:

```text
POST /api/auth/challenge
POST /api/auth/verify
POST /api/auth/resend
POST /api/auth/logout
GET  /api/session
```

Add admin endpoints for safe readiness/config status, provider health test, test OTP flow, activation, and metrics.

Requirements:
- strict body validation;
- request-size limits;
- same-origin/CSRF protection consistent with the current app;
- `Cache-Control: no-store` for auth/admin responses;
- no OTP or secret leakage;
- safe error messages;
- server-side authorization on every admin route.

---

## 14. Rate limiting / abuse protection

Implement distributed/persistent limits.

Track at minimum:
- phone-based sends;
- IP-based challenge requests;
- verification attempts;
- resend attempts.

Prefer hashing phone/IP keys used only for abuse counters where raw values are not required.

Protect against:
- OTP pumping;
- brute-force verification;
- concurrent resend races;
- concurrent verify races;
- replay of a used challenge;
- generating multiple active codes and accepting an old one.

Add cleanup for expired counters/challenges.

---

## 15. Staff/admin authentication

The current `auth/demo-staff` route is demo-only and must never provide production admin access.

At minimum:
- production must disable/remove the demo staff login path;
- Admin OTP settings/readiness must be protected by real staff authentication;
- editor cannot access security/provider configuration.

Prefer integrating a standard, audited staff authentication solution with MFA/passkeys/TOTP rather than inventing custom administrator password crypto.

If implementing full staff authentication is too large for the same change, the code must still:
- fail closed in production;
- keep OTP secrets/config out of the admin UI until a real admin session exists;
- clearly document the remaining staff-auth blocker;
- never ship a "choose Admin" button in production.

The coding agent should implement as much of the production staff-auth path as is reasonable within this repository rather than leaving demo auth exposed.

---

## 16. Privacy and audit requirements

Update the site's privacy/terms content as appropriate to describe:
- phone number collection;
- phone verification/account security purpose;
- use of an external communications/SMS processor;
- retention at a high level;
- that phone OTP verifies access to the phone and not ownership of the National ID itself.

Audit security-relevant events without storing secret content:

Examples:
- OTP challenge requested
- OTP send succeeded/failed
- OTP rate limit triggered
- OTP verification succeeded/failed
- admin ran provider health test
- admin ran test OTP
- production OTP activated/deactivated
- security configuration readiness changed

Mask phone numbers and avoid National IDs in the audit log.

Never log OTP codes.

---

## 17. Demo mode

Keep a useful local demo path if practical.

Requirements:

- fixed demo OTP may exist only when explicitly running local/demo mode;
- it must be visibly marked as simulation;
- it must never be reachable when `NBC_RUNTIME_MODE=production`;
- production startup/readiness checks must detect and reject unsafe demo configuration;
- integration tests must prove production cannot accept `123456` as an implicit fallback.

---

## 18. Migration strategy

The agent must inspect the current repository before editing and create a safe migration plan.

Expected actions:

1. Introduce production DB abstraction/migrations.
2. Preserve local demo/test behavior where reasonable.
3. Add OTP provider abstraction.
4. Implement rate limits and secure challenge storage.
5. Wire the participant UI to real OTP.
6. Add admin OTP setup/readiness center.
7. Replace/disable demo staff auth for production.
8. Update docs/env example.
9. Update privacy/terms content where appropriate.
10. Extend unit/integration tests.
11. Run all project checks.

Avoid a giant rewrite of unrelated competition functionality.

---

## 19. Required tests

Add/adjust automated tests for at least:

### Registration
- new participant is not created before OTP verification;
- successful OTP creates exactly one participant;
- duplicate concurrent verification does not create duplicate participants.

### Login
- valid identity+phone can request OTP;
- mismatches use safe generic errors;
- successful OTP resumes the correct participant;
- no password is required.

### OTP
- Arabic digits accepted where intended;
- Saudi phone normalization;
- 6-digit validation;
- expiry after configured period;
- 5 failed attempts exhaust challenge;
- single-use;
- resend invalidates previous code;
- resend cooldown;
- hourly/day phone send limits;
- IP rate limit;
- concurrent resend safety;
- concurrent verify safety;
- replay rejection;
- OTP never appears in normal API JSON;
- OTP never appears in logs/test snapshots.

### Sessions
- OTP success creates authenticated session;
- refresh/navigation does not require OTP;
- logout revokes access;
- expired session requires a new OTP login.

### Production safety
- production cannot use fixed demo OTP;
- production cannot use local/dev provider;
- missing provider configuration fails closed;
- provider send failure does not create a participant/session.

### Admin
- editor cannot access OTP settings;
- unauthenticated users cannot access OTP settings;
- secrets are never returned;
- readiness states are correct;
- test SMS path works with a fake provider in automated tests;
- activation is impossible before readiness conditions pass;
- activation works after readiness/test passes;
- metrics contain no OTP code/full ID data.

### Existing competition behavior
Retain existing tests for:
- answer saving;
- concurrent saves;
- final submission;
- question version freezing;
- results publication;
- admin/editor authorization;
- export behavior.

---

## 20. Acceptance criteria

The work is complete when:

1. A real participant can register using a real Saudi phone number and receive a real SMS OTP once the provider account is configured.
2. A returning participant receives a new OTP for every new login/session.
3. A valid session does not request OTP again on every page.
4. The fixed demo code cannot work in production.
5. OTP codes are never returned, logged, or stored in plaintext.
6. Abuse limits prevent unlimited SMS pumping.
7. Production data uses durable PostgreSQL.
8. Admins have an Arabic admin setup/readiness screen telling them exactly which external human steps remain.
9. Admins can test the SMS/OTP path and see readiness/health.
10. Real OTP cannot be activated until readiness checks pass.
11. Demo staff login is not a production admin-auth backdoor.
12. Existing competition flows still work.
13. Typecheck, tests, build, integration tests, and formatting checks pass.
14. `.env.example` and README/docs explain deployment and human setup.
15. The final report clearly separates:
    - implemented automatically;
    - external human/provider steps still required;
    - exact environment variables/settings the admin/deployer must provide.

---

## 21. Human steps that should remain after implementation

The application cannot legitimately automate these external actions. The Admin setup page should make them explicit and track their readiness:

1. Choose/create the SMS provider organization account.
2. Complete provider KYC/organization verification if required.
3. Request/register/approve the SMS sender name/ID for Saudi delivery.
4. Obtain production provider credentials.
5. Place secrets into the deployment's secure secret/environment system.
6. Configure `DATABASE_URL` and production security secrets.
7. Redeploy/restart if the hosting platform requires it.
8. Open the NBC Admin "OTP Setup & Readiness" tab.
9. Confirm all configuration checks are green.
10. Send a test OTP to an authorized test phone.
11. Verify that test OTP.
12. Review the internal privacy/vendor-readiness checklist.
13. Activate production OTP.

The software should guide these steps clearly in Arabic and make the current status obvious.

---

## 22. Non-goals

Do not:
- redesign the whole competition site;
- require OTP for each question/save/page;
- claim SMS OTP verifies ownership of National ID/Iqama;
- expose provider secrets to the browser;
- store OTP in plaintext;
- keep PGlite `/tmp` as production source of truth;
- leave `auth/demo-staff` usable in production;
- silently fall back to `123456`;
- create a fake legal-compliance certification;
- add marketing SMS to OTP messages.

---

## 23. Implementation quality

Prefer:
- small cohesive modules;
- explicit types;
- migrations;
- clear server/client boundaries;
- fail-closed production behavior;
- good Arabic UX;
- accessible forms/status messages;
- comments only where the security reasoning is non-obvious;
- tests around security boundaries;
- minimal changes to unrelated code.

Before finalizing, inspect the diff for accidental OTP/secret logging and run a repository-wide search for:
- `123456`
- `demoCode`
- provider secrets
- debug logging of request bodies
- plaintext identity/OTP persistence

Any intentional demo-only occurrence must be guarded and documented.
