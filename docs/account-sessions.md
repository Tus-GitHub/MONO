# Account and session controls

These backend controls preserve the existing settings screens and styling. No provider keys
are needed. Apply the pending migrations before running the updated application against a
database. Existing stateless cookies require sign-in again; legacy push capabilities without
a device-session binding are retired. The existing notification settings re-register that
browser when opened; no subscription is silently shared with a different account.

## Sessions

Every login creates an `AuthSession` under a user row lock. The signed HS256 cookie contains
only a user ID, token version and session identifier. Protected requests verify the stored
owner, version, revocation and expiry as well as the signature. A reset, password change,
all-device logout or account deletion invalidates all old credentials for session issuance.
Authentication that finished hashing before one of those changes cannot create a live session.

Remember-me tokens use `SESSION_MAX_AGE_DAYS`; unchecked remember-me uses a one-day token and
a browser-session cookie. Up to 20 devices remain live per account; signing in beyond that
revokes the oldest. Expired/revoked rows are removed on the next login. Last-seen timestamps
update at most once per five minutes. Stored labels contain only coarse browser/platform names,
not raw user-agent strings, IP addresses, passwords or bearer tokens. Labels identify software,
not a verified physical device.

| Endpoint | Request | Result |
| --- | --- | --- |
| `GET /api/account/sessions` | Current session cookie | Up to 20 live sessions with ID, label, created/last-seen/expiry timestamps and `current` flag |
| `POST /api/account/sessions` | `{"action":"revoke","sessionId":"..."}` | Revokes only an owned session and its linked push device; clears the cookie if current |
| `POST /api/account/sessions` | `{"action":"revoke-others"}` | Preserves the current session, revokes other owned sessions and their linked push devices |
| `POST /api/account/sessions` | `{"action":"revoke-all"}` | Increments token version, revokes all sessions, removes all push subscriptions and clears cookies |
| `POST /api/account/password` | `{"currentPassword":"...","password":"...","confirmPassword":"..."}` | Verifies current password, updates hash atomically, revokes all sessions/reset links/push devices, clears cookies; sign-in required |

Responses use `Cache-Control: no-store`. Mutations require JSON and an `Origin` matching the
configured `APP_URL`; cross-site fetches are refused. Bodies are bounded to 8 KiB from actual
streamed bytes, independent of the Content-Length header. Password changes are limited to five
attempts per account per 15 minutes by the existing per-instance limiter. APIs never accept a
target user ID. Session IDs alone cannot authenticate: the signed cookie is also required.

Password strength applies to register, reset and change alike: at least ten characters, mixed
case and a digit, and at most 72 UTF-8 bytes (bcrypt's limit). Login remains compatible with
existing password hashes. Google-only accounts cannot change credentials through this password
endpoint; they use Google sign-in or the existing reset flow. No provider credentials are added.

Logout now revokes the database session before clearing its cookie. It also removes this
browser's push capability while preserving other browsers. If the database is unavailable,
cookie cleanup still succeeds; server-side revocation cannot be guaranteed until connectivity
returns. A copied cookie for that session can remain usable until expiry in that failure case.
Push workers recheck linked session state before sending, although a provider request already
in flight cannot be recalled. Revocation applies to subsequent authorization checks, not to
private content a device has already downloaded.

## Account deletion

The existing typed DELETE action remains unchanged visually. Deletion is one serializable
transaction: revoke sessions and integration capabilities, invalidate reset/invite tokens,
archive shared spaces, retire memberships and mark the user deleted. Shared authored history
is retained for the other person's recovery policy; this is soft account deletion, not a
claim of irreversible data erasure. See `docs/security.md` and the integration tests.

## Verification

`test/integration/sessions.test.ts` uses real PostgreSQL and signed JWTs for cross-user denial,
current/other/all-device revocation, linked push cleanup, expiry, device bounds, password change,
reset and deleted-account rejection. Unit checks cover claim validation, configured-origin and
streamed-body limits, bcrypt byte bounds, cookie cleanup and the revoked-cookie login redirect
regression. The local integration runner never falls back to the application database URL.

`test/e2e/account.mjs` adds real Chromium verification through the running Next.js application:
UI login, password reset, account deletion and logout; authenticated session/password API calls;
cross-user and cross-origin denial; and revoked-cookie navigation back to the login screen.
Fixture identities and the reset token are seeded in an isolated local PostgreSQL database,
while cookies, authentication, forms and controls use real HTTP. The suite runs in development
mode with email, Google, storage-provider and push integrations disabled; it does not claim live
provider delivery or physical-device verification. See [browser E2E testing](testing.md#browser-e2e)
for setup, coverage and retained diagnostic artifacts.
