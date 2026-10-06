# Admin sign-in loading diagnosis

The owner reported that the first Vercel sign-in click appeared to do nothing,
then repeated returns to the admin welcome page required 5–7 attempts.

## Verified findings

- In the owner's Chrome session, one sign-in activation eventually reached the
  dashboard. No credentials were entered and no consent settings were changed.
- Reloading the authenticated dashboard immediately showed the welcome page and
  sign-in link. The dashboard returned without any further sign-in activation.
- `Admin` deliberately rendered the anonymous entry screen before its session
  request and subsequent admin-data request completed. A returning user therefore
  saw an actionable sign-in link while already being authenticated.
- The native sign-in link had neither pending feedback nor a duplicate-click guard.
- Three anonymous requests to `/api/staff/login` returned valid 307 redirects to
  Vercel in approximately 0.30–0.42 seconds. These samples do not rule out
  intermittent provider or callback failures.

## Local changes

The server page passes only a staff-cookie-presence boolean to the client. A
returning user sees the existing loading status until the API has checked the
session and loaded admin data. Cookie presence is not authorization: the same
server verification and provider revalidation still decide access.

The anonymous entry page keeps its native sign-in URL, including without
JavaScript. A hydrated ordinary click immediately displays
`جارٍ الاتصال بـ Vercel…`, marks the link busy/disabled, and blocks duplicate
activation while navigation is pending. Modified clicks retain native behavior.
Returning through the back/forward cache resets the pending state. A failed OAuth
return continues to show the existing error and permits another attempt.

No authentication endpoint, token validation, cookie security attribute, schema,
production configuration, or production data was changed. Nothing was deployed.
This change is separate from the completed exam UX phases; Phase 4 was not started.

## Verification

Run through `scripts/local-ux-check.cjs` with disposable OS-temporary data and
environment-file loading blocked, in the real repository:

- Typecheck, formatting, and optimized build: passed.
- Unit tests: 67 passed. The initial sandbox invocation failed before tests ran
  because `tsx` could not read the Windows user record; the unrestricted safe
  wrapper invocation passed.
- Integration: 38 checks passed.
- Admin access: 10 checks passed, including returning-user loading HTML and
  rejected forged/unauthorized identities.
- `tests/admin-signin-ui.cjs`: four browser scenarios passed in headless Chrome:
  native anonymous sign-in without JavaScript; delayed session and data checks;
  invalid-cookie rejection; pending feedback, duplicate prevention, and retry
  after a failed return.

The browser fixture injects a synthetic cookie request header over localhost HTTP.
It does not verify cross-site production `Secure`/`SameSite` cookie behavior. Native
navigation is held by the fixture after the React click handler so feedback and
duplicate prevention can be inspected. Provider endpoints are mocked in access
tests, and browser API responses are controlled in the delayed-session scenario.

Screenshots: `test-results/admin-signin/session-check.png` and
`test-results/admin-signin/connecting.png` (ignored local artifacts).

## Remaining uncertainty

The full 5–7-attempt cycle was not reproduced. Provider failures can currently be
returned by `vercelStaffSession` as an absent session, which could also return a
user to the welcome page; this is a code-path observation, not a confirmed
production failure. The Vercel connector denied access to the deployment's team,
so correlated production runtime logs could not be inspected. Production logs
from an affected attempt are needed to distinguish callback failure, provider
timeout, and missing/invalid cookies. The confirmed UI defect is fixed locally;
the intermittent production cause remains unverified.
