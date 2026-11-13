# MONO account email

Credential registration creates the account/session, redirects to the normal onboarding flow,
then uses Next.js `after()` to send **Welcome to MONO** and **Verify your MONO email** independently.
Both reuse MONO's warm HTML layout and include plain-text alternatives. SMTP failures are logged
without addresses or links and do not invalidate the new account or suppress the other message.
Welcome is sent for a new credential registration, not for login or verification resends.

Email verification is required before creating or joining a space, including invitation links
and short codes. The service checks the current database value under the account write lock,
so hiding or bypassing the popup cannot bypass verification. Existing memberships and login
remain available; profile setup can be completed while waiting. Google sign-in continues using
Google's verified-email claim. Existing unverified owners must also verify before issuing links.

Unverified invite recipients see a verification popup after registration/login returns them to
their invite URL. It supports resend and a fresh account-status check after confirmation in
another tab. The original invite and entered short code remain in place; no invitation is
consumed and no space is joined until the verified user explicitly accepts. Resends and status
checks use the authenticated account, never a client-supplied user ID or mailbox.
An account-bound, HTTP-only three-day navigation hint also restores the invitation from the
confirmation page when email opens in the same browser tab. It cannot authorize a join, accepts
only a local invite token, is ignored for other accounts, and is cleared on logout or acceptance.

Space creation, invitation issuance and link/code joining use bounded 30-second transactions
with a 10-second acquisition wait. This addresses live Prisma P2028 failures from the default
five-second execution budget. Membership, invitation use and partner notification remain atomic;
only serialization/deadlock conflicts are retried, never an ambiguous transaction failure.

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

Historical production verification on 2026-11-10: implementation `7596136` is READY on Vercel after the
additive migration applied. A live registration reached onboarding; production SMTP accepted
the welcome and verification messages at 14:21:41 and 14:21:45 UTC. A subsequent verification
resend was accepted at 14:22:27 UTC. Health returned HTTP 200 with the database up. These checks
confirm provider acceptance; inbox placement was not observed.

On 2026-11-11, the full deployed flow was checked with an isolated temporary inbox: welcome,
verification and reset messages actually arrived, and their real links completed confirmation
and recovery. Initial service-worker activation now preserves registration drafts and scrubbed
verification capabilities. Password recovery uses the same visual shell in a public route group
so signed-in users can request/use links; successful recovery clears the current cookie and
revokes other sessions. Link replay, validation feedback and subsequent new-password login
were checked on the live origin. See `docs/testing.md` for the evidence and scope.

Deliverability audit on 2026-11-13: checked representative received welcome, verification and
password-reset messages in Gmail. All passed SPF, DKIM and DMARC, used the same Brevo replacement
sender (`brevosend.com`) and sending IP, and arrived after two seconds. Brevo lists only Gmail
senders, warns about freemail compliance, and has no authenticated custom domain. The user owns
only the app's `vercel.app` address, whose email DNS cannot be configured as an owned domain.
Brevo's automatic sender replacement already supplies authentication; failed authentication is
not established as the cause of reported spam placement. Current Inbox labels do not establish
original placement after the user moves a message. No content-only change or Brevo toggle can
guarantee inbox delivery. A custom authenticated sending domain is the next provider-level
improvement when available. No credentials, account-wide tracking settings or billing changed.
