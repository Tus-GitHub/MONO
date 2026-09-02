# MONO architecture

## Principles

1. **Not a prototype.** Every feature is backed by real persistence, authentication,
   server-side logic, validation, and real data.
2. **Layer separation.** UI, database, auth, authorization, business logic, validation,
   storage, email, utilities, types, and server actions/API are separate modules.
3. **Business rules are not in components.** They live in `src/server/services/**` (orchestration
   with the database) and `src/lib/**` (pure rules, e.g. `lib/date/lifecycle.ts`). React
   components render; they do not decide.
4. **Two people, one couple.** All couple-scoped data belongs to a `Couple`. A user has at
   most one active couple; the "max two members" rule is enforced in `couple-service`.
5. **Minimal dependencies.** Each package is justified in the README.

## Request flow

```
Browser
  └─ src/proxy.ts .............. verifies session cookie signature/expiry only (no DB).
                                 Redirects unauthenticated traffic off protected paths.
  └─ Server Component / Route Handler / Server Action
       └─ src/lib/auth ......... getCurrentUser() / requireUser()  — who is this?
       └─ src/lib/authz ....... requireCoupleContext() / authorize*()  — which couple, are they in it?
       └─ src/server/services . business logic + Prisma
       └─ src/lib/validation .. Zod parse of all input
```

## Authentication (`src/lib/auth`)

- **Passwords** — `bcryptjs`, cost 12. Never stored or logged in plaintext. Strength rules in
  `password.ts` (`passwordSchema`).
- **Sessions** — stateless. A signed JWT (`jose`, HS256, `AUTH_SECRET`) in an httpOnly,
  SameSite=Lax, `Secure`-in-prod cookie. The token embeds `User.tokenVersion`; bumping it
  (done on password reset) invalidates every existing session with no server-side store.
- **Helpers**
  - `getCurrentUser()` — `SessionUser | null`, memoized per request (`React.cache`).
  - `requireUser()` — throws `AuthenticationError` (actions / route handlers).
  - `requireUserOrRedirect()` / `redirectIfAuthenticated()` — Server Component guards.
- **Recovery** — `PasswordResetToken` stores only a SHA-256 of the emailed token, 30-minute
  single-use expiry. Email goes through the `EmailDriver` abstraction (console driver in dev).
- **Google** — architecture only. `Account` table, `lib/auth/oauth/google.ts` provider config
  and `upsertUserFromOAuthProfile`, and guarded `api/auth/google/{start,callback}` routes.
  Returns HTTP 501 until `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set — no schema or
  session change needed to switch it on.

## Authorization / couple isolation (`src/lib/authz`)

The rule: **every protected server operation resolves the couple from the authenticated
session and verifies membership here.** It never trusts a client-supplied couple id, user id,
URL parameter, or hidden field.

- `getCoupleContext()` / `requireCoupleContext()` — resolve the caller's couple from their
  session (`CoupleMember` → `Couple`). This is the primary entry point.
- `requireCoupleMembership(coupleId)` — when an id *does* arrive from the client (route param,
  form field), this verifies it against the session before returning anything.
- `authorizeDate/Place/Photo/Expense/Memory/Review(id)` — load a resource scoped to the
  caller's couple in one step. A missing or foreign resource is reported as `NotFoundError`
  so existence never leaks.

Protected: dates, activities, photos, reviews, revisit decisions, expenses, memories, places,
review categories, couple settings.

The full endpoint-by-endpoint authorization audit, input-validation inventory, auth review,
media-access review, and privacy posture live in **`docs/security.md`**. Highlights: the
`/media/[...key]` route rejects any non-canonical key (`..` segments, control chars) *before*
it parses the ownership prefix; uploads are validated by sniffing the file's magic bytes, not
its declared type; `src/lib/security/rate-limit.ts` throttles auth / invite / upload endpoints;
`next.config.ts` sets CSP + `X-Frame-Options` + `nosniff` + `Permissions-Policy` globally.

## Data model (`prisma/schema.prisma`)

15 models: `User`, `Account`, `PasswordResetToken`, `Couple`, `CoupleMember`, `Place`,
`Date`, `DateActivity`, `DatePhoto`, `ReviewCategory`, `DateReview`, `DateReviewRating`,
`RevisitDecision`, `Expense`, `Memory`, `Notification`.

- Money: integer `*Cents` + ISO-4217 `currency`. No duplicated data beyond what a query needs.
- Timestamps on every table; `deletedAt` soft-delete on long-lived, user-authored records.
- Deletion behavior: couple delete cascades couple-scoped rows; date delete cascades
  activities/photos/reviews/revisit but keeps expenses & memories (nulling `dateId`);
  user-authored FKs use `Restrict` (soft-delete users instead).

## Date lifecycle (`src/lib/date/lifecycle.ts`)

```
DRAFT ─▶ PLANNED ─▶ TODAY ─▶ IN_PROGRESS ─▶ COMPLETED
  │        │          │           │
  └────────┴──────────┴───────────┴────────▶ CANCELLED      (COMPLETED ⇄ IN_PROGRESS to fix actuals)
```

`DATE_STATUS_TRANSITIONS` + `assertTransition()` are pure and reused by services, jobs, and
UI. Planning fields (`title`, `scheduledFor`, `planned*`, `expectedBudgetCents`, activities of
kind `PLANNED`) hold intent; `actual*` fields + `ACTUAL` activities + photos + reviews +
`RevisitDecision` + `Memory` hold what happened, and may diverge from the plan.

## Reviews — blind until both submit (`src/lib/date/review-reveal.ts`)

Each partner writes a `DateReview` independently. It exists as a private draft the moment they
start; `submittedAt` locks their side in. `reviewStage()` is the pure state machine —
`none → draft → submitted → revealed` — and neither person sees the other's scores, category
ratings or reflections until **both** have submitted (a one-member couple reveals on submit).
Every read path enforces this through two shared helpers so no service re-implements the rule:
`isRevealed(submittedCount, hasPartner)` and `dateCoupleScore(overalls, revealed)` — used by
`history-service`, `couple-insights-service`, `explore-service` and `home-service` alike, so a
date's couple score is `null` everywhere until both partners have submitted. `getDateExperience.review`
returns `partner: null` until the reveal. Rounding is single-sourced: `round1` / `mean` /
`averageScore` live in `src/lib/review/scale.ts`. Scores are 1–10; `suggestedOverall()` offers a
category average the user is free to override — never applied silently.

Once revealed, `buildReviewComparison()` (`src/lib/review/comparison.ts`, pure) produces the
combined model: per-category `{ you, partner, combined }`, the one **couple score**
`round1((youOverall + partnerOverall) / 2)`, a separate informational `categoryAverage`,
top/low shared categories, and positive-only agreement `insights`. `revisitCompatibility()`
maps the two independent `personalRevisit` calls to a level (strong … one-off). `<DateResult>`
renders the permanent summary of a finished, revealed date at the top of `/dates/[id]`;
`<ReviewReveal>` is the "You both reviewed it." moment plus the full breakdown.

## Our Dates history (`/dates/history`, `src/server/services/history-service.ts`)

`getDateHistory(query)` is the one loader for the timeline — it flattens each completed date to
a `DateHistoryItem` (`src/lib/date/history-item.ts`), computing the couple score, cover,
revisit and memory snippet *once*. The four card components (`timeline` / `memory` / `grid` /
`compact` under `components/dates/cards/`) are pure presentation over that shape — no business
logic in the UI. Filters and search are entirely URL-driven: `parseHistoryParams` /
`historyParamsToString` (`src/lib/date/history-filters.ts`) round-trip `?q,year,month,category,
place,city,activity,revisit,score,view`; the service turns them into an `AND` of `OR` groups
(month-without-year and the score bucket are applied in memory), and `<HistoryControls>`
debounces the search box and owns a bottom-sheet filter drawer with removable chips.

## Memories (`/memories`, `src/server/services/memory-service.ts`)

The editorial companion to the history views — "a private photo journal". It adds **no**
business rules of its own: `history-service` exports `HISTORY_INCLUDE` + `mapDateRowToItem`
(the single row→`DateHistoryItem` mapper), and every memory loader reuses them, so card shapes
never diverge. `loadCompleted()` reads all completed dates once and runs
`computeMilestones()` (`src/lib/date/milestones.ts`) — a pure function whose every output maps
to a real fact (first date, Nth date, first date in a city, a place's 3rd+ visit, a calendar
match with the couple's `anniversaryAt`, the top couple score once ≥3 dates are scored). It
never manufactures a milestone. `getMemoryHome` / `getMemoryTimeline` / `getFavorites` compose
that with `photo-service.getBestPhotoWall()` / `listFavoritePhotos()` (→ `WallPhoto`, a
`PhotoView` plus date/place context); `getMemoryDetail` *reshapes* `getDateExperience` output
into an editorial `MemoryDetail` (hero photo, ordinal, milestones, couple score + top combined
categories, one-line spend and plan-divergence sentences) and deliberately drops every
technical field. Favourites persist: `Memory.isFavorite` / `Place.isFavorite` /
`DatePhoto.isFavorite`, toggled through `toggleMemoryFavoriteAction` /
`togglePhotoFavoriteAction` (id-validated, couple-authorized, path-revalidating) behind the
optimistic `<FavoriteHeart>`. Routes: `/memories` (journal home), `/memories/timeline`,
`/memories/photos` (`<PhotoWall>`), `/memories/favorites`, `/memories/[id]`. `<PhotoGallery>`
takes `readOnly` so the detail page's gallery has no edit chrome.

## Money per date (`src/lib/date/expense-*.ts`)

`Expense` rows attach to a `Date`. `paidBy` (`SHARED` / `OWNER` / `PARTNER` / `CUSTOM`) is the
split *mode*; `ownerShareOf()` derives each person's share of one line — an even 50/50 is only
`SHARED`, never assumed. Forms speak a viewer-relative `me / partner / shared / custom`;
`resolvePayer()` translates that (plus a `%` for custom) into stored columns using the actor's
couple role, and `payerFacing()` maps it back for display. `budgetDelta()` compares the
planned budget with the effective spend inside a 5% / $5 tolerance and stays gentle about it.
`valueForMoney()` ties the recorded spend to the review's "Value for money" category — and
nothing else about anyone's finances. `getDateExperience.spending` bundles the breakdown,
delta and per-person contributions for `<DateSpending>`; `<ExpenseRow>` edits inline; every
mutation is `authorizeExpense`-scoped.

## Couple profile & private insights (`/couple`, `src/server/services/couple-insights-service.ts`)

`getCoupleProfile(coupleId, viewerId)` is the single loader behind `/couple`. Every figure it
returns is a plain count or average over the couple's own rows — nothing is predicted or
personality-profiled — and the deterministic rule functions live in the pure
`src/lib/couple/insights.ts` (`buildCategoryPreferences`, `findPreferenceGaps`,
`buildCoupleInsights`). Two ideas keep the numbers honest: a **reveal gate** (a completed
date's couple score and per-category scores only count once *both* partners have submitted —
same rule as `reviewStage`), and **min-sample guards** (a shown per-category average needs ≥2
distinct rated dates; a per-person "difference" needs ≥3 and a ≥1-point gap; each insight is
emitted only when its data supports it). Statistics that would mislead are withheld, not faked:
the average couple score always travels with its `scoredDateCount`, the lowest-rated date is
omitted unless there are ≥2 scored dates that actually differ, and `totalSpendCents` is `null`
(not `0`) when nothing has been recorded. Preference differences use only neutral phrasing and
carry a "different tastes, not a problem" framing line. Two per-user privacy toggles
(`User.hideMoneyInsights`, `User.hidePartnerPreferenceGap`) blank the money figures and the
per-person breakdown for the viewer who set them.

`/settings` is the hub: links to the couple/personal/notification editors, a preferences form
(theme + privacy), a JSON **data export** (`GET /api/export` — members-only, couple resolved
from the session, streamed as an attachment), sign-out, and a danger zone. "Disconnect
partner" (`disconnectCouple`) archives the shared space and sets both memberships to `LEFT` —
nothing is hard-deleted, so support can restore it; "Delete account" (`deleteAccount`) does the
same to the couple, then soft-deletes the user and bumps `tokenVersion` to kill every session.
Both are confirmed — `useConfirm` for disconnect, a typed-"DELETE" form for deletion.

## Explore — discovery engine (`/explore`, `src/server/services/explore-service.ts`)

`/explore` has two modes: with a `q`/`category`/`view`/`forDate` param it is the place search
grid (`searchPlaces`, unchanged — this is the only place a ruled-out place resurfaces); with no
param it is `getExploreHome(coupleId, viewerId)`, the discovery home.

`getExploreHome` is one deterministic loader — no AI, no randomness, same history → same list.
From the couple's completed dates it builds a **per-member × place-category rating map**
(reveal-gated the same way as reviews: a date only counts once both partners have submitted),
a per-place aggregate (score, visits, last revisit), a city tally, and the set of categories
they've done. It then assembles up to eight sections — *Recommended for you*, *Because you
loved X*, *Previously enjoyed*, *Nearby* (the couple's most-visited city, not GPS), *Try
something different* (categories with zero history), *Date ideas*, *Hidden gems*, *Your saved
places* — dropping empties and **reordering by history depth**: with ≥3 completed dates the
personalised sections lead, otherwise ideas lead.

**Couple Match %** (`src/lib/explore/compatibility.ts`, pure) scores one recommendation from
both partners' historical ratings of that category: a weighted blend of how highly they rate it
and how closely their two averages agree, clamped to 40–98, with a plain-language `reason`
("Both of you rate activity dates highly."). When there isn't enough history the percent is
`null` ("New territory"), never invented. A revisit-YES place is pinned to 94%.

**Date ideas** (`src/lib/explore/date-ideas.ts`) is a fixed catalogue of ten non-place ideas
(picnic, pottery, movie night…), each mapped to a `PlaceCategory` so it can be match-scored;
"Plan this" hands the title to `/plan?idea=` which seeds a draft.

**Visited handling** (`src/lib/explore/visited.ts`, pure `classifyVisited`) tags every place
`new` / `visited` / `revisit` / `loved` / `avoid`. `avoid` = the couple's last revisit call was
`NO` ("never again") **or** they left `NOT_FOR_US` feedback; those are filtered out of every
recommendation section and only reappear in a deliberate search.

**Feedback** (part 6) is `RecommendationFeedback` — one couple-shared row per (couple, target),
`signal` ∈ `INTERESTED` / `NOT_FOR_US` / `SAVED`, set through `recommendationFeedbackAction` and
the optimistic `<RecFeedback>` chips. It re-weights the deterministic ranking (suppress
`NOT_FOR_US`, surface `SAVED` ideas in a "Saved for later" strip); it is explicitly **not** a
learning model.

## Theme (`src/lib/settings/theme.ts`)

Three choices — `system` / `light` / `dark` — persisted on `User.theme`. `globals.css` defines
the light palette on bare `:root`, the dark palette under both
`@media (prefers-color-scheme: dark) { :root:not([data-theme]) }` (the `system` path) and
`:root[data-theme="dark"]` (the pinned path); pinning `light` needs no rule. A tiny inline
`THEME_BOOT_SCRIPT` in the root `<head>` applies the last choice from `localStorage` before
first paint; `<ThemeApplier>` (mounted in `(app)/layout`) reconciles the server value onto
`<html data-theme>` after hydration for a fresh device. The switcher in `<PreferencesForm>`
previews live on change and persists on submit.

## Notifications & reminders (`src/server/services/notification-service.ts`, `reminder-service.ts`)

Two record types. A **`Notification`** is a delivered item in the in-app centre (`/notifications`).
A **`DateReminder`** is a *scheduled* row — one member, one date, one `ReminderKind` — that a
dispatcher later turns into a Notification (and a push).

**Fan-out** (`notifyPartner` / `notifyCouple`) writes Notifications for the couple's other
member(s) on pipeline events. It is guarded twice: `NOTIFICATION_CATEGORY_OF`
(`src/lib/notifications/types.ts`) drops a type the recipient has turned off, and a recency
check collapses an identical `(user, type, entity)` inside 10 minutes (60 for `DATE_EDITED`, so
a flurry of plan edits is one message).

**Scheduling** — `ensureRemindersForDate` (day-before + day-of, the latter at 09:00 in the
couple's own timezone via `zonedTimeToUtc`), `ensureReviewReminders`, `ensureMemoryReminder`,
`ensureUnfinishedPlanReminder`, and the user-set `setCustomReminder`. Each is idempotent and
called from the mutation it depends on; `upsertReminder` only re-fires an already-sent reminder
if its time actually moved. A cancelled / completed / deleted date has its schedule reminders
cleared.

**Dispatch** — `getDueReminders(userId)` returns rows that are due, not for a `CANCELLED` date,
still in a sensible state for their kind, not >2 days stale (stale ones are retired), and
allowed by `REMINDER_CATEGORY_OF`. `dispatchDueReminders` (called opportunistically from
`getHomeData`; a cron would call it too) hands each to `deliverNotification`, which fans the
payload across a **channel registry** (`src/lib/notifications/channels.ts`): `InAppChannel` is
authoritative — `sentAt` is stamped only if it succeeds, so a transient failure retries — and
`PushRelayChannel` is best-effort through the swappable `push.ts` provider. Add email by
registering another `NotificationChannel`; no caller changes.

**Preferences** are six per-user booleans (`src/lib/notifications/prefs.ts` is the single list;
`NotificationPreference` the store). **Partner activity** on Home is `getPartnerActivity` — up
to three lines of what the other person did since `activitySeenAt`, collapsing a run of one
kind into a counted phrase ("added 3 photos"). It's gated by the `partnerEdits` pref and is
deliberately not a feed.

## Storage (`src/lib/storage`)

`StorageDriver` interface; `LocalStorageDriver` (dev) writes under `STORAGE_LOCAL_ROOT`.
Keys are namespaced `couples/<coupleId>/dates/<dateId>/photos/...` with a random token, so
they are unguessable. The `/media/[...key]` route parses the couple id from the key and calls
`requireCoupleMembership` before streaming — the key layout **is** the isolation story — and
returns 404 on any failure so existence never leaks. Responses carry `Cache-Control: private,
immutable` (keys are never rewritten in place) and `X-Robots-Tag: noindex`. `S3StorageDriver`
is a stub. Nothing is served from a public bucket URL; `src/app/robots.ts` disallows the
whole app.

## Images (`src/lib/images`)

`ImageProcessor` interface — same swap-the-driver shape as storage/email. `SharpImageProcessor`
(the default; `sharp` is an explicit dependency, already resident via Next) produces three
WebP variants per upload — `original` (≤2560px, EXIF-stripped), `display` (≤1400px), `thumb`
(≤480px) — plus a tiny base64 blur placeholder. `NoopImageProcessor` (`IMAGE_PROCESSOR=noop`)
passes the original through for every variant. Variant keys hang off one base key
(`<base>.webp`, `<base>.display.webp`, `<base>.thumb.webp`) so they share the couple prefix.
`photo-service` owns the pipeline (`addDatePhoto` / `replaceDatePhoto` / `deleteDatePhoto` /
`setBestCouplePhoto`) and `resolveDateCover` (best photo → memory cover → first photo) feeds
every card/hero. The client renders through `<Photo>` (aspect-ratio box, blur-up, lazy,
`srcSet`) — never `next/image`, since the sources are behind per-request auth.

## Reliability, performance & resilience

- **Loading**: every `(app)` segment has a `loading.tsx` skeleton, with `(app)/loading.tsx` as
  the catch-all. Data is server-rendered per page; the only interactive client fetch is the
  in-plan place picker. Images load progressively through `<Photo>` (blur-up + `loading=lazy` +
  `srcSet`); long galleries add `.cv-auto` (`content-visibility`) so off-screen tiles skip
  layout/paint.
- **Errors**: `global-error.tsx` (root-layout failure, self-contained), `(app)/error.tsx`
  (in-shell, offline-aware, surfaces the `digest`), plus segment boundaries where the failure
  mode is specific (`explore/error.tsx`). Services throw typed `AppError`s; the action/route
  boundary turns them into an `ActionState` or a status code — a failure never renders as
  success.
- **Offline** (`src/lib/hooks/use-online-status.ts`): `<OfflineBanner>` in the shell shows a
  top strip while `navigator.onLine` is false and a brief "back online" on recovery;
  `<OfflineNotice>` warns inside long forms. `use-local-draft.ts` mirrors a form field to
  `localStorage` (wired into `<MemoryForm>`), and the plan flow server-autosaves each step, so
  draft work survives a reload or a dropped connection. Uploads retry per-item.
- **Pagination**: `getBestPhotoWallPage(cursor)` (cursor = last `completedAt`) feeds
  `<PhotoWall>`'s IntersectionObserver infinite scroll with a "Load more" fallback; date
  history is capped at 250 with an on-screen note. `getFavorites` counts visits in one pass
  rather than one query per place.

## Tests (`npm test` → Vitest)

68 unit tests over the pure business-rule modules — `lib/review/scale` + `comparison`,
`lib/date/review-reveal` + `lifecycle`, `lib/date/expense-split` + `expense-breakdown`,
`lib/explore/compatibility`, `lib/utils/timezone` — plus `lib/authz/couple` (couple isolation,
with `prisma` + the session mocked). Node environment, no DB, no DOM. `vitest.config.ts` maps
the `@/*` alias and stubs the `server-only` / `client-only` build guards.

## Pending (foundation deliberately stops here)

- DB is live (Neon) and **in sync** — `prisma db push` applied every schema delta through the
  final pass (26 tables).
- Real Google OAuth credentials; real email transport (SMTP driver — `console` driver active).
- Real object storage for production (`S3StorageDriver` is a stub; `local` works in dev).
- Reminder dispatch is opportunistic (on Home load); a cron/worker calling
  `getDueReminders` → `deliverNotification` is the next step.
- CSP still allows `'unsafe-inline'` for script/style (nonce-based CSP is the hardening step).
- Migrate `package.json` Prisma bits to `prisma.config.ts` (Prisma 7).
