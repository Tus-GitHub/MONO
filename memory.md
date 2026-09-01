# Project Memory — MONO

Last updated: 2026-09-02 (Our Dates history)

## Project Overview

**MONO** — a private two-person relationship / date application. Used by exactly two connected
people on their personal devices. Not public, not social, not a marketplace or review site.
Every feature is backed by real persistence, authentication, server-side business logic,
validation, and real data.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind v4 ·
PostgreSQL · Prisma ORM · hand-rolled secure cookie sessions (bcryptjs + jose) · zod ·
storage & email driver abstractions. Deps kept minimal: `@prisma/client`, `prisma`,
`bcryptjs`, `jose`, `zod`, `tsx`.

**Layering:** UI · database · auth · authz (couple isolation) · business logic (services) ·
validation (zod) · storage · email · utilities · types · server actions/API · reusable
components. Business rules never live only in React components — they live in
`src/server/services/**` and `src/lib/**`. See `docs/architecture.md`.

## Status

### In Progress

_Nothing in progress._

### Done

- **Our Dates history experience (6-part prompt)** — completed 2026-09-02
  - No schema change. New route **`/dates/history`** (+ `loading.tsx` skeleton timeline +
    `error.tsx`); `<DatesNav>` segmented control (History / Calendar / Upcoming) added to all
    three `/dates*` pages.
  - Single data source: `history-service.getDateHistory(query)` → `DateHistoryItem[]`
    (`lib/date/history-item.ts`, pure type + `memorySnippet`). Every derived value —
    `coupleScore` (reuses `averageScore` + `reviewStage`, null until revealed), `cover`
    (`resolveDateCover`), `revisit` (shared `RevisitDecision`), memory snippet, spend, activity
    titles — computed once in the service. `getHistoryFilterOptions()` returns the years /
    categories / places / cities / revisits that actually exist.
  - 1. Timeline: newest-first, grouped by year on a spine; `<TimelineDateCard>` leads with the
    best photo + date/place/title, couple score, revisit tag, one line of the memory.
  - 2. Four representations, all taking `DateHistoryItem`, zero duplicated logic:
    `<TimelineDateCard>`, `<MemoryDateCard>` (large feature — also the "Most recent" spotlight),
    `<GridDateCard>` (square tiles, `?view=grid`), `<CompactDateCard>` (one-line rows,
    `?view=list`). Shared `<ScorePill>` / `<RevisitTag>` in `cards/_bits.tsx`; extracted
    `lib/date/revisit-choice.ts` `REVISIT_CHOICE_META` (also now used by `LatestMemoryCard`).
  - 3. Filters (`lib/date/history-filters.ts` — `parseHistoryParams` / `historyParamsToString`
    / `hasActiveFilters` / `SCORE_BUCKETS`, all URL-driven): year, month, category, place, city,
    activity (contains), revisit, score bucket (7/8/9+). `<HistoryControls>` — a `<BottomSheet>`
    filter drawer + removable active-filter chips + one-tap "Clear all". `month` w/o `year` and
    the score bucket are applied in-memory; everything else is SQL (`AND` of `OR` groups).
  - 4. Search (`?q`, debounced 350 ms in `<HistoryControls>` → `router.replace`): OR across
    title, place name/city (planned + actual), `actualLocationText`, activity titles, memory
    title + body, `mode: "insensitive"`, `take: 250`.
  - 5. Date detail — already complete on `/dates/[id]` (`<DateResult>` / `<PlanVsReality>` /
    `<PhotoGallery>` / `<DateSpending>` / `<ReviewReveal>` / `<ValueForMoneyCard>` /
    `<RevisitControl>` / memory + recap/review/memory edit routes). Timeline cards link straight in.
  - 6. States: `EmptyState` for no-completed-dates ("No dates yet. Let's make the first one." +
    Plan a date), no-search-match, no-filter-match (each → clear link); `loading.tsx` skeleton;
    `error.tsx` (retry + open calendar).
  - `tsc` / `eslint` / `next build` (`/dates/history` + loading + error) / `next dev` green;
    param parser + snippet sanity-checked. Needs DB + login.

- **Per-date money tracking (6-part prompt)** — completed 2026-09-01
  - Schema: `ExpenseCategory` +`SHOPPING`; `ExpensePayer` +`CUSTOM`; `Expense` +`note String?`
    +`ownerShareCents Int?` (OWNER's portion when `paidBy = CUSTOM`; derived otherwise).
  - Pure libs: `lib/date/expense-split.ts` (`ownerShareOf` per mode — OWNER=all / PARTNER=0 /
    SHARED=half / CUSTOM=explicit; `contributionsOf`; `resolvePayer` translates a form's
    viewer-relative `me/partner/shared/custom` + `mySharePct` into canonical `paidBy` +
    `ownerShareCents` using the actor's couple role; `payerFacing` for display),
    `lib/date/expense-breakdown.ts` (`categoryBreakdown` slices + `budgetDelta` — 5%/$5
    tolerance → "right on budget" / "$X under" / "$X over", no error-red),
    `lib/date/value-for-money.ts` (`valueForMoney` — great/fair/steep from spend + the review's
    Value score only). `expense-labels.ts` +`EXPENSE_CATEGORY_ORDER`/`_COLOR`/`PayerFacing`.
  - `dateExpenseSchema` reworked → `payer` (viewer-relative enum) + `mySharePct` + `note` +
    `spentAt`. `expense-service`: `addDateExpense` / `updateDateExpense` (NEW — correct
    anything) / `deleteDateExpense`; `resolveExpense` helper uses `context.membership.role`.
  - `getDateExperience` now loads members (owner/partner names + viewer role) and returns:
    `expenses` viewer-relative (`payer`, `mineShareCents`/`partnerShareCents`, `note`,
    `recordedByMe`), `spending` (`{ totalCents, plannedTotal/Min/Max, effectiveSpendCents,
    delta, categories, contributions:{mineCents,partnerCents,partnerName} }`), and
    `valueForMoney` (revealed only).
  - 2. `<QuickExpenseButton>` → `+ Add expense` BottomSheet with the shared `<ExpenseFields>`
    (amount-first, category chips, payer chips, custom = % slider with live You/Partner amounts,
    collapsible note + when). Threaded through Day Mode too.
  - 3. `<DateSpending>` (replaces `date-expenses.tsx`, `id="spending"`): planned-vs-spent bar +
    gentle delta pill, "Where it went" stacked category bar + legend, "Each of you put in"
    two-person contribution bar, then the editable list. No red, soft copy.
  - 4. Split: four modes incl. custom %, per-person contribution computed from actual shares —
    never assumes 50/50.
  - 5. `<ValueForMoneyCard>` on `/dates/[id]` (revealed): ties `effectiveSpendCents` to the
    Value-for-money category's combined score with a friendly line. `getDateExperience` reads
    the `value`-keyed category (added `key` to the review-category select).
  - 6. `<ExpenseRow>` view/edit (inline `<ExpenseFields>` form → `updateDateExpenseAction`),
    delete keeps its confirm. All go through `authorizeExpense` (couple-scoped).
  - `budget-step` `SPLIT_LABEL` +`CUSTOM`. `tsc` / `eslint` / `next build` (40 routes) /
    `next dev` green; split + budget-delta math sanity-checked ($60 SHARED→30/30,
    $50 CUSTOM owner-$15→15/35; ±5% → "right on budget"). Needs DB + login.

- **Combined review reveal experience (6-part prompt)** — completed 2026-09-01
  - No schema change. New pure lib `lib/review/comparison.ts`: `buildReviewComparison`
    (per-category `{you, partner, combined=(a+b)/2, delta}`, `coupleScore=round1((a+b)/2)`,
    `categoryAverage` kept separate & informational, `topShared`/`lowShared`, `insights`),
    `revisitCompatibility` (strong / worth-considering / different / mixed / one-off),
    `round1`. All deterministic — no hidden weighting.
  - `getDateExperience.review` gains `comparison` + `revisitCompat`, computed **only** in the
    `revealed` branch (partner data already null pre-reveal); `combined10` now derives from
    `comparison.coupleScore`.
  - 1. `<ReviewReveal>` (now client) — a "You both reviewed it." gate with the couple avatar +
    "Reveal the comparison" button; once revealed it stays open (per-browser `localStorage`
    `mono:review-revealed:<id>`, deferred via `queueMicrotask` to dodge hydration mismatch),
    with a light staggered `anim-rise` the first time.
  - 2. `<CategoryTrack>` — each category on a 1–10 track with a "You" dot (primary) and a
    "{partner}" dot (accent) joined by a segment (gap = disagreement), combined pill on the
    right, "in step / N apart" tag. Stacks cleanly on mobile — no table.
  - 3. Couple-score hero: big `coupleScore`/10 + `scoreLabel` + the transparent formula
    "(you + partner) ÷ 2".
  - 4. "What stands out" — the `insights` list (strongest shared category, "You both loved the
    X", directional "You enjoyed the X more than {partner} did", gentle low note). Positive /
    neutral only, capped at 5.
  - 5. Revisit-compatibility card — `revisitCompat.label` + blurb + tone, with both personal
    calls and their notes shown side by side (only ever in the revealed state).
  - 6. `<DateResult>` (server) — the permanent summary at the top of a COMPLETED + revealed
    `/dates/[id]`: best-photo hero (place + date overlay), couple score, category-score chips,
    revisit-result badge, memory snippet + "View full memory" (`#memory` anchor), photo strip
    (`#photos`). `<ReviewReveal>` stays in the reviews slot as the full breakdown; reflections
    compare side by side there.
  - `tsc` / `eslint` / `next build` (40 routes) / `next dev` green; comparison + revisit-compat
    algorithm sanity-checked (7.5 = (8+7)/2, insights positive-only, Definitely+Never →
    "Different opinions"). Needs DB + login to exercise.

- **Blind individual post-date review system (6-part prompt)** — completed 2026-09-01
  - Schema: `DateReview` reshaped — drop `headline`/`body`/`wouldRepeat`/`mood`; add
    `overallRating Int?` (**now 1–10**, null while draft), `suggestedOverall Int?`,
    `personalRevisit ReviewRevisit?` + `personalRevisitNote`, `lovedText`/`betterText`/
    `rememberText`/`unexpectedText`, `submittedAt DateTime?`. New enum `ReviewRevisit`
    (DEFINITELY / MAYBE / PROBABLY_NOT / NEVER_AGAIN). `DateReviewRating.score` → 1–10.
    Default categories replaced: **Food / Ambience / Hygiene / Adventure / Fun / Value for money**.
  - Pure libs: `lib/review/scale.ts` (`SCORE_MIN/MAX`, `scoreLabel`, `scoreTone`, `scorePercent`,
    `suggestedOverall` = rounded avg, `averageScore`), `lib/review/revisit.ts`,
    `lib/review/reflection-prompts.ts`, `lib/date/review-reveal.ts` (`reviewStage` →
    none/draft/submitted/revealed; `isReviewEditable`; solo couple reveals on submit).
  - 1. Flow: `getReviewContext` returns date/place/best-photo cover + categories + stage +
    editable + partnerName + my draft. `<ReviewForm>` opens with the context card + privacy
    line ("nothing shared until <partner> submits").
  - 2. Category ratings: `<ScoreScale>` — accessible 1–10 (`role="slider"`, arrows/Home/End,
    Backspace clears, 10 tap cells, tone by score), word label beside every number.
  - 3. Overall: separate `<ScoreScale name="overallRating">` prefilled with `suggestedOverall`
    and labelled "MONO's suggestion" until the user touches it — the posted value is always
    the shown/controlled one; never silently overridden.
  - 4. Reflection: 4 optional journal `<Textarea>` (loved / better / remember / unexpected).
  - 5. Revisit: 4-button independent choice (`personalRevisit`) + optional note.
  - 6. Submission: pre-submit "at a glance" summary panel; two submit buttons — "Save draft"
    (`saveReviewDraftAction`, lenient, no reveal, stays private) and "Submit my side"
    (`submitReviewAction`, needs overall + revisit) via React 19 `formAction`. After submit →
    `<ReviewWaiting>` "Your side is saved." / "We're waiting for <partner>'s side of the story.",
    with read-only summary + "Edit my side" (`reopenReviewAction`) / "Withdraw" (`deleteReview`)
    while not revealed. `writeReview` throws `ConflictError` once both sides are in (locked).
  - Reveal: `getDateExperience.review` is reveal-gated — partner scores/text are `null` until
    stage `revealed`. `/dates/[id]` shows `<ReviewStatus>` (not-revealed: draft / submitted /
    waiting, never partner numbers) or `<ReviewReveal>` (both in: combined /10, per-category
    meters with "in step / N apart", side-by-side reflections). Pipeline `review` step = *submitted*.
  - Scale migration ripple: dropped every `overallRating * 2` (`home-service`, `place-history`,
    `place-service`, `recommendation-service`) — scores are already /10 — and all aggregates now
    filter `reviews: { where: { submittedAt: { not: null } } }` (a private draft isn't a score).
    `getPendingReviewCount` / `ensureReviewReminders` count *submitted*, not merely started.
  - `notification-service` +`notifyCouple` (fan-out incl. actor) — used for the reveal ping.
  - `tsc` / `eslint` / `next build` (40 routes) / `next dev` green; reveal state machine +
    suggestion logic sanity-checked. Needs DB + login to exercise end-to-end.

- **Real photo system (6-part prompt)** — completed 2026-09-01
  - Deps: added `sharp` ^0.35.4 (already resident via Next) to `dependencies` + `next.config`
    `serverExternalPackages`; env `IMAGE_PROCESSOR` (`sharp` | `noop`).
  - Schema: `DatePhoto` +`displayKey`/`thumbKey`/`blurDataUrl` (renamed `thumbnailKey`→`thumbKey`);
    `Date` +`bestPhotoId` (→ `DatePhoto` `DateBestPhoto`, SetNull) — the `photos` relation is now
    named `"DatePhotos"`; `DateEventKind` +`BEST_PHOTO_SET`. `prisma validate` OK; TS client
    regenerated (native engine swap still blocked by running `next dev`).
  - 1. Storage: `src/lib/images/` = `ImageProcessor` abstraction (`types` / `sharp-processor`
    (server-only, WebP, EXIF-stripping) / `noop-processor` / `index` factory + singleton).
    `src/lib/storage/index.ts` +`buildDatePhotoBaseKey` / `datePhotoVariantKey` (variants sit
    under the same `couples/<id>/` prefix as the original). `image-rules` bumped to 12 MB,
    +AVIF, +empty-file check. `photo-service` reworked: `addDatePhoto(processed)` /
    `replaceDatePhoto` / `deleteDatePhoto` (nulls memory covers + `Date.bestPhotoId`, deletes
    all 3 variants) / `setPhotoCaption` / `setBestCouplePhoto` / `listDatePhotos` +
    `PHOTO_SELECT` / `toPhotoView` / `resolveDateCover` (bestPhoto → memory cover → first photo).
  - 2. Upload: `POST /api/uploads/date-photo?dateId=` (validate → `imageProcessor.process` →
    3 variants + blur → `addDatePhoto`), `PUT ?photoId=` for replace. `<PhotoUploader>` — dropzone
    + multi-select + camera capture, one XHR per file (browser caps concurrency), per-item
    progress / cancel (abort) / retry / remove, debounced `router.refresh()`.
  - 3. Gallery: `<PhotoGallery>` replaces `date-photos.tsx` — 1 / 2 / masonry (CSS `columns`)
    layouts, per-tile "best" star + prompt banner when unset, opens `<PhotoLightbox>`
    (portal, dark, keyboard + swipe prev/next, double-tap / wheel / pinch zoom + drag-pan,
    neighbour preload, inline caption edit, set-best, delete).
  - 4. Best Couple Photo: `Date.bestPhotoId` + `setBestCouplePhotoAction` (empty id clears);
    prompt "Pick the photo that feels most like us"; `resolveDateCover` wired into
    `getDateExperience`, `home-service` (`UpcomingDateView.cover` / `LatestMemoryView.cover` /
    `CoupleStatsView.heroPhoto` — replaced the old `heroImageUrl` strings), `calendar-service`
    (`CalendarDate.cover`, day panel only), `getMemoryContext`; `buildPipeline` +`bestPhoto` step
    (only when photos exist).
  - 5. Optimization: `<Photo>` primitive — aspect-ratio box (no layout shift), blur-up
    placeholder from `blurDataUrl` (or `.skeleton`), `loading="lazy"` + `fetchPriority`,
    `srcSet` `thumb 480w / display 1400w`. No `next/image` (private auth'd sources). sharp
    verified: 3000×2000 → orig 2560 (12 KB) / display 1400 (4.7 KB) / thumb 480 (1 KB) /
    blur ~110 B.
  - 6. Privacy: `/media/[...key]` unchanged auth (couple-prefix → `requireCoupleMembership`,
    404 on any failure) + new headers `Cache-Control: private, …, immutable`,
    `X-Robots-Tag: noindex, nofollow, noimageindex`, `Referrer-Policy: no-referrer`. Keys carry
    a 9-byte random token → unguessable. New `src/app/robots.ts` = `Disallow: /` (whole app).
    No public gallery / index route exists.
  - `tsc` / `eslint` / `next build` (40 routes incl. `/robots.txt`) green; `next dev` — public
    200, `/robots.txt` 200 (`Disallow: /`), protected 307, `/media/*` 404, upload route
    405 on GET. Needs DB + login to exercise end-to-end.

- Project setup: created `memory.md` and `CLAUDE.md` — completed 2026-09-01
- **Date day + plan→reality transition (6-part prompt)** — completed 2026-09-01
  - Schema: `Date` +`startedById`(→`User` `DateStartedBy`, SetNull) +`actualNotes` +`actualsRecordedAt`;
    `DateActivity` +`unplanned` (an ACTUAL activity that wasn't planned — a detour/extra stop);
    `DateEventKind` +`ACTUALS_RECORDED`/`PHOTO_ADDED`/`REVIEW_WRITTEN`/`REVISIT_DECIDED`/`MEMORY_CREATED`.
    `prisma validate` OK; TS client regenerated (native engine swap blocked by the running
    `next dev` — see Backlog). Migration still pending on DB.
  - Pure libs: `lib/date/day-mode.ts` (`buildDayView` → phase before/during/after/untimed +
    current/next slot from wall-clock minutes), `lib/date/comparison.ts` (`buildComparison` →
    time/place/budget diff + kept/dropped/added activities + `divergence` as-planned/adjusted/
    improvised), `lib/date/pipeline.ts` (`buildPipeline` → post-date checklist steps),
    `lib/date/expense-labels.ts`.
  - 1. Date Day Mode: `getDateExperience(dateId, userId)` (one view-model loader — plan, actual,
    comparison, pipeline, photos, reviews, revisit, memory, expenses). `/dates/[id]` renders
    `<DateDayMode>` for TODAY/IN_PROGRESS — ticking clock derives "Now / Next", place +
    Directions (`place.mapUrl ?? mapsLink`), quick photo / quick spend / "record it", Complete;
    nothing to tick off. Falls back to the plan card + `<StatusControl>` otherwise.
  - 2. Start Date: `transitionDate` stamps `startedById` (first start only; reopen keeps it);
    `<StartDateButton>`; day-mode header shows "In progress · Started by you/<name> · <ago>".
  - 3. Record actuals: `recordActuals` (scalars: saved place *or* free text, day, wall times,
    spend, `actualNotes`; allowed TODAY/IN_PROGRESS/COMPLETED). `actuals-service.ts` = ACTUAL
    `DateActivity` CRUD + reorder + `seedActualsFromPlan` ("start from the plan"). `/dates/[id]/recap`
    = `<RecapForm>` + `<ActualActivitiesEditor>` (detour toggle = `unplanned`).
  - 4. Plan vs reality: `<PlanVsReality>` — story-framed by `divergence`, planned→actual lanes for
    time/place/spend, kept/skipped/added activity chips, "extra experiences" (unplanned stops).
  - 5. Complete + pipeline: `<CompleteDateButton>` (confirm reassures nothing locks). `<PostDateChecklist>`
    (buildPipeline: recap / photos / your review / their review / revisit / memory — "N of M",
    non-blocking). New services `review-service` (per-person `DateReview` + per-category
    `DateReviewRating` upsert, notifies partner, clears review reminder), `revisit-service`
    (shared `RevisitDecision` upsert), `memory-service` (`Memory` upsert per date + cover from
    date photos), `photo-service` (+ `POST /api/uploads/date-photo?dateId=`), `expense-service`
    (date-scoped `Expense`). `notification-service.notifyPartner` fan-out helper.
    Sub-routes `/dates/[id]/review` + `/dates/[id]/memory`.
  - 6. Recovery & editing: recap / review / revisit / memory / photos / expenses all stay open in
    COMPLETED (services allow IN_PROGRESS+COMPLETED); `deleteReview` / `deleteMemory` (soft) /
    delete photo / delete expense; only the original *plan* locks after PLANNED (unchanged).
  - `tsc` / `eslint` / `next build` (39 routes) green; `next dev` — public 200, protected +
    `/dates/[id]/{recap,review,memory}` 307 → `/login`, `/api/uploads/date-photo` 405 (POST-only).
    Needs DB + login to exercise.
- **Collaboration & calendar (6-part prompt)** — completed 2026-09-01
  - Schema: `CoupleMember` +`activitySeenAt`; `NotificationType` +`DATE_EDITED`; new enums
    `DateEventKind` (CREATED / TITLE_/TIME_/PLACE_/NOTES_/BUDGET_CHANGED / ACTIVITY_ADDED/
    UPDATED/REMOVED/REORDERED / STATUS_CHANGED) + `ReminderKind` (UPCOMING / DATE_DAY / REVIEW /
    UNFINISHED_PLAN); new models `DateEvent` (per-date attribution log), `DateReminder`
    (per-user scheduled record, `@@unique([dateId,userId,kind])`, `channel` default `inapp`),
    `NotificationPreference` (5 category toggles + `pushEnabled`/`pushSubscription` Json).
    `prisma validate` + `generate` OK (migration still pending on DB).
  - 1. Shared editing + attribution: `date-event-service.logDateEvent` is wired into **every**
    plan / place / status mutation (`plan-service`, `place-service`, `date-service`). Each
    event stores actor + a human summary ("moved it to Fri, Mar 6", "set the place to Blue
    Bottle", "renamed an activity to …"). `/dates/[id]` shows a last-edit line
    ("You / <partner> <summary> · 2h ago") + a full `DateEventList` timeline.
  - 2. Reliable status transitions: `date-service.transitionDate` calls `authorizeDate` →
    `assertTransition` (pure `DATE_STATUS_TRANSITIONS` rules) — invalid moves throw before any
    write. `StatusControl` (client) only renders legal next moves, routes destructive ones
    (→ CANCELLED) through `useConfirm`. `promoteDueDates` lazily bumps PLANNED→TODAY when the
    scheduled day arrives (run from Home + calendar loads).
  - 3. "Our Calendar" = `/dates` rewritten: `MonthCalendar` (Monday-first grid, per-day status
    dots, prev/next month via `?month=`) + `DayDetailPanel` for the selected `?day=` (each date
    → badge + link to detail). `getMonthDates` / `getDayDates` in `calendar-service`.
  - 4. `/dates/upcoming` (new): next date as a big card with live `Countdown`, place, planned
    activities, expected budget, Edit plan / Open date; remaining upcoming dates as rows;
    `?sort=soonest|latest` segmented control. `date-service.getUpcomingDates(sort)`.
  - 5. Reminders architecture: `reminder-service` — `ensureRemindersForDate` (UPCOMING = 24h
    before start, DATE_DAY = 9am on the day), `ensureReviewReminders` (per member, 2h after a
    date completes), `ensureUnfinishedPlanReminder` (draft creator, 3 days stale). Delivery is
    provider-agnostic: `dispatchDueReminders` writes an in-app `Notification` and calls
    `getPushChannel().send()` — `src/lib/notifications/push.ts` ships a `NoopPushChannel`
    (logs) with a documented `WebPushChannel` wiring point; **no provider hardcoded**.
    `/settings/notifications` (new) = per-category toggles (`NotificationPreference`) +
    "Enable browser notifications" (`Notification.requestPermission()`, delivery pending).
  - 6. Contextual collaboration cue: `getUnseenPartnerEdit` (reads `CoupleMember.activitySeenAt`)
    → Home shows one quiet `PartnerActivityBanner` ("<partner> updated the dinner time on
    <date> · +2 more · 1h ago", dismiss = mark seen). `MarkDatesSeen` clears the marker when
    the calendar is opened. No feed — the timeline stays on the date it belongs to.
  - `tsc` / `eslint` / `next build` (35 routes) / `next dev` (public 200, protected 307 →
    `/login?next=…`) all green. Needs DB + login to exercise.
- **Real Home experience (6-part prompt)** — completed 2026-09-01
- **Plan a Date workflow (6-part prompt)** — completed 2026-09-01
- **Place discovery & selection (6-part prompt)** — completed 2026-09-01
  - Schema: `PlaceCategory` +`SHOPPING`; `Place` +`description/imageUrl/openingText/isFavorite/`
    `provider/providerPlaceId/externalRating/externalRatingCount/priceLevel` + unique
    `(coupleId, provider, providerPlaceId)`. `prisma validate`/`generate` OK.
  - 1. Provider abstraction: `src/lib/places/` — `PlaceProvider` interface, `GooglePlacesProvider`
    (real `places:searchText`/details shape, guarded by `GOOGLE_PLACES_API_KEY`, degrades to []),
    `getExternalPlaceProvider()` factory. `place-search-service.searchPlaces()` merges the
    couple's saved places + (optional) external results, dedupes, enriches with couple
    intelligence. `env`: `PLACE_PROVIDER` / `GOOGLE_PLACES_API_KEY`.
  - 2. `EXPLORE_CATEGORIES` taxonomy (12 incl. Hidden gems / Custom place) → `CategoryRail`,
    horizontally scrollable.
  - 3. `PlaceCard` — image/gradient, name, category, location, external rating, price, distance,
    couple score, favourite heart. Public vs private ratings visually distinct
    (`PublicRating` grey "· public" / `CoupleScore` clay "· together").
  - 4. `/places/[id]` + `PlaceDetail` — hero, gallery (photos from past dates), info, Maps link,
    opening hours, couple history, intelligence, Select place.
  - 5. `place-service.getPlaceDetail` couple intelligence: previously-visited count, aggregate
    couple score, last revisit + reason, similar liked places, favourite-category flag,
    a "personal relevance" line — **aggregate only, no individual review answers**.
  - 6. Selection: `PlaceField` in the plan Basics step opens a `PlacePickerSheet`
    (search + categories + custom tab) → `selectPlaceForDateAction` → `router.refresh()` so
    **no form state is lost**. Explore `?forDate=` cards / detail "Select place" redirect back.
    Replace + remove supported; per-activity places (multi-stop) via a select in the activity
    editor. `createCustomPlace` for places a provider can't find.
  - `/api/places/search` route for the client picker. `tsc` / `eslint` / `next build`
    (26 routes) green. Needs DB + login to exercise.
  - Schema: `Date` +`expectedBudgetMinCents`/`expectedBudgetMaxCents`/`budgetSplit`(ExpensePayer);
    `DateActivity` +`durationMinutes`. `prisma validate`/`generate` OK.
  - Persistence model: entering the flow **creates a DRAFT `Date` row immediately**; each step
    autosaves its fields on Back/Continue, so navigating between steps never loses data.
  - Route: `/plan` (start new + resume drafts) → `/plan/[id]?step=basics|budget|activities|review`.
    `plan-service.ts` (startDraft, getPlan, updateBasics/Budget, add/update/delete/reorder
    activities, finalizePlan, duplicateDate, cancelDate, deleteDatePlan, listDrafts) + `plan.ts`
    actions. Planned wall-clock times stored UTC-encoded → `YYYY-MM-DD` / `HH:MM` round-trip.
  - 1. Multi-step: title, date, start/end time, notes, expected budget — draft-lenient
    validation (`dateBasicsSchema`); finalize requires title + date.
  - 2. `DatePicker` (Today/Tomorrow/This weekend/Next weekend shortcuts + month calendar, past
    days disabled) + `TimeField` (Morning/Afternoon/Evening presets + custom `<input type=time>`),
    end-after-start + no-time-without-date enforced.
  - 3. `BudgetStep` — expected total, optional min/max range, currency, payer split
    (SHARED/OWNER/PARTNER); friendly copy, visually secondary card.
  - 4. `ActivitiesStep` — 10 quick-add presets + custom; each activity has name, optional
    duration + estimated cost, order, inline edit, delete (confirm). Immediate persistence.
  - 5. `Timeline` — derives "6:00 PM → Coffee" clock times from the date's start + cumulative
    durations; reorder via up/down (touch-friendly, `useOptimistic`) persists `sortOrder`.
  - 6. `ReviewStep` — summary + Save the plan (→ PLANNED/TODAY), Save as draft, Duplicate,
    Cancel date, Delete draft (destructive → `useConfirm`). Finalize redirects to
    `/dates/[id]?planned=1`, which shows **"It's a plan. Now make it a memory."**
  - `/dates/[id]` gains an "Edit plan" button (DRAFT/PLANNED/TODAY) → `/plan/[id]`; Home's
    "Edit plan" repointed there. `tsc` / `eslint` / `next build` (25 routes) green.
  - Schema: `Place.city` (for "cities explored"). `prisma validate`/`generate` OK.
  - `home-service.getHomeData(coupleId, userId)` — one call; structural data (couple/members/
    counts) throws to the route error boundary, each enrichment is a resilient `Section<T>`.
  - 1. `HomeHeader` — time-of-day greeting ("Good morning, you two."), couple names/photo,
    current date, notification bell + unread badge (`/notifications`), profile access
    (`/settings/profile`), data-aware subline.
  - 2. `UpcomingDateCard` — soonest PLANNED/TODAY/IN_PROGRESS date as the hero: title, place+city,
    date, time, planned activities, expected budget, hero image (or category gradient), a live
    `Countdown` badge, Open date / Edit plan → `/dates/[id]`. No upcoming → `NoUpcomingState`.
  - 3. `LatestMemoryCard` — latest COMPLETED date, photo-forward: best photo (memory cover →
    first photo → gradient), place, date, combined score /10, revisit badge, memory caption,
    View memory / Add a memory.
  - 4. `CoupleStats` — dates together · places you've been · cities explored · how you rate
    them · your kind of date (category vibe label) · memories kept. Relationship language.
  - 5. `recommendation-service.getRecommendedDates()` — deterministic (no AI): revisit-YES
    places, then a fresh place in the couple's top-rated category ("Because you both love …
    — you rate them 8.8/10"), then stable starter ideas. `RecommendedNext` renders them.
  - 6. States: brand-new (`StoryStartsHere`), no upcoming, upcoming, completed/multiple,
    pending reviews (`PendingReviewBanner`, above the fold), no memories (card CTA),
    `home/loading.tsx` skeleton, `home/error.tsx` retry, per-section `SectionUnavailable`
    (unavailable-data). Every state carries a primary action.
  - Support routes made real: `/dates/[id]` (read-only detail via `getDateDetail` — plan,
    actuals, photos, reviews, revisit, memory), `/notifications` (+ mark-all-read),
    `/settings/profile` (edit via `saveProfileAction` + avatar upload). Proxy prefixes updated.
  - `lib/utils/format.ts` (money/date/time/relative/countdown), `lib/date/place-category.ts`
    (label/vibe/icon maps). `tsc` / `eslint` / `next build` (24 routes) green.
- **Auth + onboarding experience (6-part prompt)** — completed 2026-09-01
  - Schema: `User` +nickname/pronouns/birthday/avatarKey/profileCompletedAt; `Couple`
    +description/photoUrl/photoKey/setupCompletedAt; new `CoupleInvitation` (hashed token,
    expiry, single-use, `acceptedAt/acceptedById/revokedAt`). `prisma validate` + `generate` OK
    (migration still pending on DB).
  - 1. Welcome: auth aside carries "Your dates. Your memories. Your story.", privacy copy,
    Google button (only when configured), subtle brand animation (`anim-breathe`/`anim-drift`,
    reduced-motion safe).
  - 2. Login/signup: real actions (existing) + **PasswordInput** (show/hide toggle),
    **remember-me** (browser-session cookie vs 30-day; `writeSessionCookie(payload, remember)`),
    `?invite=` threaded through auth → `/invite/<token>`.
  - 3. Profile setup: `/onboarding/profile` — name/nickname/pronouns/birthday +
    **ImageUpload** (preview/upload/replace/delete, XHR **progress**, error+**retry**) →
    `POST/DELETE /api/uploads/avatar` via the storage abstraction (`users/<id>/avatar/...`).
  - 4. Invitation: `invitation-service` (create/get/accept/revoke, `invitationState`),
    generate → copy → **Web Share** → revoke UI, `/invite/[token]` public accept flow
    (sign in/up → accept). Tokens are 24 random bytes; only SHA-256 stored; never a DB id.
  - 5. Couple setup: `/onboarding/couple` — name/description/relationship date + **cover photo**
    (`/api/uploads/couple-cover`, `couples/<id>/cover/...`); `/onboarding/done` confirmation
    shows both people + "private to the two of you".
  - 6. State machine: `onboarding-service.getOnboardingStatus` (profile → connect → couple →
    ready), `lib/onboarding.ts` guards (`requireOnboarded`, `requireOnboardingStep`),
    `/onboarding` resolver, `OnboardingStepper`, completed steps never re-shown.
    Home shows **"Your story starts here." / Plan your first date.** when the couple has 0 dates.
  - Structure: onboarding moved to its own `(onboarding)` route group (minimal chrome);
    `(app)/layout` now guards with `requireOnboarded`. `/media` route authorizes `users/<id>/`
    keys too. `next build` (28 routes) / `tsc` / `eslint` all green.
  - Also landed: dev-only `/style` component gallery + `npm run screenshot` covers it.
- **Foundation build (6-part prompt)** — completed 2026-09-01
- **Visual system + application shell (6-part prompt)** — completed 2026-09-01
  - 1. Brand: MONO wordmark (Fraunces, wide tracking) + "eclipse" mark (ring + clay disc =
       two-as-one, no hearts); `src/app/icon.svg`; `Logo` with lockup/wordmark/mark variants.
  - 2. Tokens: full `@theme` system in `src/app/globals.css` (warm near-monochrome + clay
       primary + plum accent + honey ratings; semantic bg/surface/elevated/ink/muted/primary/
       accent/success/warning/error/rating; radius, shadow, control heights, icon sizes,
       breakpoints incl. `xs`, motion durations/easings), light + dark via prefers-color-scheme;
       JS mirror `src/lib/design/{tokens,motion}.ts`. No hardcoded values in components.
  - 3. Components (`src/components/ui/**`): Button/LinkButton/SubmitButton, Input/Textarea/
       InputGroup, Select, SearchInput, Field, own-set `Icon` + `Spinner`, Card(+Header/Body/
       Footer), ImageCard, Rating (star/heart, keyboard), Avatar, CoupleAvatar, Chip, Badge +
       DateStatusBadge, Tabs, Modal, BottomSheet (drag-dismiss), toast (ToastProvider/useToast),
       ConfirmProvider/useConfirm, Skeleton*, EmptyState, ErrorState, StickyBar, Alert. All
       have hover/focus-visible/active/disabled/loading. Providers mounted in root layout.
  - 4. Navigation: `src/lib/navigation/nav.ts` (Home/Plan Date/Our Dates/Memories/Explore/
       Couple). Desktop `Sidebar` rail + mobile `TopBar` + `BottomNav` (raised centre Plan
       action, safe-area). `AppShell` rewritten around one centred column; pre-couple users
       get minimal `SetupShell`. Dashboard renamed to `/home` (`/dashboard` now redirects);
       all redirect targets + proxy prefixes updated.
  - 5. Responsive: `min-h-dvh`, safe-area utils, `.tap` 44px targets, `min-width:0` overflow
       guard, `.scroll-area`/`.scroll-x` with slim styled scrollbars, `StickyBar`, BottomSheet.
  - 6. Motion: shared keyframe vocab (`anim-fade/rise/scale-in/sheet-in/pop`, `.skeleton`),
       `(app)/template.tsx` page-transition, global `prefers-reduced-motion` damper.
  - Placeholder pages added for every nav destination (`/plan /dates /memories /explore
    /couple` + `/home`) using EmptyState/Tabs — shell only, feature pages still deferred.
  - Public pages (landing, auth) restyled to the system; auth is now a two-panel layout.
  - Verified: `tsc --noEmit` ✅, `eslint` ✅ (0), `next build` ✅ (17 routes), `next dev` ✅;
    public routes 200, protected → `/login?next=…`, `/icon.svg` 200, fonts + token CSS wired.
  - 1. Architecture: scaffolded Next.js 16 / TS / Tailwind v4 / ESLint / `src/` dir, `@/*` alias;
       full layered folder structure under `src/`.
  - 2. Prisma schema: 15 models (User, Account, PasswordResetToken, Couple, CoupleMember,
       Place, Date, DateActivity, DatePhoto, ReviewCategory, DateReview, DateReviewRating,
       RevisitDecision, Expense, Memory, Notification) + enums, indexes, unique constraints,
       timestamps, soft-delete, cascade/restrict rules. `prisma validate` passes.
  - 3. Date lifecycle: `DateStatus` DRAFT→PLANNED→TODAY→IN_PROGRESS→COMPLETED/CANCELLED;
       pure transition rules in `src/lib/date/lifecycle.ts`; plan vs. actual fields on `Date`.
  - 4. Auth: bcrypt hashing, signed-JWT httpOnly cookie sessions (jose), `tokenVersion`
       invalidation, register/login/logout/session/recovery server actions + services,
       password-reset tokens (SHA-256, single-use, 30 min), Google architecture seam
       (`Account` table + `oauth/google.ts` + guarded `/api/auth/google/*` → 501 until keys set).
  - 5. Couple isolation: `src/lib/authz` — `requireCoupleContext`, `requireCoupleMembership`,
       `authorize{Date,Place,Photo,Expense,Memory,Review,ReviewCategory}`. Couple resolved
       from session only; client-supplied ids never trusted; foreign/missing → NotFoundError.
  - 6. Verification: `tsc --noEmit` ✅, `eslint` ✅ (0 problems), `next build` ✅ (clean),
       `next dev` ✅ boots ~0.8s. Public routes 200; `/dashboard` & `/onboarding` 307→`/login`;
       `/api/health` 503 (DB down, graceful); `/api/auth/session` 401; `/media/*` 404.
       App shell (marketing landing, auth pages, protected `(app)` shell, dashboard,
       onboarding) built; feature pages intentionally NOT built.

### Backlog

- **Provision PostgreSQL** (role `mono_app` + `mono_dev`/`mono_shadow`), put real
  `DATABASE_URL` + a 32+ char `AUTH_SECRET` in `.env`, then
  `npm run db:migrate -- --name init` (+ optional `npm run db:seed`). Blocks: running the
  migration (schema also has the place-discovery, collaboration/calendar, date-day/plan→reality,
  photo-system, **and** blind-review additions — `DatePhoto.displayKey`/`thumbKey`/`blurDataUrl`,
  `Date.bestPhotoId`, `DateEventKind.BEST_PHOTO_SET`; `Date.startedById`/`actualNotes`/
  `actualsRecordedAt`, `DateActivity.unplanned`; `DateReview` reshaped (drop headline/body/
  wouldRepeat/mood; add `overallRating Int?` 1–10 / `suggestedOverall` / `personalRevisit` +
  note / 4 reflection cols / `submittedAt`), new enum `ReviewRevisit`, `DateReviewRating.score`
  1–10; **and** the money-tracking additions — `ExpenseCategory.SHOPPING`,
  `ExpensePayer.CUSTOM`, `Expense.note` + `Expense.ownerShareCents`), any login, and therefore
  visual QA of every authenticated screen (onboarding, `/invite/[token]`, home, calendar,
  upcoming, notification settings, the nav shell, `/dates/[id]` day mode + recap + photo
  gallery/lightbox/uploader + review form/waiting/reveal + spending/split/value-for-money).
  `/api/health` reports `database: "down"` by design until then.
- **`sharp` is now an explicit `dependencies` entry** but was already resolved in
  `node_modules` (Next 16 declares `sharp ^0.35.4` optionally), so no `npm install` was run.
  If the lockfile is ever regenerated, confirm `sharp` still resolves for the runtime image
  pipeline (`src/lib/images/`).
- **Default review categories changed** (overall_vibe/food_and_drinks/… → food / ambience /
  hygiene / adventure / fun / value). `ensureDefaultReviewCategories` / `seed.ts` use
  `createMany({ skipDuplicates: true })` keyed on `key`, so on an existing DB the old rows
  would linger alongside the new ones. On first real provision this is a non-issue (fresh);
  if a DB already has the old set, deactivate/remove the stale `review_categories` rows.
  Review scores are now **1–10** (were 1–5) — any pre-existing `DateReview.overallRating` /
  `DateReviewRating.score` rows would need doubling.
- **`prisma generate` fails with `EPERM … rename query_engine-windows.dll.node` while a
  `next dev` server is running** (it holds the native engine open on Windows). The generated
  **TypeScript** client still updates fine (so `tsc`/`next build` see new schema fields); only
  the native engine binary is stale until you stop `next dev` and re-run `prisma generate`.
  Moot until the DB is provisioned.
- **Reminder dispatch has no scheduler yet.** `dispatchDueReminders(userId)` is called
  opportunistically from `getHomeData`, so due reminders only fire when that user opens Home.
  A real cron / queue worker calling `dispatchDueReminders` per user is still needed.
- Wire a real push provider: implement `WebPushChannel` in `src/lib/notifications/push.ts`
  (VAPID keys) and return it from `getPushChannel()`; the subscription plumbing
  (`savePushSubscriptionAction` → `NotificationPreference.pushSubscription`) is already there.
- Wire real Google OAuth credentials (architecture done; returns 501 until then).
- Wire real email transport — SMTP driver (`console` driver active now).
- Build feature pages (nav destinations currently render tasteful placeholders/EmptyStates):
  Plan a date flow, Our Dates lists, Memories gallery, Explore/Places, Couple settings editing,
  Expenses, Reviews.
- Visual verification of authenticated screens (home/dates/couple/etc. + nav shell) is blocked
  on the database — no login is possible until `DATABASE_URL` is real.
- Migrate `package.json` Prisma seed config to `prisma.config.ts` before Prisma 7.
- Dev-only advisory: `deepmerge-ts` via `prisma` CLI — clears on a Prisma release.
- Optional: manual light/dark theme toggle (tokens currently follow `prefers-color-scheme`;
  add `:root[data-theme=…]` overrides to support it).

## Task Log

### 2026-09-01

- Project setup: created `memory.md` (status board + log) and `CLAUDE.md` with project rules. **DONE**
- Foundation part 1: inspected empty working dir, confirmed toolchain (Node 22, npm 10, pnpm 9,
  local PostgreSQL 17.2), scaffolded Next.js 16 app into project root, established the layered
  `src/` architecture. **DONE**
- Foundation parts 2–3: wrote `prisma/schema.prisma` (15 models + enums, relations, indexes,
  unique constraints, deletion behavior) and the pure Date-lifecycle rules module;
  `prisma validate` passes; Prisma Client generated. **DONE**
- Foundation part 4: implemented authentication — `src/lib/auth/**` (password, session,
  session-cookie, current-user, guards, oauth/google), `src/server/services/auth-service.ts`,
  `src/server/actions/auth.ts`, guarded Google routes, config via `src/config/env.ts`. **DONE**
- Foundation part 5: implemented the authorization / couple-isolation layer `src/lib/authz/**`
  and used it from services (`couple-service`, `date-service`) and the `/media` route. **DONE**
- Foundation part 6: built UI primitives, forms, app shell, public + auth + protected routes,
  API routes, `src/proxy.ts`; ran and fixed typecheck / lint / build; verified dev server and
  route behavior. Wrote `README.md` and `docs/architecture.md`. **DONE**
- Visual QA of public pages: added `scripts/screenshot.mjs` + `npm run screenshot` (drives
  system Chrome via `puppeteer-core`, dev dep) — captures landing/login/register/forgot across
  light+dark × phone/tablet/desktop and asserts no horizontal overflow (24/24 clean). Added
  belt-and-suspenders overflow guards (`html,body { overflow-x: clip; max-width:100% }`,
  `grid-cols-1` on the marketing/auth top-level grids). Sent screenshots to the user.
  Authenticated screens still need the DB to view. **DONE**
- Visual system + application shell (6-part prompt): established brand (Fraunces wordmark +
  eclipse mark + `icon.svg`), the full design-token layer in `globals.css` (+ JS mirrors),
  ~30 reusable UI components with all interaction states, the responsive navigation shell
  (desktop sidebar + mobile top bar & raised-centre bottom nav), responsive/scroll/safe-area
  handling, and a reduced-motion-aware motion vocabulary with page transitions. Renamed
  dashboard → `/home`, added placeholder pages for every nav destination, restyled the public
  landing + auth pages (now two-panel). `tsc` / `eslint` / `next build` (17 routes) / `next dev`
  all green. Wrote `docs/design-system.md`; added a design-token rule to `CLAUDE.md`. **DONE**
- Auth + onboarding experience (6-part prompt): schema additions + `CoupleInvitation` model;
  PasswordInput toggle, remember-me, Google button, welcome tagline + brand animation;
  profile-setup step with real photo upload (progress/retry) via `/api/uploads/avatar`;
  secure expiring invitation links (hashed tokens, `/invite/[token]` accept flow, copy/share);
  couple-setup step with cover photo + a "both people / private" confirmation screen;
  an onboarding state machine (`getOnboardingStatus` + `requireOnboarded`/`requireOnboardingStep`
  guards + `OnboardingStepper`) that never re-shows finished steps; Home "Your story starts
  here." zero-dates empty state. Onboarding split into its own `(onboarding)` route group.
  `tsc` / `eslint` / `next build` (28 routes) / `next dev` green; screenshotted `/style` + the
  updated public auth pages. Authenticated-screen QA still blocked on the database. **DONE**
- Real Home experience (6-part prompt): `Place.city`; `home-service` one-call aggregator with
  per-section resilience; `HomeHeader` (greeting/names/photo/date/bell/profile),
  `UpcomingDateCard` (+ live `Countdown`), `LatestMemoryCard` (photo-forward, combined score,
  revisit), `CoupleStats` (6 relationship-framed stats), deterministic `recommendation-service`
  + `RecommendedNext`, and all Home states (brand-new, no-upcoming, pending-reviews banner,
  section-unavailable, `home/loading.tsx`, `home/error.tsx`) — each with an obvious next action.
  Support routes now real: `/dates/[id]` detail, `/notifications`, `/settings/profile`.
  `tsc` / `eslint` / `next build` (24 routes) green. Home still needs the DB + login to view. **DONE**
- Plan a Date workflow (6-part prompt): DB-persisted 4-step flow (`/plan` → `/plan/[id]?step=`)
  that creates a DRAFT immediately and autosaves per step; custom `DatePicker` (Today/Tomorrow/
  weekend shortcuts + calendar, past disabled) + `TimeField` (Morning/Afternoon/Evening +
  custom); budget step (total/range/currency/split, secondary styling); `ActivitiesStep` with
  preset + custom activities (name/duration/cost/order/edit/delete) and a `Timeline` that
  derives clock times and reorders via optimistic up/down; `ReviewStep` with Save the plan /
  draft / Duplicate / Cancel / Delete (confirmed) → `/dates/[id]?planned=1` shows "It's a plan.
  Now make it a memory." Schema +budget range/split +activity duration. `tsc` / `eslint` /
  `next build` (25 routes) green. Needs DB + login to exercise. **DONE**
- Place discovery & selection (6-part prompt): swappable `PlaceProvider` abstraction
  (`src/lib/places/`, Google Places stub-real, falls back to the couple's saved places);
  `searchPlaces` orchestrator with couple intelligence; Explore rebuilt (category rail +
  live search + `PlaceCard` with distinct public/private ratings, price, distance, favourite);
  `/places/[id]` detail with gallery, map link, couple history + aggregate intelligence
  (no individual review answers); in-flow `PlacePickerSheet` on the Plan Basics step that
  `router.refresh()`es (no lost form state), plus Explore `?forDate=` selection, replace/remove,
  per-activity places, and custom places. Schema +`SHOPPING` +Place provider/rating/favourite
  fields. `/api/places/search`. `tsc` / `eslint` / `next build` (26 routes) green.
  Needs DB + login. **DONE**
- Collaboration & calendar (6-part prompt): schema +`DateEvent` / `DateReminder` /
  `NotificationPreference` / `CoupleMember.activitySeenAt` / `DateEventKind` + `ReminderKind`
  enums / `NotificationType.DATE_EDITED` (`prisma validate` + `generate` OK). (1) `logDateEvent`
  attribution wired into every plan/place/status mutation; `/dates/[id]` shows a last-edit line
  + full `DateEventList` timeline. (2) `transitionDate` enforces `assertTransition` before any
  write; `StatusControl` only offers legal moves (destructive → `useConfirm`); `promoteDueDates`
  lazily does PLANNED→TODAY. (3) `/dates` rewritten as "Our Calendar" — `MonthCalendar`
  (month grid, per-day status dots, `?month=`) + `DayDetailPanel` (`?day=`); `calendar-service`.
  (4) `/dates/upcoming` — next-date card with live `Countdown` + Edit action, remaining as rows,
  `?sort=soonest|latest`; `getUpcomingDates`. (5) `reminder-service` (UPCOMING / DATE_DAY /
  REVIEW / UNFINISHED_PLAN records) + provider-agnostic `dispatchDueReminders` (in-app
  `Notification` + `getPushChannel().send()`; `NoopPushChannel` ships, `WebPushChannel` seam
  documented); `/settings/notifications` page (category toggles + browser-permission prompt).
  (6) `PartnerActivityBanner` on Home — one quiet "<partner> updated … · +N more · 1h ago" line
  driven by `getUnseenPartnerEdit` / `activitySeenAt`; `MarkDatesSeen` clears it; no social feed.
  `tsc` / `eslint` / `next build` (35 routes) / `next dev` green. Needs DB + login. **DONE**
- Date day + plan→reality transition (6-part prompt): schema +`Date.startedById`/`actualNotes`/
  `actualsRecordedAt`, +`DateActivity.unplanned`, +5 `DateEventKind` values. Pure libs
  `day-mode.ts` / `comparison.ts` / `pipeline.ts`. (1) `getDateExperience` one-call view model;
  `<DateDayMode>` action-oriented `/dates/[id]` for TODAY/IN_PROGRESS (ticking Now/Next, place +
  Directions, quick photo/spend, Complete — no check-offs). (2) `transitionDate` records
  `startedById`; `<StartDateButton>` + "In progress · Started by …" state. (3) `recordActuals` +
  `actuals-service` (ACTUAL activity CRUD + seed-from-plan); `/dates/[id]/recap` = `<RecapForm>` +
  `<ActualActivitiesEditor>` (detour = `unplanned`); actuals free to diverge fully. (4)
  `<PlanVsReality>` — story-framed (`divergence`), planned→actual lanes, kept/skipped/added
  chips, extra experiences. (5) `<CompleteDateButton>` + `<PostDateChecklist>` (buildPipeline);
  new `review-service` / `revisit-service` / `memory-service` / `photo-service`
  (+`POST /api/uploads/date-photo`) / `expense-service`; `notifyPartner` helper; sub-routes
  `/dates/[id]/{review,memory}`. (6) recap/review/revisit/memory/photos/expenses stay editable
  in COMPLETED (+ deletes); only the original plan locks after PLANNED (unchanged). `tsc` /
  `eslint` / `next build` (39 routes) / `next dev` (307s on new routes) green; `prisma validate`
  OK, TS client regenerated (native engine swap blocked by running `next dev`). Needs DB +
  login. **DONE**
- Real photo system (6-part prompt): +`sharp` dep (already resident via Next) +`serverExternalPackages`
  +`IMAGE_PROCESSOR` env. Schema `DatePhoto` +`displayKey`/`thumbKey`/`blurDataUrl`, `Date`
  +`bestPhotoId`, `DateEventKind` +`BEST_PHOTO_SET`. (1) `src/lib/images/` `ImageProcessor`
  abstraction (sharp WebP + EXIF strip / noop); storage variant-key helpers; `photo-service`
  reworked (add/replace/delete/setBest/list + `PHOTO_SELECT`/`toPhotoView`/`resolveDateCover`).
  (2) `POST`/`PUT /api/uploads/date-photo`; `<PhotoUploader>` (dropzone / multi / camera /
  per-file progress+cancel+retry). (3) `<PhotoGallery>` (1/2/masonry) + `<PhotoLightbox>`
  (swipe / zoom+pan / prev-next / caption / best / delete). (4) `Date.bestPhotoId` +
  `setBestCouplePhotoAction` + "most like us" prompt; `resolveDateCover` wired into
  home / calendar / memory / stats / pipeline (replaced `heroImageUrl`). (5) `<Photo>` primitive
  (aspect box, blur-up, lazy, `srcSet`, no `next/image`); sharp verified (2560/1400/480 + ~110 B
  blur). (6) `/media` +`immutable`+`noindex`+`no-referrer` headers, random-token keys; new
  `robots.ts` `Disallow: /`; no public index route. `tsc` / `eslint` / `next build` (40 routes)
  / `next dev` green. Needs DB + login. **DONE**
- Blind individual review system (6-part prompt): `DateReview` reshaped for private-until-both
  submission — `overallRating` now 1–10 & nullable, +`submittedAt` (draft vs submitted),
  +`suggestedOverall`, +`personalRevisit`(new `ReviewRevisit` enum)/note, +4 reflection cols;
  default categories → Food/Ambience/Hygiene/Adventure/Fun/Value. Pure `lib/review/scale` +
  `revisit` + `reflection-prompts` + `lib/date/review-reveal` (`reviewStage`). `review-service`
  rewritten: `getReviewContext` (context + stage + editable), `saveReviewDraft` / `submitReview`
  (compute `suggestedOverall`, notify partner or — on reveal — `notifyCouple`), `reopenReview`,
  reveal-locked `deleteReview`. `getDateExperience.review` reveal-gates partner data.
  `<ScoreScale>` (accessible 1–10), `<ReviewForm>` (context / categories / overall-with-suggestion
  / reflections / revisit / summary / draft+submit), `<ReviewWaiting>` ("Your side is saved" +
  edit/withdraw), `<ReviewReveal>` (combined /10 + per-category meters + side-by-side
  reflections), `<ReviewStatus>` on `/dates/[id]`. Dropped every `overallRating*2`; aggregates
  now filter `submittedAt: { not: null }`. `tsc`/`eslint`/`next build` (40 routes)/`next dev`
  green; state machine + suggestion logic sanity-checked. Needs DB + login. **DONE**
