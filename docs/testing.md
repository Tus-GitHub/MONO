# MONO regression testing

## SOCIAL branches, radius and explicit plan saves (2026-11-14)

New plans now use `/plan/new`: opening, changing steps, choosing a venue and adding activities
perform no shared date/place writes. Explicit Save commits the date, venue, activities and
creation event atomically. A nullable per-user draft key makes concurrent/retried saves
idempotent. Existing saved plans retain their editing flow; old user drafts were preserved.

Local right-panel verification used an isolated PostgreSQL database and two disposable local
accounts. A plan with Noida SOCIAL, INR 1500 and Coffee reached Review with **zero dates and
zero places** in SQL. Its device draft survived browser disconnection/restart. Save date then
opened the planned-date details; SQL confirmed exactly one date, one place and one activity.

The real Photon/IndiaRestros path returned five SOCIAL branches in a 20 km Noida search, with
separate IDs, addresses and distances. A 1 km search returned only Noida SOCIAL at 749 m.
Its real DLF Mall of India photo and full source address rendered; restaurant/bar classification
no longer blocks matching. Wider results also had matched Hauz Khas and Vasant Kunj photos.
Explore shares the same search controls, keeps a blank initial city, labels saved-only results,
and applies radius/distance to saved venues as well. Jaipur was a previously saved QA café,
not a default city. Photon still controls public venue coverage; missing photos are not invented.

Location is requested only from the button. Rounded coordinates stay in component state;
denial/unsupported/late callbacks and high-accuracy retry have unit coverage. The request has
a 30-second hard deadline plus Cancel location/manual-city fallback. Actual device GPS was
not acquired during agent testing.

Exact-word name matches keep actual SOCIAL outlets together; unrelated partial-word results
are excluded when actual brand matches exist. Fuzzy spelling remains a fallback.

Validation: 396 unit tests; full isolated DB suite 128 passed, then all 10 discovery regressions
passed after two additional radius tests (130 distinct integration tests total). Final targeted
53 photo/provider/location/action tests, TypeScript, full ESLint and final Webpack production
build passed. Local screenshots are
`.postgres-test/social-radius-preview.png` and `.postgres-test/social-explore-preview.png`.

## Full live invitation flow (2026-11-14)

Passed on bc0bc2c / production deployment dpl_GLtRwnxUBeqizLGJ7ZfsAJ7hpgYD using two disposable
accounts and actual inbox delivery. The owner registered, confirmed the received email, created
a space and generated a link. A new partner opened that link, registered, saw the verification
popup, remained blocked when attempting acceptance before verification, confirmed their real
email, returned to the original invitation in the same tab and explicitly accepted it. Connected
setup displayed both members. Database evidence: both emails verified, ACTIVE space, exactly two
active members, one accepted invitation and one PARTNER_JOINED notification. No “Something went
wrong” appeared and no production error/fatal logs were found in the test window.

Confirmation/navigation occasionally remained loading beyond a browser-automation wait; final
success was observed in both the UI and database. This verifies functionality, not a latency SLA
or Gmail/Outlook inbox placement. No production fixture was marked verified or joined via SQL.
After explicit user approval, identity/content/membership-guarded cleanup removed only this
run's two test accounts and empty space; zero test rows remain. Both disposable inboxes and local
private state were removed. Existing real accounts/spaces and application code were untouched.

Evidence: `.screenshots/live-invite-verification-6475e6cd4a.jpg`,
`.screenshots/live-invite-connected-6475e6cd4a.jpg`, and
`.postgres-test/live-invite-results-6475e6cd4a.json` (no credentials or verification capabilities).

## Required email verification and invitation recovery (2026-11-14)

- 346 unit tests and 113 isolated PostgreSQL tests pass, including account-bound invitation
  return hints, unverified create/link/code rejection, unchanged invitation usability after real
  email confirmation, replay rejection, and joins delayed beyond the previous five-second limit.
- The right-panel browser exercised real registration, optional profile setup, blocked unverified
  creation, the verification popup and a fresh status check, verified creation and link generation.
  A second account registered directly from that invitation, saw the automatic popup, requested
  a resend, confirmed its original email link and returned to the same invitation in the same tab.
  Explicit acceptance reached “You're connected” with both names. PostgreSQL confirmed ACTIVE,
  exactly two members and one PARTNER_JOINED notification. All accounts were disposable local
  fixtures; no production account or space was changed.
- Received production welcome, verification and password-reset samples were inspected in Gmail:
  all passed SPF/DKIM/DMARC through Brevo's replacement sender, and arrived after two seconds.
  These observations confirm delivery/authentication, not original inbox placement or future
  placement. Brevo warns about Gmail senders and has no custom authenticated domain. The user
  owns only the Vercel app subdomain. No sender, credential, global tracking or billing changes
  were made, and universal inbox placement cannot be guaranteed.
- TypeScript and lint pass. The default local Turbopack production build fails starting its CSS
  worker (process exits before IPC connection); the supported Webpack production build succeeds.
  This environment limitation is separate from the application tests and must not be described
  as a passing default build or a verified production deployment.

Publication on 2026-11-14 combined this work with the latest published auth-validation and
mobile-responsiveness releases. All 357 combined unit tests, lint and the npm Webpack build
pass. Hosted normal Turbopack compilation succeeded for 18ee493; production deployment
dpl_A8292GxEwFs2ebenKgqsipEpDt4d is READY on the canonical alias. Live health is 200/database up,
and the required-verification copy and page rendering were checked without authentication
submissions, production-account changes or email sends. No error/fatal logs found for that
deployment. The earlier default-build failure remains a local environment limitation.

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

The full suite now has 251 unit tests and 92 PostgreSQL integration cases. Additional cases cover
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

Chromium runs seven suites containing 71 named browser checks, including the 13 settings checks
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
- `registration`: real signup and post-response welcome/verification dispatch, private token
  fragments, explicit confirmation, generic resend responses and cooldowns, older-link validity,
  used/expired links, signed-out confirmation, legacy account access and responsive layouts.
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

## Production auth first visits

`npm run test:first-visit -- https://mono-kappa-beryl.vercel.app` runs three read-only Chromium
checks against a production build. It delays the first real service-worker registration until
the registration draft or verification form is ready, then verifies that initial activation
preserves the input/token without reloading. A real replacement worker waits for the Refresh
control, then reloads an already controlled page exactly once. It creates no accounts, sends no email and never submits
the fake verification capability. Screenshots/results stay under ignored `.postgres-test/first-visit`.

The account browser suite also exercises recovery while signed in: `/forgot-password` must
remain reachable, a reset on a second authenticated device clears that cookie and invalidates
the other device, and the new password permits a fresh login. Recovery shares the existing auth
visual shell but has its own public route group; login/registration keep their signed-in guard.

Live verification on 2026-11-11 (Asia/Calcutta), implementation `fc0ea27`: a new isolated test
account received the actual MONO welcome and verification emails in a temporary
[Mail.tm inbox](https://mail.tm). The real link confirmed the address in a fresh browser without
signing it in; its replay failed and the onboarding notice disappeared after reload. Login,
logout, duplicate/incorrect credentials, persistent secure HttpOnly SameSite cookies and
remember-me-off cookies were checked through the live UI.

Actual recovery emails were received and used from signed-in and signed-out browsers. Opening
the link did not consume it, mismatched confirmation preserved the current session, successful
reset cleared its cookie and invalidated both test devices, and replay failed. New-password
login completed its redirect and survived reload. Final database evidence showed the verified
address, two consumed reset links, no couple and zero active test sessions. These checks use a
separate fixture, preserving all real user accounts. They establish receipt in that test inbox;
they do not establish Gmail inbox placement or physical-device/Safari behavior.

The first long live runner timed out at its final redirect; independent fresh-browser login and
a focused reset-to-login repeat passed. The repeat resumed after a temporary inbox API error.
The initial failure artifact remains in ignored local output instead of being counted as a
fully passing runner. All 253 unit tests, full lint, TypeScript, production build, 12 local
account browser checks and three first-visit checks against both the local production build and
the live origin passed. No migration or production credential change was needed.
The exact synthetic account and temporary inbox were deleted with explicit user approval;
cascaded token/session counts were verified as zero and the private local test state was removed.

## Expense clock semantics

Expense records store real UTC instants. Browser `spentAtLocal` values are interpreted in the
couple timezone, independent of the server or travelling device timezone. The editor uses that
same timezone. Amount-only edits retain the stored seconds/milliseconds; an omitted time on an
update preserves the existing instant. Explicit Date or offset-bearing ISO instants remain
supported for service/API callers. Nonexistent DST-gap times are rejected with correctable
feedback; newly entered repeated clock times use the earlier occurrence. An unchanged field
preserves the original occurrence. Existing stored instants are not rewritten.

## Verification and connection latency (2026-11-14)

Mailbox confirmation/status/hint requests now return private JSON rather than an RSC tree
or a background Server Action. Confirmation has a 15-second client deadline with recoverable
feedback; a fresh session-bound check unlocks the invitation without two page refreshes.
The locked verification transaction uses two queries instead of six, preserving mailbox,
expiry, replay, sibling retirement and account deletion checks. Connection actions resolve
the destination before redirecting, and an eight-second pending hint offers a fresh status
navigation without submitting a second join.

364 unit tests and 114 tests against an isolated local PostgreSQL database passed, including
concurrent confirmation, replay/expiry, account closure races, unverified joins and delayed
link/code joins. TypeScript, targeted ESLint and the Webpack production build passed. The
initial sandbox build hit a Windows .next mkdir EPERM; the same build passed with normal
filesystem access.

Production 5bd1a57, READY deployment dpl_9yezvCYm8piKkM35sKqpd4sqFt9K, passed the
right-panel live run 92e6bc63ca. The owner created a space/link; the partner registered from
that invitation and received actual welcome/verification emails. An unverified status check
returned useful feedback, and Accept reopened the gate without joining. Actual confirmation
showed success in 305ms; the original popup's fresh check closed it in 508ms without a page
refresh. The email page's Return to your invitation opened the same link. Accept connected
the partner and reached their required profile in 879ms, then Continue reached the shared
setup showing both names. These are observed click-to-visible timings including browser
control overhead in one warm run, not an SLA or cold-start benchmark.

PostgreSQL independently confirmed two verified users, ACTIVE space, exactly two active
members, one accepted invitation and one joined notification. No “Something went wrong”
appeared; the deployment's error/fatal log query was empty. New confirmation left no token
fragment in the success-page URL. Screenshots and non-secret results are in ignored local
artifacts. Permanent cleanup of the exact fixtures/inboxes was requested; approval is pending.

## Plan-aware venue filtering (2026-11-14, local)

The Basics plan-type chips and recognized title terms select the matching Where category.
Adventure maps to Activities and Nature to Park; all venue categories, including Café,
Restaurant, Bar, Cinema, Museum, Shopping and Staycation, share the same filter path.
Manual overrides and All are supported. `dates.discoveryCategory` is nullable for legacy
plans, validates known keys, saves independently of a custom title, and survives copy and
archive restore. The additive migration has only been applied to the isolated local database.

The picker shows matching ideas with Add to plan separately from real saved/provider venues.
City filtering applies independently of venue-name text; mixed Staycation categories browse
hotels while retaining saved home places. Provider results with a mismatched category are
discarded. A request key and abort signal prevent an older category response from appearing
under a newer filter. Searches have a 15-second client deadline and retry feedback.

Right-panel local testing used two synthetic users, one draft and three clearly named venues
in an isolated PostgreSQL database. Adventure preselected Activities, displayed the saved
bowling venue and activity ideas, and Add Bowling created exactly one persisted activity.
Café displayed only the saved café. Restaurant with Jaipur showed no incorrect Delhi result;
switching the city to Delhi showed the restaurant. All restored all three venues. Choosing the
café and saving preserved the custom title and category; reload restored Café and the chosen
venue, and the Activities step retained Bowling. Screenshots are retained under ignored
`.screenshots/plan-adventure-filter-local.jpg` and `plan-cafe-filter-local.jpg`; non-secret
database evidence is in `.postgres-test/discovery-ui-results.json`.

Real public-provider checks also found and fixed a city-layer regression: `layer=city` omitted
Jaipur, Rajasthan and returned same-named villages. The updated area lookup preserves provider
relevance, validates city/area candidates, and avoids using a venue as the city center. Repeat
café and activity searches returned venues in Jaipur Municipal Corporation. Results still
depend on upstream coverage; no exhaustive worldwide listing is promised.

382 unit tests, all 118 isolated database integration tests, TypeScript, full ESLint and the
Webpack production build passed. No live account, plan, migration,
provider credentials or deployment was changed. Couple messaging is explicitly the next update.

### Publication and location follow-up (2026-11-14)

Initial release a95439b deployed successfully and applied the nullable category migration.
Live real-venue Adventure and Café searches passed, as did Add Bowling in a separately named
QA draft. Testing All with a selected city exposed missing external browsing; the follow-up
uses a combined venue-category query for All and keeps city/region matching across saved city
and address fields. Real public-provider All searches returned mixed café, restaurant and
hotel categories in Jaipur, Rajasthan.

User additionally requested Use my location beside City or area. The explicit button uses
the browser permission flow, rounds coordinates to three decimals, and holds them only in
the current picker. Manual city entry cancels location acquisition and switches modes.
Denial, unsupported browsers, ignored permission prompts (12-second fallback), and late
callbacks after cancellation have unit coverage. Search uses the selected category or All
within 20 km and displays distances; distant and unknown-location results are excluded.
No real device location was acquired during agent testing. Synthetic points exercise the
nearby provider and database path. Native device permission remains a device/browser check.

The follow-up passed all 389 unit and 122 isolated database integration tests, TypeScript,
full ESLint and the Webpack production build before publication. The initial location-helper
lint finding (prefer-const) was corrected before the final clean lint/build gate.

Final 7554357 is live on READY deployment dpl_7kB1rqiupAw7qQ84ZsUtBkm34xSJ. Production
health returned 200/database up; error/fatal logs were empty during the test window. Live
All + Jaipur/Rajasthan returned mixed categories, Café and Restaurant each returned 20
matching venues, and the location button appeared beside the manual city field. Requests
with the synthetic point 26.915/75.819 returned 20 mixed nearby venues (eight categories,
maximum distance 0.370 km) and 20 cafés (maximum distance 1.280 km), with no distant results.

QA draft cmwg2h9kg0001jt076tb15r6d retained the custom QA title, cafe category, actual Cafe
Coffee Day selection and exactly one Bowling activity through save/reopen. PostgreSQL
independently confirmed these fields and showed the pre-existing draft was still version 0
with no added activity/place. The separately named QA draft/café remain available for review;
there was no permanent deletion. The old whole-space fixture cleanup request is stale because
this space now contains a pre-existing user-created draft. Final screenshot and non-secret
result JSON are `.screenshots/live-filter-location-7554357.jpg` and
`.postgres-test/live-filter-results-7554357.json`. Actual device GPS consent was not exercised.

## iOS keyboard, safe areas and landscape (2026-11-14)

The user selected automated checks only because this Windows workspace has no connected
iPhone. Playwright WebKit on Windows exercises the browser engine with explicit simulated
visual-viewport, safe-area and standalone values. This is not branded Safari, a native iOS
keyboard or an actual home-screen installation. See the [Playwright WebKit limitations](https://playwright.dev/docs/browsers#webkit).

Before the fix, a read-only live WebKit check classified 2x pinch zoom as an open keyboard.
Registration's confirmation field ended at 652px with the simulated visible edge at 430px,
and no corrective scroll occurred. The manifest also requested portrait-only orientation.

Viewport geometry now includes the visual viewport's top offset and excludes pinch zoom
from keyboard detection. Focus correction consumes nested scroll areas before the page,
and keyboard occlusion creates enough page scroll room without doubling the gap in a
content-resizing browser. Fixed sheets, dialogs and photo viewers use both visible edges.
Short dialogs scroll as a whole so their footer remains reachable. Opening focus traps
preserve a field already focused inside the sheet instead of taking that focus away.

Shared safe-area tokens keep app/setup headers, navigation, page content and viewer
controls clear of cutouts and the home indicator. Header height includes the top inset;
scroll locks preserve side padding. Landscape is allowed by the manifest; the worker cache
version advances so an existing installation can refresh its precached manifest. Existing color,
typography, spacing and component design remain the reference. Geometry follows
[VisualViewport's layout-relative offsets](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport/offsetTop)
and [scale](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport/scale), with
[WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).

The isolated local database contains only generated fixtures. The optimized build runs
with the supported test environment and normal database-backed signed sessions. Only the
local harness removes CSP's HTTPS-upgrade directive for loopback HTTP; the live HTTPS
deployment retains and separately verifies its production headers. No product dependency,
database schema, provider credentials or production account is changed by this work.

All 300 checks passed across WebKit and Chromium, browser/standalone simulation, light/dark,
320/390/430px portrait and 844/932px landscape safe-area profiles. Coverage includes
registration/profile focus, first navigation tap after keyboard dismissal, pinch zoom,
rotation, content-resizing keyboard gaps, confirmation footers, venue search sheets and
photo captions. Twenty-five public-page regression samples passed at 768–3840px. There were
no page errors. The newer published plan release 81694ed was preserved before publication;
27 targeted WebKit/PWA checks passed again against that merged optimized build, including
an explicit check that each keyboard target retained focus. All 404 unit tests, full ESLint,
TypeScript and the production build passed. The existing worker activation test now also
checks retirement of both v3 caches while retaining v4. No physical iOS result is claimed.

Release e14197b is live at https://mono-kappa-beryl.vercel.app on READY deployment
`dpl_7iFGQchx2u3B6tvthNRrCsodStwt`. Seventeen read-only live checks passed: public form
focus within simulated keyboard bounds, safe-area widths, first-tap navigation, pinch zoom,
production CSP retention, actual Chromium service-worker activation with v4 caches and the
landscape-enabled cached manifest, offline fallback and online recovery. No page errors or
error/fatal deployment logs were found in the checked window. Existing installations can
reopen MONO and choose Refresh when the update banner appears. The dedicated local synthetic
database and generated fixture storage were removed; reports/screenshots remain ignored.
Native iOS Safari, its actual keyboard and a physical home-screen installation remain
unverified, as agreed with the user.
