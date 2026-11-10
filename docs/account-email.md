# MONO account email

Credential registration creates the account/session, redirects to the normal onboarding flow,
then uses Next.js `after()` to send **Welcome to MONO** and **Verify your MONO email** independently.
Both reuse MONO's warm HTML layout and include plain-text alternatives. SMTP failures are logged
without addresses or links and do not invalidate the new account or suppress the other message.
Welcome is sent for a new credential registration, not for login or verification resends.

Verification is optional for access. Existing accounts retain their login and onboarding behavior;
Google sign-in continues using Google's verified-email claim. Unconfirmed users see an onboarding
notice and can use Settings → Email verification or `/verify-email` to request a link.

Verification links last 24 hours. Their random capability is in the URL fragment, so it is not
sent in HTTP URLs. The page reads and removes the fragment without persisting it in drafts or
browser storage. Opening the page does not confirm anything: an explicit form POST consumes the
token. This avoids consuming links during mailbox scanning or prefetching.

Only a SHA-256 hash, intended user/email, expiry and timestamps are stored in
`email_verification_tokens`. The confirmation transaction locks the user, atomically claims one
unexpired/unused token, checks the current mailbox and account status, sets `User.emailVerified`
and retires other links. It never creates a session, changes passwords or completes onboarding.
Account closure deletes outstanding verification tokens.

Resends return the same generic response for unknown, confirmed, unavailable and throttled
accounts. Server actions limit requests by IP. A database cooldown permits one issue per user
per minute across instances; at most five unexpired links are retained. Resending does not
invalidate older unexpired links. Failed sends retain the cooldown because provider acceptance
can be uncertain after a timeout. Only the provider credentials already configured in Vercel
production are used; no additional integration keys are required.

Apply `20261110000000_email_verification` before running this version. It only adds the token
table, indexes and user FK; it does not mark existing addresses verified or change account access.
The Vercel release runs checked-in migrations before building. Its migration child uses a direct
Neon connection derived from the same endpoint, or an explicit `DIRECT_DATABASE_URL`; the app
keeps its existing runtime connection. This avoids session-level advisory locks through a
transaction pool. No advisory-lock safety checks are disabled.

Coverage includes template escaping/link safety, registration post-response dispatch, generic
action responses, real PostgreSQL hash/expiry/cooldown/replay/concurrency/deletion semantics,
provider failures and real browser registration, confirmation/resend, legacy access and layout.
SMTP acceptance is distinct from inbox placement; provider delivery is checked separately on
the deployed origin. Tokens and email bodies from the console driver are fixture-only artifacts
in local browser testing and must not be published as logs.
