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
read-only repository permissions. A browser matrix runs Chromium and Firefox against separate
disposable databases and retains only fixture screenshots/results for seven days; server
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

The full suite now has 240 unit tests and 82 PostgreSQL integration cases. Additional cases cover
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

Those service tests do not exercise browser E2E or provider HTTP. Settings interfaces and API
workflows are described in [archive/restore](archive-restore.md) and [account sessions](account-sessions.md).

## Browser E2E

`npm run test:e2e` runs the actual app in installed headless Chrome/Chromium using the existing
`puppeteer-core` dependency. `MONO_E2E_BROWSER=firefox` selects installed Firefox and its native
WebDriver BiDi compatibility suite. No new browser or application dependency is required.
The runner starts its own loopback Next.js development server and requires
a separate PostgreSQL database whose name starts with `mono_test_e2e_`. It refuses remote URLs,
other names, and an occupied app port. It never connects using the normal application DATABASE_URL.

```powershell
$env:MONO_TEST_DATABASE_URL = 'postgresql://mono_test@127.0.0.1:55439/mono_test_e2e_browser'
npm run test:e2e
# Optional individual suites:
npm run test:e2e -- journey
npm run test:e2e -- account pagination
npm run test:e2e -- settings
# Actual Firefox engine, with a new temporary profile:
$env:MONO_E2E_BROWSER = 'firefox'
npm run test:e2e -- compatibility
$env:MONO_E2E_BROWSER = 'chrome'
```

Create the isolated database and start local PostgreSQL first, as described above. Set CHROME_PATH
or FIREFOX_PATH if the selected browser is not in a recognized system location; MONO_E2E_PORT
overrides the default 3217.
The runner generates ephemeral authentication configuration, uses local storage, disables external
providers, and applies checked-in migrations only to the explicit test database. Each suite gets
a fresh server process, so real rate limits remain enabled without interference between suites.
It uses temporary browser profiles and separate contexts, never your signed-in browser profile.

Chromium runs six suites containing 64 named browser checks, including the 13 settings checks
described below. Firefox runs the 11-check
compatibility suite; the other four require Chromium-specific offline/timezone emulation and
are explicitly refused for Firefox rather than silently skipping those assertions.

- `journey`: three real registrations/profile flows, two-person join and third-person denial,
  plan/calendar/custom place/budget/activity saves, lifecycle/recap, multipart photo uploads and
  offline retry, photo caption validation/best-photo controls, dialog/nested Back/Escape behavior,
  photo-viewer keyboard trapping and scroll restoration,
  expense/memory forms, private reviews and mutual reveal, desktop and phone viewport pages.
- `account`: real UI login/reset/logout/deletion, stored cookie sessions, individual/other/all
  revocation, CSRF and cross-user denial, media access, archive download/privacy/dual approval/
  restore/replay, and the shipped service worker's offline fallback and private-cache exclusion.
- `settings`: password changes and all-device revocation, Google-only messaging, device list
  refresh, confirmed current/individual/other/all-device sign-out, portable archive download,
  invalid files and tampering, independent partner consent, cancelled and successful restores,
  restored media, repeated-restore blocking, offline recovery, and responsive settings pages.
- `workflows`: existing-plan edits and stale partner conflicts, draft duplication/deletion,
  cancellation redirects, expense validation with draft preservation, payer updates and removal,
  timezone/UTC-day-boundary edits and DST-gap correction, visible keyboard focus/Tab trapping,
  and 16 app routes (including every plan step) at 320/414/768/1024/1280/1536px plus phone landscape.
- `pagination`: 53 photos sharing a completion timestamp across the 48-item boundary, no skipped
  or repeated photos, phone viewport fit, same-browser account switching with private/legacy
  memory drafts, memory save/remove/reopen. A viewer must finish its synthetic history traversal
  before it disappears, so immediately following navigation cannot be cancelled by a late Back.
- `compatibility`: native keyboard login, individually named notification checkboxes and persisted
  preferences, plan date shortcuts/native time fields, review rating keys, blind submission/reveal,
  streamed locked-review redirects, multipart photo upload, viewer focus/history closure, private
  media, calendar keyboard links, manifest/icons/service-worker cache isolation, and five core
  routes at 320px with normal and 200% root text. Bounds and navigation-overlap assertions catch
  clipped controls that `document.scrollWidth` alone would miss.

All shared route checks reject HTTP 4xx/5xx. Spending is tested through the actual date's spending
section; `/expenses` is not an application page. Firefox BiDi may return no navigation response;
in that case the same browser session rechecks the final GET status. Each tab is activated before
interaction so native Firefox keyboard events reach the intended document.

GitHub runs each engine on Ubuntu 24.04 with its installed browsers and records actual versions
in results.json. Browser artifacts have distinct engine names. The explicit image avoids changes
to browser packaging during the `ubuntu-latest` image transition; see the
[GitHub runner software inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md).

Journey fixtures are created through the UI. Account/pagination/workflow fixtures use the database for
setup; their authentication, forms and controls cross real browser HTTP. PostgreSQL assertions
verify persisted results. The password-reset capability is seeded instead of sending mail.
The service worker is explicitly registered for its test because development mode does not
automatically register it. Production compilation is verified separately with `npm run build`.

Verified on 2026-11-06: implementation `9386ae6` passed
[GitHub run 42191624217](https://github.com/Tus-GitHub/MONO/actions/runs/42191624217):
51 Chromium checks (Chrome 156.0.8078.79), 11 native Firefox checks (Firefox 159.0),
234 unit tests, 82 PostgreSQL cases, lint, TypeScript and production build. The corresponding
Vercel production deployment is READY. Authenticated deployment reads of `/login` and
`/api/health` return 200; health reports database reachable. The follow-up notes commit `59f0d6b`
also passed [all three jobs](https://github.com/Tus-GitHub/MONO/actions/runs/42193211135).

The team alias requires Vercel sign-in in a fresh browser. Vercel also lists the canonical public
production URL [mono-kappa-beryl.vercel.app](https://mono-kappa-beryl.vercel.app). A read-only
Chrome 156.0.8078.80 smoke on that hostname passed login, registration and password-reset page
loads, signed-out `/home` redirection, anonymous session API denial (401), normal and 200% root
text at 320px, and absence of browser errors. No production forms were submitted or records
created. This public-page smoke is separate from authenticated local/CI feature testing;
deployment protection and keys were unchanged.

Artifacts are under ignored `.postgres-test/e2e/<run-id>/`: screenshots, structured results and
local server logs. Logs can contain fixture-only reset URLs; do not publish them as general
application logs. The runner cleans its precisely scoped fixture users/spaces/cleanup jobs and
temporary media, stops the server/browser, and restores Next-generated configuration files.
It leaves PostgreSQL running for the operator to stop after testing.

These checks exercise actual desktop Chromium and Firefox engines with phone viewport and root
text-size changes. They do not establish Safari behaviour, native browser zoom, physical
iOS/Android keyboard or installed-device PWA behaviour, camera/HEIC decoding, or actual
SMTP/OAuth/S3/VAPID delivery. Those device/provider checks and production-data migration readiness
remain separate. Integration keys are deferred; Vercel Git deployments remain enabled.

## Expense clock semantics

Expense records store real UTC instants. Browser `spentAtLocal` values are interpreted in the
couple timezone, independent of the server or travelling device timezone. The editor uses that
same timezone. Amount-only edits retain the stored seconds/milliseconds; an omitted time on an
update preserves the existing instant. Explicit Date or offset-bearing ISO instants remain
supported for service/API callers. Nonexistent DST-gap times are rejected with correctable
feedback; newly entered repeated clock times use the earlier occurrence. An unchanged field
preserves the original occurrence. Existing stored instants are not rewritten.
