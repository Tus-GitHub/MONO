# MONO Project and PostgreSQL Audit

Date: 5 November 2026

Scope: current local codebase, Prisma schema, checked-in migration, and product roadmap.

Implementation update following this audit: the first remediation pass now fixes the export/
place-rating privacy paths, server-side plan locking, stale form saves, review/lifecycle write
races, and the identified countdown/reminder/local-day calculations. Currency totals are grouped
and date expense writes enforce a common currency. A second migration adds plan versions and
initial SQL constraints; it was applied only to an isolated local test database. The real
PostgreSQL suite now passes 82 cases; 234 unit tests pass. A CI workflow and `docs/testing.md` now
cover repeatable verification. A second remediation pass adds durable per-browser delivery,
multiple subscriptions, orphan/deletion cleanup with a seven-day retention window, media access
revalidation, and correct long-history/photo pagination. The findings below describe the original
audit state. A third remediation pass adds bounded active-content media archives, dual-approval
restore into an empty space, revocable per-device sessions, password changes and atomic account
closure. See `docs/archive-restore.md` and `docs/account-sessions.md` for the new controls and
`docs/testing.md` for current verification totals. Database tests use isolated local PostgreSQL.
Authorized Git pushes now deploy through Vercel; production migration readiness and configured
provider delivery still need verification with the intended environment.

MONO has the main features of a useful private app for two people: planning, a shared calendar,
date-day tools, independent reviews, spending, photos, memories, and recommendations. The next
priority is making those features consistently enforce their rules. This audit identifies
privacy bypasses, incomplete server-side plan locking, inconsistent time calculations, and
currency aggregation errors. These deserve attention before expanding the feature set.

PostgreSQL is a suitable database for this application. Keep the relational model and Prisma;
strengthen constraints, transactions, recovery, and integration testing. A database replacement
would not resolve the application defects identified here.

The audit covers the working tree after commit `43543f6`, including the subsequent local fixes.
The latest validation in this chat passed 144 tests in 25 files, lint, TypeScript, the production
build, and focused browser checks for drafts and unsaved forms. Those checks do not establish
that database concurrency, exports, or every authenticated journey is correct. The findings
below come from source inspection; race conditions are identified as risks rather than claimed
as reproduced database failures. No live database inspection or deployment was performed.

## Current functionality

| Area | Implemented in the codebase | Remaining work |
| --- | --- | --- |
| Identity | Password login, signed sessions, password reset, Google sign-in, session invalidation | Provider verification, stronger account controls, database integration tests |
| Couple space | Create/join, expiring invitation links, two-member service rule, profile, archive/disconnect | Database safeguards and explicit recovery/retention behavior |
| Planning | Basics, budget, places, ordered activities, duplication, lifecycle transitions | Enforce editability in every mutation; protect simultaneous edits |
| Calendar | Month/day views, upcoming dates, countdowns, history | Consistent couple timezone, stable pagination, external calendar export |
| During a date | Start/complete, now/next activities, actuals, quick expenses and photos | Midnight/travel/timezone cases, duplicate-submit protection |
| Reviews | Individual drafts, submission, reveal, category scores and reflection prompts | Apply privacy rules to exports and place totals; make reveal transitions atomic |
| Memories | Shared memory, favorites, photo wall, timeline, best photo | Complete portable archive, consistent deletion behavior, optional resurfacing |
| Expenses | Line items, categories, splits, expected versus actual spend | Totals by currency and a defined currency precision policy |
| Discovery | Saved/custom places, optional Google Places, deterministic recommendations and feedback | Broader shortlist workflow, optional search improvements |
| Notifications | In-app records, Web Push adapter, scheduler endpoint, standalone worker | Durable external retry, multiple browser subscriptions, quiet hours |
| PWA | Installable shell, offline fallback, local drafts, upload retries | Full device QA; no general offline mutation queue or cross-device draft sync |

Configured integrations and verified live integrations are different states. SMTP, S3-compatible
storage, Google, and Web Push implementations exist. Their credentials and production activation
remain deferred at the user's request.

## Findings to address

P1 means fix before relying on the affected feature with private data. P2 means complete in the
next reliability pass. P3 means a later enhancement. The priorities reflect this app's private,
two-person scope rather than an assumed public launch at scale.

### F01 Export bypasses private review reveal

**P1, confirmed in source.** `exportCoupleData(coupleId)` selects every date's reviews, including
draft scores and reflections. It receives no viewer identity and applies no reveal check. The
authenticated export route passes only the couple ID. Either member can therefore export the
other member's private draft or submitted-but-unrevealed review.

Evidence: [account-service.ts](../src/server/services/account-service.ts), `exportCoupleData`,
especially the `reviews` selection; [export route](../src/app/api/export/route.ts).

Fix: build one server-side review visibility policy used by screens, derived totals, search,
and exports. Export the viewer's own review and shared revealed reviews. Exclude the partner's
unrevealed scores, notes, and reflections.

Acceptance: with only partner A's draft or submission present, partner B's export contains none
of A's private fields. After both submit, both exports contain the intended shared results.

### F02 Place totals can reveal a partner score early

**P1, confirmed in source.** The shared place-history helper and the place detail service collect
submitted ratings without requiring both partners to submit. If a place has one visit and one
submitted review, its displayed average discloses that review's score. The main review/history
screens already contain reveal checks, but the place path does not consistently use them.

Evidence: [place-history.ts](../src/server/services/place-history.ts), `getPlaceHistoryMap` and
`score10`; [place-service.ts](../src/server/services/place-service.ts), `datesHere` and
`coupleScore10`; [place-detail.tsx](../src/components/places/place-detail.tsx).

Fix: only include reviews from revealed dates in shared place averages and recommendation inputs
that could expose those averages. Keep visit counts independent of review visibility.

Acceptance: submitting one partner's review changes no shared rating, ranking explanation, or
exported aggregate that exposes the private score. Test the one-visit case explicitly.

### F03 Plan locking is enforced on reads but missing from mutations

**P1, confirmed in source.** `getPlan` and `finalizePlan` check `EDITABLE_STATUSES`.
`updateBasics`, `updateBudget`, and planned-activity mutations authorize ownership but do not
check that the date is still editable. `authorizeDate` checks membership and soft deletion,
not lifecycle state. A stale tab or direct Server Action request can edit a completed plan.

Evidence: [plan-service.ts](../src/server/services/plan-service.ts), `EDITABLE_STATUSES`,
`getPlan`, `updateBasics`, `updateBudget`, `addActivity`, and related mutations;
[couple.ts](../src/lib/authz/couple.ts), `authorizeDate`.

Fix: centralize plan editability and enforce it within each write transaction. Recheck the parent
date status when modifying activities. Preserve the separate right to edit actuals after completion.

Acceptance: basics, budget, place, activity add/update/delete/reorder all reject locked dates,
including when completion happens concurrently with a save.

### F04 Wall time and real instants are mixed

**P1, confirmed in source.** Planning intentionally stores wall-clock values as UTC-encoded
timestamps, such as `19:00Z` meaning the entered local time of 19:00. Some display helpers respect
that convention; reminder arithmetic and countdowns treat those values as real UTC instants.
Calendar promotion and finalization also derive today from UTC rather than the couple timezone.

For example, 19:00 in Asia/Kolkata corresponds to 13:30 UTC. Treating the stored `19:00Z` value
as the real instant moves a start-relative reminder 5 hours 30 minutes later. The 09:00 day-of
reminder already uses a timezone helper, showing that the inconsistency is between paths.

There is a separate countdown defect: UpcomingList supplies the start time for the initial label,
but supplies the calendar-day timestamp as the live target. The label can change its meaning
on the first 30-second refresh.

Evidence: [plan-service.ts](../src/server/services/plan-service.ts), `combineWall` and
`finalizePlan`; [reminder-service.ts](../src/server/services/reminder-service.ts),
`ensureRemindersForDate`; [calendar-service.ts](../src/server/services/calendar-service.ts),
`promoteDueDates`; [upcoming-list.tsx](../src/components/dates/upcoming-list.tsx).

Fix: separate calendar days, local event times, event timezones, and delivery instants. Use the
same resolved instant for initial and subsequent countdown labels. Convert existing wall values
according to their intended timezone rather than merely changing the SQL column type.

Acceptance: test Asia/Kolkata, UTC, a DST-observing zone, local midnight, a missing start time,
and an event viewed while travelling. PostgreSQL distinguishes `date`, `timestamp`, and
`timestamptz`; the latter stores an instant, not the original IANA zone name.
[PostgreSQL date and time types](https://www.postgresql.org/docs/current/datatype-datetime.html)

### F05 Money totals combine different currencies

**P1 when more than one currency is used, confirmed in source.** Expense input and stored rows
allow different currency codes. Couple insights sum `amountCents` across those rows, then label
the sum with the couple's current currency. Per-date totals have similar assumptions. Changing
the profile currency does not convert earlier transactions.

Evidence: [expense-service.ts](../src/server/services/expense-service.ts), `addDateExpense`;
[couple-insights-service.ts](../src/server/services/couple-insights-service.ts),
`prisma.expense.aggregate` and `totalSpendCents`; [history-service.ts](../src/server/services/history-service.ts),
`expenseSum`.

Fix first: group totals by currency and enforce a consistent currency within each date if a
single-currency date is the chosen product rule. Never relabel old amounts as converted amounts.
If conversion is added, store the original amount/currency plus the rate, conversion date, and
converted amount.

The code also consistently scales money by 100. Define whether this is intentionally a restricted
two-decimal representation or genuine currency minor units; currency precision is not universally
two decimal places. Keep integer or exact decimal arithmetic.
[ISO currency codes and minor units](https://www.iso.org/iso-4217-currency-codes.html)

Acceptance: adding 100 USD and 100 INR never produces a single total labelled 200 USD or 200 INR.

### F06 Review reveal and lifecycle changes have race risks

**P1, code-level concurrency risk.** Review write/reopen/delete operations read submission state
before their mutation transaction. Another partner can submit between the check and the write.
Lifecycle transitions similarly check a loaded status and later update by ID without matching
the previously read status. Simultaneous plan saves use last-write-wins behavior.

Evidence: [review-service.ts](../src/server/services/review-service.ts), `writeReview`,
`reopenReview`, `deleteReview`; [date-service.ts](../src/server/services/date-service.ts),
`transitionDate`; [plan-service.ts](../src/server/services/plan-service.ts).

Fix: move checks and dependent writes into the same transaction. For review reveal, serialize
mutations using a consistent parent-date lock or a carefully designed serializable transaction
with retries. For status/plan changes, use a version field and a conditional update. Keep
external provider calls outside retryable transactions.

The existing `serializable` helper already retries Prisma P2034 conflicts for couple joins.
Extend that approach where the same invariant requires it, rather than assuming a transaction
around only the final writes protects earlier reads.
[Prisma 6 transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)

Acceptance: simultaneous submit/reopen/delete cannot alter a revealed review; conflicting saves
produce explicit feedback rather than silently replacing newer work.

### F07 External reminder delivery has no durable retry

**P2, confirmed design gap.** The in-app notification and reminder claim are committed atomically,
which protects concurrent dispatch. Push happens afterward and is best-effort. A temporary push
failure leaves the reminder marked sent, with no pending retry record. Per-reminder database
failures are logged inside `dispatchDueReminders`, so the outer scheduler's `failedUsers` count
can remain zero despite a failed reminder insert.

Evidence: [reminder-service.ts](../src/server/services/reminder-service.ts),
`dispatchDueReminders`; [reminder-scheduler-service.ts](../src/server/services/reminder-scheduler-service.ts).

Fix: add a delivery/outbox record in the same transaction as the in-app notification. Track
channel, attempts, next attempt, last error, and delivered time. Use a bounded worker with
retry/backoff and an observable final-failure state. Network delivery may be retried and must
not be described as exactly-once. PostgreSQL `FOR UPDATE SKIP LOCKED` can support competing
queue workers if that becomes necessary.
[PostgreSQL SELECT locking](https://www.postgresql.org/docs/current/sql-select.html)

Acceptance: a simulated provider outage leaves a visible pending delivery that later succeeds;
database failures appear in scheduler results as well as logs.

### F08 Push subscriptions support one browser per person

**P2, confirmed model limitation.** One JSON `pushSubscription` is stored on each user's notification
preferences. Enabling a second browser replaces the first. Removing an expired subscription can
also race with a newly saved subscription because cleanup clears by user rather than endpoint.

Evidence: [notification-preference-service.ts](../src/server/services/notification-preference-service.ts),
`setPushSubscription`; [channels.ts](../src/lib/notifications/channels.ts), `PushRelayChannel`;
[schema.prisma](../prisma/schema.prisma), `NotificationPreference`.

Fix: a PushSubscription table with user ID, unique endpoint, keys, created/last-seen timestamps,
and revocation status. Remove only the endpoint that failed. Keep category preferences separate.

Acceptance: a phone and laptop both receive notifications; expiration of one preserves the other.

### F09 Export is not a complete portable archive

**P2, confirmed scope gap.** The export is rooted in dates and omits standalone memories and
expenses. It omits some planning fields and exports authenticated photo URLs rather than the
image bytes. Nested memory selection does not filter soft-deleted memories. A JSON file containing
authenticated URLs cannot independently restore a photo library after account access disappears.

Evidence: [account-service.ts](../src/server/services/account-service.ts), `CoupleExport` and
`exportCoupleData`; [schema.prisma](../prisma/schema.prisma), optional `dateId` on Memory/Expense.

Fix: versioned JSON with every supported record type, explicit review visibility, media manifests
and optional media download bundle. Define a restore format and preserve stable IDs or a mapping.
Treat deleted content according to a documented archive policy.

Acceptance: export a fixture with standalone records and photos; restore it into an isolated
database and storage namespace and compare the intended content.

### F10 History pagination can miss matching older records

**P2, confirmed in source.** History takes at most 250 database rows, then applies some filters
in JavaScript. An older matching date outside those 250 rows cannot appear. The returned total
is the filtered page length. The best-photo wall uses completedAt alone as its cursor, so equal
timestamps at a page boundary can skip records.

Evidence: [history-service.ts](../src/server/services/history-service.ts), `HISTORY_TAKE`,
`getDateHistory`; [photo-service.ts](../src/server/services/photo-service.ts), `getBestPhotoWallPage`.

Fix: deterministic pagination with a unique tie-breaker, such as `(completedAt, id)`, and filters
applied before the limit. Define whether a count means page length or total matches. A future
search implementation must retain couple isolation and review visibility.

Acceptance: fixtures with more than 250 dates and repeated timestamps show every match exactly
once across pages.

### F11 Database safeguards stop short of business invariants

**P2, confirmed schema gap.** The checked-in migration has 43 foreign keys and 14 explicit unique
indexes, but no CHECK constraints. Ratings, money ranges, budget ordering, and custom split bounds
are validated primarily in application code. Active membership limits and the relationship
between a date's couple and its selected place/expense are also not encoded fully in SQL.

Foreign keys establish that referenced rows exist; these particular single-column keys do not
establish that both rows belong to the same couple. Existing service authorization helps, but
future scripts and new write paths can bypass those application rules.

Evidence: [schema.prisma](../prisma/schema.prisma) and
[initial migration](../prisma/migrations/20260902000000_init/migration.sql).

Fix: add row-local CHECK constraints, selected partial unique indexes, and composite foreign keys
where their ownership model is straightforward. Keep a transaction-safe membership rule for
the two-person limit. A CHECK that counts other rows is not a safe implementation of that rule.
[PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

Acceptance: invalid direct database writes fail in an isolated integration database, not merely
through form validation.

### F12 Storage and deletion need a recoverable workflow

**P2, confirmed design gap.** Photo variants are written before their database record. Partial
storage failures or a failed row insert can leave orphaned objects. Photo deletion soft-deletes
the row but immediately attempts to delete the image objects, so restoring the row alone does
not restore the photo. Storage deletion failures are swallowed. Account deletion archives
memberships and then deletes the user through separate operations, with archival errors caught.

Evidence: [photo-service.ts](../src/server/services/photo-service.ts), `storeVariants`,
`addDatePhoto`, `deleteDatePhoto`; [account-service.ts](../src/server/services/account-service.ts),
`deleteAccount`.

Fix: make the database changes atomic where possible. Track media cleanup jobs and staged upload
status; use compensation for failed uploads. Decide whether deletion has a grace period before
physical purge. Backups must cover PostgreSQL and object storage together.

Acceptance: injected failures between each storage/database step leave either valid content or
a recoverable cleanup task. A restore drill includes photos, not just rows.

### F13 Account and shared-device controls can be strengthened

**P2, confirmed limitations.** Rate limiting is in process memory. OAuth tokens are persisted as
plaintext columns. JWT tokenVersion supports revoking all sessions, but there is no per-device
session list/revocation model. Local draft keys are mostly scoped, but private browser drafts
are not cleared by logout; memory drafts use date-specific keys without a user component.

Evidence: [rate-limit.ts](../src/lib/security/rate-limit.ts), [google.ts](../src/lib/auth/oauth/google.ts),
[auth.ts](../src/server/actions/auth.ts), [memory-form.tsx](../src/components/dates/memory-form.tsx),
and [session.ts](../src/lib/auth/session.ts).

Fix first: delete unused OAuth tokens rather than storing them unnecessarily; encrypt needed
tokens with a key outside PostgreSQL. Define draft retention and clearing for shared devices.
Add email verification and session management if the account model needs them. A shared rate
limit store becomes useful with multiple server instances; it is not a reason to add infrastructure
to the current two-person app prematurely.

### F14 Database and authenticated journey tests are missing

**P1 for release confidence, confirmed repository gap.** Current automated coverage is valuable,
but database interactions in the existing authz/service tests are mocked. There is no checked-in
database integration suite or automated full two-user journey. No GitHub Actions workflow is
present in this working tree. Documentation still contains historical test counts and obsolete
statements about integrations.

Fix: create an isolated test database, apply all migrations to it, and run real transaction and
constraint tests. Add the browser journeys listed below and a CI gate. Reconcile the live
checklist with the actual implementation so future work is not driven by stale checkboxes.

## PostgreSQL design assessment

### Schema inventory

The Prisma schema contains 21 models and 16 enums. The single checked-in baseline migration
creates 38 non-unique indexes and 14 explicit unique indexes, in addition to primary-key indexes.

| Domain | Models | Assessment |
| --- | --- | --- |
| Identity | User, Account, PasswordResetToken | Sensible separation; hashed reset tokens and session version exist |
| Membership | Couple, CoupleMember, CoupleInvitation | Good ownership root; cross-row membership rules need stronger safeguards |
| Planning | Place, Date, DateActivity | Useful plan/actual separation; timestamp meanings and lifecycle writes need correction |
| Media | DatePhoto | Object keys/variants belong here; image bytes belong in private object storage |
| Review | ReviewCategory, DateReview, DateReviewRating, RevisitDecision | Good normalized dimensions and per-author uniqueness; reveal must be universal |
| Journal and money | Memory, Expense | Appropriate independent entities; export, currency, and deletion semantics need completion |
| Collaboration | Notification, DateEvent, DateReminder, NotificationPreference | Good starting point; add delivery and device models as reliability requires |
| Discovery | RecommendationFeedback | Suitable deterministic feedback; an ML/vector database is unnecessary for current scope |

The model is proportionate to the product. Keep IDs as text/CUIDs unless a measured reason
justifies changing them. JSON is reasonable for provider metadata and event details; core
relationships, amounts, and visibility state should remain typed and relational.

### Data types and constraints

Choose explicit meanings for each class of date field:

| Meaning | Proposed PostgreSQL representation | Examples |
| --- | --- | --- |
| Calendar day | `date` | Birthday, anniversary, intended date day |
| Absolute instant | `timestamptz(3)` | Creation, submission, completion, scheduled delivery |
| Local event time | Day plus local time and IANA timezone; optionally a derived instant | A dinner entered as 19:00 in Asia/Kolkata |
| Money | Integer minor units with currency and precision policy, or a documented exact decimal representation | Expenses and budgets |
| Scored values | Integer with CHECK bounds | 1–10 scores, optional overall scores |

Current migration timestamps are `TIMESTAMP(3)` without timezone. That is not automatically wrong
for every field, but the current mixed interpretation is wrong. Migration must first classify
historical values. Do not interpret old planned wall times as UTC instants during a bulk cast.

Suggested initial constraint migration:

- `date_review_ratings.score BETWEEN 1 AND 10`.
- Nullable review overall/suggested scores in the supported range; a submitted review requires
  the fields the product promises at submission.
- Nonnegative expense/budget/activity amounts; positive dimensions and nonnegative file size.
- `ownerShareCents` within `[0, amountCents]` for CUSTOM expenses, with a defined null policy.
- Minimum budget not greater than maximum budget.
- Valid coordinate ranges and paired latitude/longitude when supplied.
- One active membership per user; at most one active OWNER and PARTNER role per space if those
  role semantics are retained. Together with the two-value role enum this caps active roles at two.
  These indexes do not enforce the parent couple's status or every lifecycle rule.
- Optional one outstanding invitation per couple using accepted/revoked state. Do not put a
  moving `now()` condition in an index predicate; explicitly revoke/retire expired links.

Preflight existing data and repair conflicts before validating new constraints. Some safeguards
require reviewed SQL migrations beyond the Prisma 6 schema representation.

### Ownership and database access

The current application resolves the authenticated couple and scopes protected resources through
shared helpers. Preserve that pattern. Add composite ownership constraints for references such
as an expense's date or a date's selected place where feasible. Review cross-date photo/category
references separately; a simple existence foreign key cannot express all those rules.

Use a restricted runtime database role and a separate migration role. The runtime role should
not own the schema or be able to create roles/databases. The actual role grants need live
inspection before claiming this is configured.
[PostgreSQL role privileges](https://www.postgresql.org/docs/current/sql-createrole.html)

Row-level security is optional defense in depth, especially if MONO later hosts multiple
independent couple spaces. It is not required to make this private two-user app functional.
If added, policies need authenticated context scoped to the same transaction as the queries,
tests through the real connection pool, and a non-owner runtime role. Table owners and
BYPASSRLS roles can bypass normal policies. RLS alone also does not fix partner-review privacy
when both people are allowed to read the same couple's rows.
[PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### Transactions and edit conflicts

Preserve the existing atomic reminder claim/in-app notification and serializable membership
transactions. Extend transaction boundaries to include the business checks they protect.

For edits to shared text and plan data, add a monotonically increasing `version`. Send the
loaded version with the mutation and update only if it still matches. When the update count is
zero, return a conflict with a way to reload or preserve the user's draft. Activity insertion
and reordering should use a consistent parent lock or version to avoid competing orders.

Mutation events needed for correctness should be written in the same transaction as the change.
The current DateEvent log is best-effort, so it is useful attribution rather than a complete,
tamper-proof audit history. External notifications should consume a durable outbox after commit.

### Connections and migrations

The current Prisma 6 datasource has one DATABASE_URL and no `directUrl`. The Prisma client is
reused per process; this does not impose a global connection limit across serverless instances.

When hosting is resumed, consider a pooled runtime URL and a direct migration URL. Prisma 6
supports `directUrl` in `schema.prisma`; Prisma 7 setup examples differ and should not be pasted
into this repository unchanged. Select pool limits based on measured concurrent instances and
database capacity, not a universal hardcoded number.
[Neon Prisma 6 configuration](https://neon.com/docs/guides/prisma),
[Prisma 6 connection pools](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool)

The one baseline migration is not itself a defect. Add incremental migrations, test a clean
database installation and upgrades from the baseline, and retain a recovery plan for changes.
Existing databases must not have their applied migration history casually rewritten. Prefer
additive changes, backfills, validation, and a later cleanup over a single destructive conversion.

### Indexes and search

Existing indexes cover many useful couple/date/user paths. For two people, correctness and
database round trips will usually matter more than building many new indexes. Candidate indexes
should be justified by real queries and `EXPLAIN (ANALYZE, BUFFERS)` on representative read-only
fixtures; no performance improvement is measured by this audit.
[PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)

Candidates to evaluate after the query fixes:

| Query | Candidate |
| --- | --- |
| All users' pending reminders ordered by due time | Partial index on scheduledFor/userId where sentAt and dismissedAt are null |
| User notification timeline | userId, createdAt descending, id descending |
| Active date history with stable pagination | Couple ID, actual chosen date-order fields, unique ID, with matching active/status predicate |
| User-specific pending reminders | User ID and scheduledFor with matching pending predicate, if the existing index is insufficient |

Column order and query predicates determine how useful a multicolumn or partial index is.
Do not add every candidate or remove existing indexes without measurements.
[Multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html),
[partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)

Current history search uses case-insensitive substring matches across titles, places, activities,
and memories. PostgreSQL full-text search is an option for ranked word search; pg_trgm can help
substring and typo-tolerant matches. At this data size either should follow pagination correctness
and measurements. Keep unrevealed reviews out of any shared search document.
[Full-text search](https://www.postgresql.org/docs/current/textsearch.html),
[pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)

### Backups and operational visibility

The repository does not establish the running PostgreSQL version, current migration drift,
provider recovery window, runtime grants, connection usage, row counts, or query latency.
Those require metadata inspection and host settings when deployment work resumes.

Use both a database recovery mechanism and recoverable object storage. Point-in-time recovery
uses database backups and WAL history; a database restore does not recreate image files already
deleted from the bucket. A separate logical dump is useful for portability. Perform a restore
drill in isolation, including membership, review visibility, media references, and application
login. Set recovery objectives appropriate to the couple rather than inventing an enterprise SLA.
[PostgreSQL recovery](https://www.postgresql.org/docs/current/continuous-archiving.html),
[logical dumps](https://www.postgresql.org/docs/current/backup-dump.html)

Track database/pool timeouts, transaction retries/conflicts, oldest due reminder, failed delivery
attempts, storage cleanup failures, and backup age. pg_stat_statements can expose aggregate query
costs when the provider supports it. Avoid putting passwords, OAuth tokens, journal text, or
unrevealed reflections into logs.
[pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

## Features worth adding

These are proposed additions, not missing implementations of already promised behavior. Ratings
of value and effort are engineering judgments: small means a localized change, medium spans
schema/services plus an existing screen, and large needs a new synchronization or recovery flow.
All visible additions should reuse the current design system and await a deliberate feature choice.

| Order | Feature | Why it fits MONO | Database work | Relative effort |
| --- | --- | --- | --- | --- |
| 1 | Recurring date nights and reusable templates | Reduces repeat planning while keeping each occasion's actuals and reviews separate | DateSeries/Template, exception dates, unique series occurrence | Medium |
| 2 | Anniversary and birthday reminders | Uses existing anniversary/birthday fields and the calendar | SpecialDay or derived schedule, timezone and repeat rules | Small–medium |
| 3 | Download an event as iCalendar | Makes a plan useful in an existing calendar without a new provider login | Stable UID and sequence; optional revocable subscription tokens later | Small–medium |
| 4 | Date proposals and partner voting | Helps the couple choose a place/day before committing to a plan | Proposal, Option, Vote with one vote per person/option | Medium |
| 5 | On this day memories and annual recap | Makes the existing archive valuable again | Existing dates/memories first; no new table required for a basic read-only view | Small–medium |
| 6 | Multiple-device push, quiet hours, and delivery status | Makes reminders reliable on the devices people actually use | PushSubscription and NotificationDelivery; timezone-aware preference fields | Medium |
| 7 | Trash with a defined restore period | Reduces the cost of accidental deletion | Restore deadline, retention state and cleanup jobs; postpone object purge | Medium |
| 8 | Complete archive export and restore | Gives the couple practical ownership of their history | Versioned archive manifest, import job and identity mapping | Large |
| 9 | Monthly budget and totals by currency | Adds useful planning without pretending unlike currencies are interchangeable | Optional BudgetPeriod; currency-grouped aggregates | Medium |
| 10 | Ranked search with tags | Helps find an old trip, restaurant or memory | Tag links; optional full-text/trigram indexes | Medium |
| 11 | Booking and preparation notes | Keeps confirmation references, meeting point and a short checklist with the date | Structured notes or a small checklist model | Small–medium |
| 12 | Cross-device drafts and safe offline submission | Protects longer writing and allows work across devices | Revisioned Draft, operation IDs, conflict handling and sync queue | Large |

iCalendar has a standard format for events and recurrence; start with an authenticated one-event
download, then evaluate revocable read-only feeds before attempting two-way Google Calendar sync.
[iCalendar specification](https://www.rfc-editor.org/rfc/rfc5545)

As product context, Between already combines private memories, special days and a shared calendar,
and its help documentation describes annual special-day reminders and repeating events. That
supports considering recurrence and resurfacing as relevant patterns, not a requirement to copy
its interface or build its chat/calling features. MONO's distinctive focus is the connection
between planning, what actually happened, independent reflection, and a kept memory.
[Between features](https://between.us/intro),
[Between event and special-day behavior](https://help.between.us/hc/en-us/articles/115007425868-What-is-the-difference-between-Event-and-Special-Day)

Native chat, calls, a social feed, public ratings, complex real-time infrastructure, and automatic
AI processing of private reflections have lower priority for the current two-person scope.
The useful next feature set is recurrence, special days, simple calendar interoperability, and
memory resurfacing once the privacy and correctness fixes pass.

## Implementation sequence

| Phase | Work | Completion evidence |
| --- | --- | --- |
| A | Central review visibility, secure export/place totals, enforce plan editability | Two-user tests cover every read/export path and every locked plan mutation |
| B | Define time semantics; fix countdown targets; group money by currency | Midnight/DST/travel fixtures and mixed-currency cases pass |
| C | Transactional reveal/lifecycle, conflict handling, SQL constraints | Real PostgreSQL concurrent tests and rejected-invalid-write tests pass |
| D | Durable delivery, multiple push endpoints, staged storage cleanup | Failure injection proves retries, safe cleanup and endpoint isolation |
| E | Correct pagination, complete archive, restore policy, CI and docs | Large fixture pagination, clean migration and archive restore pass |
| F | Add selected features using current UI components | Feature-specific acceptance tests and visual regression checks pass |

This order reduces the risk of building new features on inconsistent privacy, time, or money
rules. Production provider setup stays a separate later step.

## Required verification

1. Two users create accounts, connect, plan, start, complete, review separately, reveal, keep a
   memory, add photos and expenses, and export the resulting data.
2. A third test user in a separate test space cannot read, modify, search or export those records.
3. Before reveal, no screen, place total, recommendation explanation, export, or client payload
   contains the partner's private review content.
4. Competing review submission/reopen/delete operations preserve the reveal lock.
5. Competing status transitions and plan/activity edits preserve lifecycle and version rules.
6. Calendar and reminders are correct in multiple timezones, across midnight and DST changes.
7. Totals respect currency; a profile currency change does not rewrite historical meaning.
8. Storage/provider/database failures leave a retryable or explicitly failed operation.
9. History works beyond 250 dates and photo cursors handle equal timestamps.
10. A blank PostgreSQL database can run every migration; an existing baseline database upgrades
    cleanly; a backup plus media can be restored in isolation.

An accompanying [read-only SQL audit](sql/postgresql-audit.sql) collects metadata and aggregate
integrity counts for a later live review. It has not been executed. It changes no schema or
application rows and returns no review text, image data, password hashes, or tokens.
