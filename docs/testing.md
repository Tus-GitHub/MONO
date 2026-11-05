# MONO regression testing

Run the fast suite with `npm test`. It checks pure rules, adapters, authorization/action boundaries
with mocks, and does not connect to PostgreSQL. Use `npm run typecheck`, `npm run lint`, and
`npm run build` for compiler, code-quality and production-build checks.

## Real PostgreSQL tests

`npm run test:integration` applies the checked-in migrations and exercises the services against
an isolated database. It verifies private review exports and ratings, locked plan mutations,
stale saves, concurrent submissions/reopens/lifecycle changes, activity ordering, actual SQL
constraints, timezone-boundary behavior, currency totals and standalone exports.

Most service tests simulate authentication with per-async-call user context so two partner
requests can execute simultaneously. Session tests use real signed JWTs and stored session rows;
archive tests also validate live approval sessions. Database calls and transactions are real. This is service integration testing;
full browser sign-up/login flows and real provider delivery remain separate checks.

Provide an empty local PostgreSQL database with a name beginning `mono_test_`. The launcher
requires an explicit URL and refuses remote hosts or other database names. Do not use a database
containing personal data. The application `.env` file is not edited.

PowerShell example, using a dedicated local database:

```powershell
$env:MONO_TEST_DATABASE_URL = 'postgresql://mono_test@127.0.0.1:55439/mono_test_audit'
npm run test:integration
```

On a fresh machine, initialize a separate PostgreSQL data directory, start it listening on
127.0.0.1 at an unused port, and create the dedicated test database first. The local audit pass
used PostgreSQL 17 on port 55439 with ignored files under `.postgres-test`. Stop the server after
the test run. Server installation and initialization are environment-specific; the runner does
not create a service or silently connect to the normal DATABASE_URL.

The tests create generated fixture users/spaces and clean up those exact IDs. The database keeps
its migration history so later runs verify an already-migrated database too. Expected constraint
and serialization failures may appear in Prisma's test log even when the assertions pass.

The checked-in GitHub Actions workflow supplies a disposable PostgreSQL 17 container with test-only
credentials and runs lint, type checks, unit tests, database tests and the build. The workflow has
read-only repository permissions. A separate browser job runs all registered E2E suites against its
own disposable database and retains only fixture screenshots/results for seven days; server
logs and storage files are excluded. The independent Vercel Git integration remains enabled. It will run after these changes are published.

## Schema changes in this pass

`20261105000000_integrity_and_plan_versions` adds Date.version, CHECK constraints and partial unique
membership indexes. The baseline and follow-up migration have been exercised sequentially on
an empty local test database. This does not verify an upgrade against existing personal data.
No migration has been applied to the existing application database. Preflight existing data
using `docs/sql/postgresql-audit.sql` and resolve invalid data
before running `npm run db:deploy` against the intended environment.

`20261105010000_durable_delivery_and_cleanup` adds per-browser subscriptions, delivery tasks,
cleanup tasks, and the due-reminder index. It migrates usable legacy subscription data and clears
the old JSON field. An isolated-schema regression test verifies that a shared endpoint belongs
to its latest recorded owner after migration. No existing application database has been migrated.

The generated Prisma client expects the new version column and reliability tables. Apply all pending migrations before starting
the updated app against an existing database. Keep migration and runtime credentials scoped to
the intended environment; do not point integration tests at that database.

## Reliability coverage

The full suite now has 212 unit tests and 75 PostgreSQL integration cases. Additional cases cover
multiple devices, transient push errors, competing workers, crashed leases, exhausted retries,
same-timestamp key rotation, category/membership changes, snoozed occurrences, old-history filters,
photo cursor ties, partial uploads, concurrent date deletion, profile image replacement, retained
media authorization and cleanup failure recovery. Push HTTP is mocked; the tests never contact
browser push services. Database transactions and local file operations are real.

The standalone worker also reports delivery and cleanup counts without logging endpoints, keys
or notification content. It retries persisted work even when no new reminders are due.

Read-only queue diagnostics are in [reliability-status.sql](sql/reliability-status.sql). FAILED
deliveries and cleanup tasks remain in the database for inspection. Retry is at least once;
provider acceptance does not guarantee device display. Scheduler activation is still required
for closed-app delivery and cleanup. A seven-day retention window does not replace independent
database/object backups. The portable archive API is a separate recovery option with explicit
active-content, privacy and size limits; see [archive/restore](archive-restore.md).

## Archive and account/session verification

The three additional migrations add AuthSession and ArchiveRestore, link push subscriptions to
sessions, and retire old unbound push capabilities. All six migrations are tested both as an
upgrade of the isolated test database and from scratch in an empty local test database. No live
database has been changed. Existing app cookies require a fresh sign-in after migration, and
the existing notification settings re-register the current browser's subscription.

Twelve archive cases use real PostgreSQL and local media: round-trip all supported content and
references, authorized media reads, blind-review filtering, exact/expired/revoked approvals,
tampering, replay and concurrent restores, media failures, newly added destination content,
membership changes during upload, missing source media, and rollback after a forced final update
failure. Eight route unit tests cover authenticated same-origin requests, body bounds and rate limits.

Ten account cases verify self-authorization, atomic closure, retained shared history, complete
rollback after the final user update fails, and deletion races with creation, invite-code join,
invitation acceptance and push registration. Addressed invitations cannot be consumed by another email.
Nine session cases verify real JWT authorization, individual/other/all-device revocation, linked
push cleanup, expiry and device limits, password change, reset and deleted-account rejection.
Additional units cover claim shape, revoked-cookie login routing and bcrypt UTF-8 byte bounds.

Those service tests do not exercise browser E2E or provider HTTP. The UI is unchanged; backend workflows
are described in [archive/restore](archive-restore.md) and [account sessions](account-sessions.md).

## Browser E2E

`npm run test:e2e` runs the actual app in installed headless Chrome/Chromium using the existing
`puppeteer-core` dependency. It starts its own loopback Next.js development server and requires
a separate PostgreSQL database whose name starts with `mono_test_e2e_`. It refuses remote URLs,
other names, and an occupied app port. It never connects using the normal application DATABASE_URL.

```powershell
$env:MONO_TEST_DATABASE_URL = 'postgresql://mono_test@127.0.0.1:55439/mono_test_e2e_browser'
npm run test:e2e
# Optional individual suites:
npm run test:e2e -- journey
npm run test:e2e -- account pagination
```

Create the isolated database and start local PostgreSQL first, as described above. Set CHROME_PATH
if Chromium is not in a recognized system location; MONO_E2E_PORT overrides the default 3217.
The runner generates ephemeral authentication configuration, uses local storage, disables external
providers, and applies checked-in migrations only to the explicit test database. Each suite gets
a fresh server process, so real rate limits remain enabled without interference between suites.
It uses temporary browser profiles and separate contexts, never your signed-in browser profile.

The four suites contain 36 named browser checks:

- `journey`: three real registrations/profile flows, two-person join and third-person denial,
  plan/calendar/custom place/budget/activity saves, lifecycle/recap, multipart photo uploads and
  offline retry, photo caption validation/best-photo controls, dialog/nested Back behavior,
  expense/memory forms, private reviews and mutual reveal, desktop and phone viewport pages.
- `account`: real UI login/reset/logout/deletion, stored cookie sessions, individual/other/all
  revocation, CSRF and cross-user denial, media access, archive download/privacy/dual approval/
  restore/replay, and the shipped service worker's offline fallback and private-cache exclusion.
- `workflows`: existing-plan edits and stale partner conflicts, draft duplication/deletion,
  cancellation redirects, expense validation with draft preservation, payer updates and removal.
- `pagination`: 53 photos sharing a completion timestamp across the 48-item boundary, no skipped
  or repeated photos, phone viewport fit, same-browser account switching with private/legacy
  memory drafts, memory save/remove/reopen.

Journey fixtures are created through the UI. Account/pagination/workflow fixtures use the database for
setup; their authentication, forms and controls cross real browser HTTP. PostgreSQL assertions
verify persisted results. The password-reset capability is seeded instead of sending mail.
The service worker is explicitly registered for its test because development mode does not
automatically register it. Production compilation is verified separately with `npm run build`.

Artifacts are under ignored `.postgres-test/e2e/<run-id>/`: screenshots, structured results and
local server logs. Logs can contain fixture-only reset URLs; do not publish them as general
application logs. The runner cleans its precisely scoped fixture users/spaces/cleanup jobs and
temporary media, stops the server/browser, and restores Next-generated configuration files.
It leaves PostgreSQL running for the operator to stop after testing.

These checks cover Chromium with phone viewport emulation. Real iOS/Android keyboard, installed
PWA behavior, HEIC decoding and actual SMTP/OAuth/S3/VAPID delivery still need device/provider
verification. Keys, production database migration and deployment remain deferred.
