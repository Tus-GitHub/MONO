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
Every read path enforces this: `getDateExperience.review` returns `partner: null` until the
reveal, and aggregates (`place-history`, home stats, recommendations) only count
`submittedAt != null` rows. Scores are 1–10; `suggestedOverall()` offers a category average the
user is free to override — it is never applied silently.

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

## Pending (foundation deliberately stops here)

- Provision the database, then `npm run db:migrate -- --name init`.
- Real Google OAuth credentials; real email transport (SMTP driver).
- Feature pages: Memories (`/memories` is still a placeholder — the date history at
  `/dates/history` covers much of it), Couple settings editing.
- Migrate `package.json` Prisma bits to `prisma.config.ts` (Prisma 7).
- `deepmerge-ts` advisory via `prisma` CLI (dev-only) — clears on a Prisma release.
