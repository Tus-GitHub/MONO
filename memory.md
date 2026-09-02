# Project Memory — MONO

Last updated: 2026-09-02 (Prompts 30 launch-readiness + 31 mobile-keyboard fix — published)

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

- **Prod/PWA conversion (prompt 21+)** — Phases 0–8 done; prompts 30 (launch-readiness) + 31
  (mobile keyboard) done. **Next action: run `publish`.** Then real deploy per `DEPLOY.md`
  (needs a host + prod Neon branch + S3 bucket + domain/HTTPS). Outstanding non-blockers in
  `docs/pwa-conversion-checklist.md` (Lighthouse on the live origin, real-device passes, a
  reminder cron, SMTP for password-reset email).

### Done

- **Launch-readiness pass (prompt 30)** — completed 2026-09-02. See Task Log. Headline:
  full user-journey E2E (2 real couples, real UI) and a cross-couple authorization/IDOR sweep
  both **PASS, no broken flows, no data leak**; added 20 calculation/authz unit tests
  (**98 green**). No app code changed for §1/§2 — they held as built.
- **Mobile keyboard & viewport fix (prompt 31)** — completed 2026-09-02. See Task Log.
  Root causes: (a) `viewport` meta had no `interactive-widget` so Android's layout viewport
  didn't shrink for the keyboard; (b) the `fixed bottom-0` mobile bottom-nav floated on top of
  the keyboard over the last form row / Continue-Save button; (c) centred `Modal` +
  `max-h:100dvh` and `BottomSheet` `max-h:92dvh` anchored at `bottom:0` put their footer
  actions behind the keyboard on iOS (where `dvh`/`fixed` don't react); (d) auth/onboarding
  shells used `justify-center` in a `flex-1` column → a form taller than a shrunk viewport
  couldn't scroll to its top. Fix = `interactive-widget=resizes-content` + a
  `<ViewportManager>` that publishes `--kb`/`--vvh`/`[data-kb=open]` from `visualViewport`
  (cross-browser, incl. iOS) + focus-into-view assist; consumers react via tokens (nav slides
  away, modal top-aligns + caps to `--vvh`, sheet lifts by `--kb`, sticky bars clear the
  keyboard, auth/setup shells use `m-auto`+`overflow-y-auto`). Puppeteer-verified. No design
  or functionality change. `tsc`/`eslint`(0)/`vitest`(98)/`next build` green.

- **Prod/PWA conversion — Phase 8 (final UI/UX polish, prompt 29)** — completed 2026-09-02.
  No new deps, no rewrites. See the Task Log entry for detail. Headline: fixed a real mobile
  bug where the 1–10 review score scales overflowed a phone viewport (`.tap` min-width × 10
  cells = 476px) and clipped the 9/10 cells — scores 9 & 10 were untappable on any phone;
  now `h-11 min-w-0 flex-1`. Also: date-picker shortcut chips wrap instead of clipping; warm
  empty-state copy + actions on plan/memories/explore/notifications; pending/disabled/loading
  on every server-action button (status-control, lifecycle-buttons, review-waiting,
  photo-lightbox, expense-row, memory-form); `anim-pop` on favorite, `active:scale` press on
  score cells; softened the one stiff `error.tsx` line. tsc/eslint(0)/vitest(78)/build green.

- **Final implementation & quality pass (6-part prompt)** — completed 2026-09-02
  - **Journey (1):** traced Register→Profile→Connect→Couple Setup→Home→Plan→Place→Activities→
    Save→Date Day→Recap→Photos→Best Photo→Review→Combined Score→Revisit→Memory→Timeline→
    Explore→Plan Next. Every transition verified (redirect targets + "next action" links); no
    broken step.
  - **Business logic (2):** consolidated the score maths. `round1` + `mean` single-sourced in
    `lib/review/scale.ts` (`comparison.ts` / `couple/insights.ts` re-export for callers). New
    `lib/date/review-reveal.ts` `isRevealed(submittedCount, hasPartner)` +
    `dateCoupleScore(overalls, revealed)` now used by `history-service`,
    `couple-insights-service`, `explore-service`, **and `home-service`** — which previously
    showed a NON-reveal-gated "combined score" on Home (`getStats.averageScore10` +
    `getLatestMemory.combinedScore10`); fixed to match the rest of the app (a score never shows
    before both partners submit). Inline `Math.round(sum/len*10)/10` in `place-history` /
    `place-service` / `recommendation-service` → `averageScore` / `mean`.
  - **UI consistency (3):** shared primitives + design tokens confirmed — no rogue hex/px in
    components; every screen uses `PageHeader` / `Card` / `Button` / `EmptyState` / `Skeleton` /
    the `error.tsx` family. `/style` gallery renders every primitive overflow-clean at 390px.
  - **Animation (4):** CSS-only, reduced-motion-safe, one-shot on mount: `anim-pop` on the
    connected-couple avatars (`/onboarding/done`); `anim-scale-in` on the "It's a plan" alert +
    every form success/error (`FormFeedback`) + milestone chips; `anim-rise` on `<DateResult>`
    (date completed) and `<ReviewWaiting>` (review submitted). Reveal already staggered; rating
    stars already `anim-pop`. No JS, no perf cost.
  - **Testing (5):** added **vitest** (dev dep) + `test` / `test:watch` scripts +
    `vitest.config.ts` (`@` alias; `server-only`/`client-only` stubbed via
    `test/empty-module.ts`). **68 unit tests, 9 files, all green:** `scale`, `review-reveal`
    (state machine + isRevealed + dateCoupleScore), `comparison` (couple score = (a+b)/2,
    positive-only insights, revisit compat), `lifecycle` (every state transition + timestamps),
    `expense-split` ($60 SHARED→30/30, $50 CUSTOM owner-$15→15/35, resolvePayer/payerFacing),
    `expense-breakdown` (categoryBreakdown + budgetDelta tolerance), `compatibility` (coupleMatch
    determinism / bands / 40–98 clamp / null-when-thin), `timezone` (zoned 09:00 across DST),
    `authz/couple` (couple isolation — query scoped by session coupleId, NotFound for foreign,
    AuthorizationError for mismatched id; prisma + session mocked). **`prisma db push` run
    against Neon** — the live DB is now fully in sync with the schema (every prior-session delta
    applied; no data loss). `tsc` / `eslint`(0) / `vitest`(68) / `next build`(55 routes) /
    `prisma validate` + `generate` all green.
  - **Product standard (6):** no fake buttons / dead nav (every `href` resolves; no `href="#"`,
    no empty `onClick`, no TODO/placeholder markers in real code); `/style` is dev-only (404s in
    prod); `s3.ts` / `smtp.ts` are documented driver stubs (`local` + `console` drivers work).
    Real auth (bcrypt/JWT), real review maths (tested), real couple isolation (tested).
    Screenshot check: **30/30 public views** (light/dark × phone/tablet/desktop) with no
    horizontal overflow. No console errors in the dev log; `/api/health` → `database: "up"`.

- **Reliability & performance pass (6-part prompt)** — completed 2026-09-02
  - **Loading (1):** added route `loading.tsx` skeletons for `/explore`, `/dates/[id]`,
    `/notifications`, `/dates`, `/plan`, `/places/[id]` (the `(app)/loading.tsx` catch-all still
    backstops the rest). Progressive images, optimistic UI (`FavoriteHeart`, `RecFeedback`,
    best-photo, reorder) and pending states already in place from prior sessions.
  - **Errors (2):** new `(app)/error.tsx` (in-shell boundary, offline-aware copy, shows
    `digest`), `src/app/global-error.tsx` (root-layout failures, self-contained html/body),
    `(app)/explore/error.tsx` (place-provider-specific reassurance). `<PlacePickerSheet>` search
    now handles non-OK responses + offline, with a "Try again" retry and a caught error on the
    select action (no silent failure). Missing-record → `notFound()` already wired on
    `/dates/[id]` + `/memories/[id]`.
  - **Offline / weak network (3):** `lib/hooks/use-online-status.ts` (`navigator.onLine` +
    events, SSR-safe), `<OfflineBanner>` in `AppShell` (top strip, `role=status`/`aria-live`,
    "Back online" flash), `<OfflineNotice>` for forms, `lib/hooks/use-local-draft.ts`
    (localStorage mirror, `restored` flag, `clear()` on save) wired into `<MemoryForm>` (title +
    story survive a reload/crash/disconnect; "picked up where you left off" hint). The plan flow
    already server-autosaves each step (draft date persistence). Uploads already retry
    (`<PhotoUploader>` / `<ImageUpload>` per-item status + Retry). Nothing claims success on
    failure — actions surface the real `ActionState` error.
  - **Performance (4):** `getFavorites` N+1 (one `date.count` per favourite place) → single
    pass over completed dates. `getBestPhotoWallPage(cursor, take=48)` cursor pagination
    (ordered by `completedAt`) + `loadMoreBestPhotosAction` + `<PhotoWall>` infinite scroll
    (IntersectionObserver + "Load more" fallback, cross-page de-dupe). `.cv-auto`
    (`content-visibility`) utility on photo-wall + date-gallery tiles. Date history keeps its
    250-row cap and now says so. Explore/history/notifications stay server-rendered — no
    unnecessary client fetching (the place-picker fetch is the one interactive exception).
  - **Accessibility (5):** audit found the base already strong — `ScoreScale` `role=slider` +
    `aria-valuetext` + keyboard; `Modal`/`BottomSheet` focus-trap + `aria-modal` + escape +
    focus restore; icon buttons labelled; status/rating chips pair colour with text+icon
    (`ScorePill` shows the number, `RevisitTag`/`DateStatusBadge` carry a label + dot). New
    offline UI is `aria-live`. Global reduced-motion block covers the new transitions.
  - **Mobile (6):** `<StickyBar>` moved to `bottom-(--bottomnav-h)` (was `bottom-0`, overlapping
    the fixed mobile nav) → `lg:bottom-0`. Overflow guards (`min-width:0`, `overflow-x:clip`),
    safe-area utils, `.tap` 44px targets, swipe gallery, drag-dismiss sheets already in place.
  - `tsc` / `eslint` (0) / `next build` green.

- **Privacy & security implementation pass (6-part prompt)** — completed 2026-09-02
  - Full written audit at `docs/security.md` (endpoint-by-endpoint authz table, validation
    inventory, auth review, media review, destructive-flow table, privacy posture, residuals).
  - **Fixes shipped:**
    - **`/media/[...key]` path traversal** (broken access control) — a key with `..` segments
      (`couples/<mine>/../users/<victim>/…`) passed the couple-prefix membership check then
      resolved cross-boundary but still inside the storage root, so `resolveKey`'s
      escape-only check didn't catch it. Now `isCanonicalKey()` rejects any non-canonical key
      (`..`/`.`/empty segment, backslash, leading slash, control char) **before** prefix parsing,
      and `local.ts` `resolveKey` independently refuses a `..` segment. Also dropped
      `image/svg+xml` from the media MIME map and added `X-Content-Type-Options: nosniff`.
    - **Upload file validation** — `readImageUpload` now sniffs the leading bytes and only
      accepts a real JPEG/PNG/GIF/WebP/AVIF (the client `Content-Type` is discarded); size cap
      re-checked from actual byte length; added a same-origin `Origin` check (CSRF
      defence-in-depth for the plain route handlers) and an upload rate limit.
    - **Rate limiting** — new `lib/security/rate-limit.ts` (best-effort in-process sliding
      window keyed by client IP + tag). Applied to `login` 10/15m, `register` 5/15m,
      `password-reset-request` 4/60m, `password-reset` 10/15m, `couple-join` + `invite-accept`
      10/15m, `upload` 40/5m.
    - **Security headers** — `next.config.ts` `headers()`: CSP (`default-src 'self'`, no external
      script/style, `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors
      'none'`; `'unsafe-inline'` still allowed for Next's inline bootstrap — noted as a
      follow-up), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
      `Permissions-Policy` (camera/geo self only), HSTS in prod.
    - **Privacy UX** — new `/settings/privacy` page: "Your MONO space is private to the two of
      you" + six points (private / minimal collection / no public profiles / reviews never
      published / photos not on the open web / export & reversible exit). Linked from the
      settings hub.
  - **Verified good, no change:** every service authorizes via `authorize*` / `requireCoupleContext`
    (couple isolation is airtight); bcrypt cost 12 + timing-safe verify + no user enumeration +
    login re-hash; JWT session httpOnly/`Secure`(prod)/`SameSite=Lax` + `tokenVersion` global
    revocation; reset tokens (32B, SHA-256 only, single-use, 30m, session-kill) and invite
    tokens (24B, SHA-256 only, single-use, 72h/14d, revoke-on-reissue, txn); zod on every input
    (`idSchema`, `nativeEnum`, capped text, bounded money, capped arrays); Prisma parameterised,
    no `$queryRawUnsafe`/`eval`, only a static `dangerouslySetInnerHTML`; robots disallow-all +
    `noindex` meta + media `noindex` headers + no public routes; every destructive flow already
    re-authorizes + confirms (disconnect `useConfirm`, delete-account typed "DELETE", photo/
    expense/memory/date deletes `useConfirm`); no `console.*` logs a password or raw token;
    `AUTH_SECRET` validated at boot, server-only.
  - `tsc` / `eslint` (0) / `next build` (54 routes incl. `/settings/privacy`) green; `next dev`
    — headers emitted, `/media` traversal probes (`..%2F`, `%2e%2e`, literal `../../`) all 404,
    no 500s / log errors.

- **Notification & reminder system (6-part prompt)** — completed 2026-09-02. Hardening + gap-fill
  on the existing `Notification` / `DateReminder` / `NotificationPreference` infra.
  - Schema: `ReminderKind` +`CUSTOM`/+`MEMORY`; `NotificationType` +`DATE_NEEDS_ACTION`/
    +`REVIEW_REMINDER`/+`MEMORY_REMINDER`; `NotificationPreference` +`memoryReminder`. `prisma
    validate` OK; native `generate` EPERM-blocked by `next dev` (TS `.d.ts` current). Added to
    the migration-blocked backlog.
  - Pure libs: `lib/utils/timezone.ts` (`zonedTimeToUtc` / `todayYmdInTimeZone`, `Intl`-only —
    the day-of reminder is now 09:00 in the couple's own tz), `lib/notifications/prefs.ts`
    (`NOTIFICATION_CATEGORIES` + `CATEGORY_META` — one source of truth for the 6 toggles incl.
    the new `memoryReminder`), `lib/notifications/types.ts` (`NOTIFICATION_ICON`,
    `NOTIFICATION_CATEGORY_OF` / `REMINDER_CATEGORY_OF` pref-gate maps, `notificationHref` deep-
    link resolver), `lib/notifications/channels.ts` (server — `NotificationChannel` registry:
    `InAppChannel` authoritative + best-effort `PushRelayChannel`; `deliverNotification` fans a
    payload across all channels, `ok` iff the in-app row wrote — the "no hardcoded provider"
    seam).
  - `notification-service.fanOut` now **preference-gates** each recipient (`NOTIFICATION_CATEGORY_OF`)
    and **de-dupes** an identical `(user, type, entity)` within 10 min (60 min for `DATE_EDITED`,
    collapsing an edit flurry into one notification).
  - `reminder-service` rewrite: `upsertReminder` only re-fires a sent reminder if its time moved
    >1h; `ensureRemindersForDate` uses `couple.timezone`; new `ensureMemoryReminder` (COMPLETED +
    no memory → +1 day, self-clears), `setCustomReminder` / `clearCustomReminder` /
    `getUserDateReminders`, `snoozeReminder` (+1 day, clears sent/dismissed). `getDueReminders`
    excludes `CANCELLED` dates, retires reminders >2 days stale or whose date state no longer
    fits (`stateAllows`), pref-gates by kind. `dispatchDueReminders` — per-reminder try/catch,
    18h re-deliver guard, marks `sentAt` only when in-app delivery succeeded, routes through
    `deliverNotification`. REVIEW copy is now exactly "Your date is waiting for its review."
  - New notification triggers: `plan-service` edit fns call `notePlanEditToPartner`
    (`DATE_EDITED`, skipped for DRAFT/CANCELLED, dedupe-collapsed); `calendar-service.promoteDueDates`
    runs `nudgeStaleDates` (`DATE_NEEDS_ACTION` for a TODAY/IN_PROGRESS date >18h past its end,
    one per date per 24h, never for cancelled/deleted); `date-service.transitionDate` now always
    runs `ensureReviewReminders` + `ensureMemoryReminder` (so a reopen tidies up); `memory-service`
    save/delete re-runs `ensureMemoryReminder`.
  - Partner activity: `date-event-service.getPartnerActivity` — up to 3 grouped lines from
    `DateEvent`s since `activitySeenAt`, collapsing a run of one kind into a counted friendly
    summary ("added 3 photos" / "updated the plan" / "completed their review"); `<PartnerActivity>`
    replaces `<PartnerActivityBanner>` on Home, gated by the `partnerEdits` pref in `home-service`.
    Removed the now-dead `getUnseenPartnerEdit` / `PartnerEditView`.
  - UI: `/notifications` rebuilt — `<NotificationsList>` (client) groups New / Earlier, every row
    is a deep link that marks itself read on click (`markNotificationReadAction`), + a Settings
    link. `<DateReminderControls>` on `/dates/[id]` for PLANNED/TODAY — explains the auto
    reminders + set/clear one custom reminder (`datetime-local`). `notification-settings-form`
    now renders from `NOTIFICATION_CATEGORIES` (auto-includes memory reminders) with a
    "your settings only" note.
  - `tsc` / `eslint` (0) / `next build` (53 routes) / `next dev` (`/notifications`,
    `/settings/notifications`, `/dates/[id]` 307 unauth) green. Timezone math + dedupe windows +
    expiry rules reviewed. Needs DB + login to exercise end-to-end. Reminder dispatch is still
    opportunistic (fires on Home load) — the `getDueReminders` seam is where a cron/worker plugs in.

- **Explore discovery engine (6-part prompt)** — completed 2026-09-02
  - Schema: +`RecommendationFeedback` model (couple-shared, `@@unique([coupleId, targetType,
    targetKey])`) + `RecommendationTargetType` (PLACE|IDEA) / `RecommendationSignal`
    (INTERESTED|NOT_FOR_US|SAVED) enums; relations on `Couple` + `User` (Cascade). `prisma
    validate` OK; native `generate` EPERM-blocked by `next dev` (TS `.d.ts` regenerated).
  - Pure libs: `lib/explore/date-ideas.ts` (fixed 10-idea catalogue, each mapped to a
    `PlaceCategory` + copy), `lib/explore/compatibility.ts` (`coupleMatch` — deterministic
    weighted blend of both partners' historical category ratings + how closely they agree,
    40–98 clamp, plain `reason`; `percent: null` = "New territory", never invented; revisit-YES
    pinned to 94%), `lib/explore/visited.ts` (`classifyVisited` → new/visited/revisit/loved/
    avoid; `avoid` = last revisit NO **or** NOT_FOR_US feedback). `PLACE_CATEGORY_SHORT` added
    to `lib/date/place-category.ts`.
  - `explore-service.getExploreHome(coupleId, viewerId)` — one deterministic loader (no AI).
    Builds a per-member × place-category rating map (reveal-gated like reviews), per-place
    aggregate, city tally, done-categories set. Assembles up to 8 sections (Recommended for you
    / Because you loved X / Previously enjoyed / Nearby [most-visited city, not GPS] / Try
    something different [0-history categories] / Date ideas / Hidden gems [score ≥7, not a
    favourite] / Your saved places), drops empties, and **reorders by history depth** (≥3
    completed dates → personalised sections lead, else ideas lead). `avoid` places filtered from
    every recommendation section; only reappear in a deliberate search. Also exports
    `getRecommendationFeedbackMap` + `setRecommendationFeedback` (couple-scoped, place-ownership
    checked, idea-key checked; `signal: null` clears).
  - `actions/explore.ts` `recommendationFeedbackAction` (zod-validated, `revalidatePath("/explore")`).
    "Plan this" reuses existing `/plan?place=` / `/plan?idea=` → `startPlanAction`.
  - `/explore` rewritten: no query → `<ExploreHome>` discovery view; any `q`/`category`/`view`/
    `forDate` → existing `searchPlaces` grid (unchanged — the deliberate-search escape hatch),
    now with `<VisitedBadge>` + `<RecFeedback>` on saved-place cards.
  - Components (`components/explore/`): `explore-home`, `recommendation-card`, `idea-card`,
    `match-badge` (`MatchBadge`/`MatchReason`), `visited-badge`, `rec-feedback` (client,
    optimistic `useActionState` + render-phase reconcile). `place-card` gained `feedbackSignal`
    prop + visited badge.
  - `tsc` / `eslint` (0) / `next build` (53 routes) / `next dev` (`/explore` + all query modes
    307 unauth) green. Match formula + section gating + avoid-filtering reviewed. Needs DB +
    login to exercise.

- **Couple Profile + private relationship insights (6-part prompt)** — completed 2026-09-02
  - Schema: `User` +`theme String @default("system")` +`hideMoneyInsights` +`hidePartnerPreferenceGap`
    (privacy toggles). Only change. `prisma validate` OK; native-engine `generate` EPERM-blocked by
    the running `next dev` (TS `.d.ts` regenerated — `tsc`/`next build` see the fields). Added to the
    migration-blocked backlog alongside `DatePhoto.isFavorite`.
  - Pure `lib/couple/insights.ts` — `round1`, `buildCategoryPreferences` (per-category couple avg +
    per-person avg, each gated by `CATEGORY_MIN_SAMPLE=2` distinct rated dates),
    `findPreferenceGaps` (`GAP_MIN_SAMPLE=3`, `GAP_MIN_DELTA=1`; neutral phrasing only —
    "You rate X a little higher" / "…tend to enjoy X dates more" / "…consistently rate X higher"),
    `buildCoupleInsights` (top category by score, most-revisited type, best-value date =
    score÷spend, most-common activity, favourite place, avg spend — each emitted only when its
    guard passes). No prediction, no personality claims.
  - Pure `lib/settings/theme.ts` — `THEMES`/`Theme`/`isTheme`, `THEME_STORAGE_KEY`,
    `THEME_BOOT_SCRIPT` (tiny no-flash `<head>` script that reads localStorage).
  - `couple-insights-service.getCoupleProfile(coupleId, viewerId)` — the one loader for `/couple`.
    Reveal-gated: a completed date's couple score + category scores only count once **both**
    partners have submitted (solo couple = on submit), same rule as `reviewStage`. Returns
    profile + `DateStatistics` (total/completed/memories/places/cities, avg couple score **with**
    `scoredDateCount`, highest-rated always, **lowest-rated only when ≥2 scored dates and they
    differ**, favourite category, `totalSpendCents` = null vs real 0) + `CategoryPreference[]` +
    `preferenceBreakdownVisible` (false when viewer hid it) + `preferenceGaps` + `CoupleInsight[]`.
  - `user-settings-service` (`getUserSettings`/`updateUserSettings`/`setUserTheme`),
    `account-service` (`exportCoupleData` → full nested JSON view; `deleteAccount` → archive
    couple + soft-delete user + bump `tokenVersion`), `couple-service`
    +`getCoupleProfileForEdit`/`updateCoupleProfile`/`disconnectCouple` (archive: members→LEFT,
    couple→ARCHIVED, nothing hard-deleted).
  - `actions/settings.ts` — `updateCoupleProfileAction`, `updateUserSettingsAction`,
    `setThemeAction`, `disconnectPartnerAction` (→ redirect `/onboarding`),
    `deleteAccountAction` (typed "DELETE" gate → `clearSessionCookie` → redirect `/login`).
  - `validation/settings.ts` — `coupleProfileSchema`, `userSettingsSchema`, `themeSchema`,
    `deleteAccountSchema` (`z.literal("DELETE")`).
  - Routes: `/couple` rewritten as the profile + insights view (+ `loading`/`error`); new
    `/settings` hub (profiles links · Preferences form · Data export · Session sign-out ·
    Account danger zone) and `/settings/couple` (edit form); new `GET /api/export` (members-only,
    couple from session, `Content-Disposition: attachment`, `no-store` + `noindex`). Kept
    `/settings/profile` + `/settings/notifications`.
  - Components (`components/couple/`): `couple-profile-header` (photo/name/both people/pronouns/
    "together since"/3 figures), `date-statistics`, `category-preferences` (shared bars +
    per-person dots + neutral "Where your tastes differ" + framing line), `couple-insights`.
    (`components/settings/`): `preferences-form` (theme radio w/ live DOM preview + privacy
    checkboxes), `couple-profile-form`, `data-export-card`, `danger-zone` (disconnect via
    `useConfirm`; delete via revealed typed-confirm form), `theme-applier` (mounted in
    `(app)/layout`, reconciles server theme → `<html data-theme>` + localStorage).
  - Theme: `globals.css` now has `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }`
    + `:root[data-theme="dark"]` (duplicated var list); light needs no rule. Root layout injects
    `THEME_BOOT_SCRIPT` in `<head>`. Resolves the old "manual theme toggle" backlog item.
  - `tsc` / `eslint` (0) / `next build` (52 routes) green; `next dev` — `/couple` `/settings`
    `/settings/couple` 307 unauth, `/api/export` 401. Insight guards + reveal gate + neutral
    phrasing reviewed. Needs DB + login to exercise.

- **Dedicated Memories experience (6-part prompt)** — completed 2026-09-02
  - Schema: `DatePhoto` +`isFavorite Boolean @default(false)` + `@@index([isFavorite])` — the
    only schema change. `prisma validate` OK; native-engine `generate` still `EPERM`-blocked by
    the running `next dev` (TS client is current, so `tsc`/`next build` see the field).
  - Reused, not duplicated: `history-service` now **exports** `HISTORY_INCLUDE` (one
    `Prisma.DateInclude` with place-mini / bestPhoto / memory / photos-take-1 / revisit /
    reviews / activities / expenses / `_count.photos`) + `mapDateRowToItem(row, ctx)` — the
    single row→`DateHistoryItem` mapper. `getDateHistory` and every memory loader call it, so
    all card shapes share one code path. `DateHistoryItem` gained
    `placeId` / `placeIsFavorite` / `memoryId` / `memoryIsFavorite` / `memoryTitle`.
  - Pure `lib/date/milestones.ts` — `computeMilestones(itemsNewestFirst, { anniversaryMMDD })`
    → `{ byId, ordinals, citiesExplored }`. Every milestone maps to a real fact only:
    `first-date`, `nth-date` ([5,10,25,50,75,100,150,200,250]), `first-city` (first date in a
    city), `regulars` (3rd+ visit to one place), `anniversary` (MM-DD matches the couple's
    `anniversaryAt`), `top-score` (highest couple score, only once ≥3 scored dates). Caps
    2/date. `ordinalLabel(n)` → "10th". Never manufactures a milestone.
  - `photo-service`: `PHOTO_SELECT`/`toPhotoView` +`isFavorite`; new `togglePhotoFavorite`
    (authorizePhoto, flips), `getBestPhotoWall()` → `WallPhoto[]` (every completed date's
    `bestPhoto` + date/place context), `listFavoritePhotos()` → `WallPhoto[]`
    (`DatePhoto.isFavorite` within the couple). `WallPhoto` = `PhotoView` + `dateId`/`dateTitle`
    /`dateYmd`/`placeLabel`.
  - `memory-service` extended: `toggleMemoryFavorite`; private `loadCompleted()` (all completed
    dates once → mapped items + milestones); `getMemoryHome()` → `MemoryHome`
    (stats + favourite dates + recent memories + best-photo strip + milestone highlights);
    `getMemoryTimeline()` → items (each +`ordinal`+`milestones`) + citiesExplored;
    `getFavorites()` → favourite dates + favourite photos + favourite places (each with a real
    `visitCount`); `getMemoryDetail(memoryId, userId)` → `MemoryDetail` — **reshapes**
    `getDateExperience` output (hero photo, ordinal, milestones, couple score + top-3 combined
    categories, revisit + compat line, one-line spend + plan-divergence sentences, full photo
    list). Zero new business rules — all derived values come from existing services.
  - Routes (all under `/memories`, `<MemoriesNav>` segmented control — Journal / Timeline /
    Photos / Favourites — on each): `page.tsx` (Journal home — stats row, Moments list,
    Recent memories feature + grid, Best-of-us wall, Favourite dates grid; photo-dominant);
    `loading.tsx` + `error.tsx`; `timeline/page.tsx` (year-grouped spine of
    `<MemoryTimelineItem>`, cities-explored stat); `photos/page.tsx` (`<PhotoWall favoritable>`);
    `favorites/page.tsx` ("Our Favourites" — favourite dates / photos / places sections);
    `[id]/page.tsx` (`<MemoryDetailView>`, `notFound()` on `isAppError`).
  - Components (`src/components/memories/`): `memories-nav` (client segmented control),
    `favorite-heart` (client — optimistic heart, `useActionState`, render-phase reconcile,
    `plain`/`overlay` variants), `milestone-badge` (+`DateOrdinal` "Our 10th date" eyebrow),
    `memory-timeline-item`, `photo-wall` (client — masonry `columns` grid + portal `WallViewer`
    with keyboard/swipe nav, per-photo favourite heart, "Open date" link), `memory-detail-view`
    (server — full-bleed hero + overlay, milestones, story, "How it landed" card, plan/spend
    one-liners, read-only `<PhotoGallery>`, footer links). "Do not show unnecessary technical
    metadata" — the detail page omits ids/keys/status/pipeline entirely.
  - `<PhotoGallery>`/`<PhotoLightbox>` gained `readOnly` (threaded from `canManage`) so the
    memory detail's gallery has no edit chrome. `<FavoriteHeart>` wired into the `/dates/[id]`
    memory card (heart + "Open in Memories") and every managed `<PhotoGallery>` tile
    (`overlay` heart, top-left, opposite the best-photo star).
  - Actions: `server/actions/memories.ts` `toggleMemoryFavoriteAction` (revalidates
    `/memories` + `/` layouts); `server/actions/photos.ts` +`togglePhotoFavoriteAction`
    (revalidates `/dates/[id]` + `/memories`). Both `idSchema`-validated, couple-authorized.
  - `tsc` / `eslint` (0) / `next build` (45 routes, incl. `/memories`, `/memories/[id]`,
    `/memories/{timeline,photos,favorites}`) green; `next dev` — `/` 200, all five memory
    routes 307 → `/login` unauthenticated. Milestone rules sanity-checked. Needs DB + login to
    exercise end-to-end.

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

- **~~Provision PostgreSQL~~ — DONE 2026-09-02.** Live DB is **Neon** (`neondb`, ap-southeast-1),
  connected via pooled `DATABASE_URL` in `.env` and **`prisma db push`** (all 20 tables live,
  no migration files). Full relational smoke test passed; `/api/health` → `database: "up"`.
  Still open: (a) real `AUTH_SECRET` for prod (dev one is insecure), (b) visual QA of every
  authenticated screen is now unblocked (onboarding, `/invite/[token]`, home, calendar, upcoming,
  notification settings, nav shell, `/dates/[id]` day mode + recap + photo gallery/lightbox/
  uploader + review form/waiting/reveal + spending/split/value-for-money), (c) if switching to
  `prisma migrate`, add a `SHADOW_DATABASE_URL` (2nd Neon DB) and generate the initial migration.
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
- **~~Pending schema deltas not `db push`ed~~ — DONE 2026-09-02.** `prisma db push` run against
  Neon with no dev server holding the engine lock; the live DB is fully in sync (all deltas
  from the Memories / Couple-profile / Explore / Notification / Security passes applied — 26
  tables, no data loss). `prisma generate` also re-run cleanly (no more Windows `EPERM`; that
  only happens while `next dev` holds the native `.dll.node`).
- **Reminder dispatch has no scheduler yet.** `dispatchDueReminders(userId)` is called
  opportunistically from `getHomeData`, so due reminders only fire when that user opens Home.
  A real cron / queue worker calling `dispatchDueReminders` per user is still needed — the seam
  is `reminder-service.getDueReminders(userId)`, which already returns pref-filtered,
  expiry-checked rows for a worker/endpoint to hand to `deliverNotification`.
- Wire a real push provider: implement `WebPushChannel` in `src/lib/notifications/push.ts`
  (VAPID keys) and return it from `getPushChannel()`; `PushRelayChannel` in
  `src/lib/notifications/channels.ts` already relays through it, and the subscription plumbing
  (`savePushSubscriptionAction` → `NotificationPreference.pushSubscription`) is in place. Add an
  email channel by dropping another `NotificationChannel` into `getNotificationChannels()`.
- Wire real Google OAuth credentials (architecture done; returns 501 until then).
- Wire real email transport — SMTP driver (`console` driver active now).
- Build feature pages — all nav destinations are now real. (Done: Plan a date flow, Our Dates
  history, Memories experience, Explore/Places, Expenses, Reviews, Couple profile + settings.)
- Visual verification of authenticated screens (home/dates/couple/etc. + nav shell) is blocked
  on the database — no login is possible until `DATABASE_URL` is real.
- Migrate `package.json` Prisma seed config to `prisma.config.ts` before Prisma 7.
- Dev-only advisory: `deepmerge-ts` via `prisma` CLI — clears on a Prisma release.
- ~~Manual light/dark theme toggle~~ — DONE 2026-09-02. `User.theme` (`system`/`light`/`dark`),
  `:root[data-theme=…]` blocks in `globals.css`, no-flash `<head>` boot script + `<ThemeApplier>`
  in `(app)/layout`, switcher in `/settings` (`<PreferencesForm>`).

## Task Log

### 2026-09-02

- **Mobile keyboard & viewport overflow fix (prompt 31).** No new deps. No design/functionality
  change. No rewrites.
  - **Diagnosis (real conflicts, not guesses):**
    1. `src/app/layout.tsx` `viewport` had **no `interactive-widget`** → Android Chrome keeps
       the layout viewport (and `dvh` / `position:fixed` / sticky) unchanged when the keyboard
       opens, so it just covers the bottom of the page.
    2. `BottomNav` is `fixed inset-x-0 bottom-0` → iOS Safari lifts it to sit *on top of* the
       keyboard, directly over the last form field / the Continue·Save·Submit button; Android
       (once the layout viewport resizes) does the same.
    3. `Modal` — `flex items-center` wrapper + panel `max-h-[calc(100dvh-2rem)]`. On iOS `dvh`
       doesn't shrink for the keyboard, so a centred panel's lower half (footer actions) ends
       up behind the keyboard.
    4. `BottomSheet` — `items-end` + `max-h-[92dvh]` anchored to `bottom:0` → footer (Save /
       Add) behind the keyboard; `92dvh` doesn't shrink on iOS.
    5. `(auth)/layout.tsx` + `setup-shell.tsx` — `justify-center` / `items-center` on a
       `flex-1` column: a form taller than a keyboard-shrunk viewport can't scroll to its top
       (flex centring clips the overflow, no scroll origin).
    6. `place-detail.tsx` sticky action bar sat at `bottom-0` → already *behind* the fixed
       bottom nav on mobile (pre-existing), and behind the keyboard.
  - **Fix — CSS-first, one small JS helper, no hardcoded keyboard height:**
    - `viewport.interactiveWidget = "resizes-content"` (Chromium honours it; iOS ignores it and
      is covered by the JS below).
    - New **`src/components/system/viewport-manager.tsx`** (mounted once in `AppProviders`, so
      it also covers login/register/onboarding). From `window.visualViewport` it publishes on
      `<html>`, on a rAF: `--kb` (px the keyboard covers = `innerHeight - vv.height -
      vv.offsetTop`), `--vvh` (true visible height px), and `data-kb="open"` past a 120px
      threshold. Plus a `focusin` assist: 300 ms after a field focuses, if it's clipped by the
      keyboard band it `scrollIntoView({ block: "nearest", behavior: "smooth" })`. No
      `visualViewport` (old browsers / desktop) → total no-op, `dvh` fallbacks apply.
    - `globals.css`: `:root { --kb: 0px }`; coarse-pointer `scroll-margin-top/bottom` on
      inputs (clears the sticky header for the nearest-scroll); **unlayered** rules —
      `.mono-bottom-nav` → `translateY(110%)` + `opacity:0` under `html[data-kb="open"]`
      (keeps its transition); `html[data-kb="open"] .above-bottom-nav { bottom: calc(var(--kb)
      + safe-inset) }` (nav is gone, only clear the keyboard); `html[data-kb="open"]
      .mono-modal-wrap { align-items: flex-start }`.
    - `Modal`: wrapper gets `mono-modal-wrap`; panel `max-h` → `calc(var(--vvh,100dvh)-2rem)`.
    - `BottomSheet`: outer wrapper `inset-x-0 top-0` + inline `style={{ bottom: "var(--kb,0px)" }}`
      + `transition-[bottom]`; panel `max-h` → `calc(var(--vvh,92dvh)-1rem)`.
    - `bottom-nav.tsx`: added the `mono-bottom-nav` class.
    - `photo-lightbox.tsx` (has a caption `<input>`): same `top-0` + `bottom: var(--kb)` treatment.
    - `place-detail.tsx` sticky bar: `bottom-0` → `above-bottom-nav sticky z-20` (+ `sm:` resets)
      — now clears the bottom nav *and* the keyboard.
    - `(auth)/layout.tsx` + `setup-shell.tsx`: `justify-center`/`items-center` → `overflow-y-auto`
      on the column + `m-auto` on the card (centres when it fits, scrolls both ends when short).
  - **Verified (puppeteer @ 390×780, `--kb`/`data-kb` injected exactly as ViewportManager
    would):** bottom nav in-view at rest → `translateY(110%)`/opacity 0 with keyboard open;
    focused plan-basics `title` input sits inside the visible band; bottom sheet bottom edge
    lifts to the keyboard line, top stays on-screen, `max-height` caps to `--vvh`; confirm
    Modal switches to top-aligned, both actions visible, panel capped to `--vvh`. `tsc` /
    `eslint` (0) / `vitest` (**98**) / `next build` all green. At rest (`--vvh`/`--kb` unset)
    every `var(--vvh, …)` falls back to the old `dvh` value — zero change with no keyboard.
- **Launch-readiness pass (prompt 30).** No app code changed for §1/§2 (they held as built);
  +20 unit tests.
  - **§1 Full user-journey E2E — PASS** (puppeteer, real UI drive, two real couples):
    register A1/A2 → profile → connect (invite code) → couple setup → **both reach `/home`,
    two members one space** · plan wizard (basics: title + calendar day → Save & continue →
    `?step=review` → **Save the plan** creates the date) · **A2 independently sees the date A1
    planned** · Start the date → Recap (record reality, spend) saved → **Add expense** via
    sheet → **2 photos uploaded** (canvas PNG → `/api/uploads/date-photo`) → **best photo**
    set → **Complete date** · **Review A1 submitted → Review A2 submitted → combined reveal
    shows a couple score** · revisit decision · **memory saved** · memories / timeline /
    photos / favorites / explore / couple profile / history / notifications **all render** ·
    can start the next plan. **No broken flows found.**
  - **§2 Authorization / IDOR — PASS.** Couple B (own ACTIVE couple) attacking couple A by id:
    `GET /dates/<A>` `/recap` `/review` `/memory` → `notFound()` render, **no couple-A text in
    the body**; `GET /media/<A photo key>` → **404, no bytes**; `POST /api/uploads/date-photo
    ?dateId=<A>` → **404**; `GET /api/export` → 200 **own couple only**; `/settings/couple` →
    **own space only**. (`notFound()` streams as HTTP 200 in this Next build but renders the
    not-found UI — data is not exposed.) Extended `src/lib/authz/couple.test.ts` +2 tests:
    `authorizePhoto`/`authorizeExpense`/`authorizeMemory`/`authorizeReview` all throw
    `NotFoundError` for a foreign id and scope every query by the session couple id.
  - **§3 Calculation tests — added 18** (`vitest` total **98**, 14 files):
    `src/lib/couple/insights.test.ts` (11) — `round1` half-up; `buildCategoryPreferences`
    couple-avg = equal-weighted mean, `CATEGORY_MIN_SAMPLE=2` gate, per-member gate on that
    member's own distinct-date count, category order preserved; `findPreferenceGaps` —
    `GAP_MIN_SAMPLE=3` + `GAP_MIN_DELTA=1` gates, "You" vs partner-name subject, no
    problem/conflict language, skipped for a solo couple; `buildCoupleInsights` — emit only
    when data present, hide every money insight when `moneyHidden`, revisit-count
    pluralisation. `src/lib/date/value-for-money.test.ts` (3) — unknown until spend + revealed
    value score both exist, 8+/6–7/<6 → great/fair/steep, no negative tone. `src/lib/explore/
    visited.test.ts` (4) — `classifyVisited` avoid > loved, score thresholds, only "avoid"
    suppressed. (Combined couple score / overall / rating deltas / revisit-compat / expense
    split / budget delta / recommendation match already had tests.)
  - **§4 device matrix** — the deep mobile-keyboard/viewport work is prompt 31 (above). Prior
    coverage: Phase 8 390px authed audit (0 horizontal overflow on 20+ routes; fixed the
    review-slider `.tap` clip and the date-picker chip clip). Real-engine Safari/Firefox and
    real iOS/Android device passes remain in the checklist as non-blockers.
  - **§5 production env** — Phase 7 already verified `next start` with real prod env end to end
    (`/api/health` up, signup+bcrypt persistence, session survives reload, 10 authed pages
    200/0-overflow, manifest valid, `/offline` reachable, SW registers; prod env guard fires on
    a placeholder secret). No regression since. Real HTTPS origin + storage + email are
    deployment-time (DEPLOY.md §7).
  - **§6 final standard** — no major TS errors (`tsc` 0), no broken navigation (journey E2E),
    no fake functionality / mock data in prod (Phase 0 confirmed; seed guarded), no
    unauthorized data access (§2), no accidental public photos (`/media` 404 + `robots`
    disallow-all + `noindex` headers), no major mobile layout problems (Phase 8 + prompt 31),
    production build succeeds, PWA manifest/SW verified (Phase 2/7), **two users use one couple
    space independently** (§1 E2E). Ready to `publish` and deploy.
  - Note: `registerAction` is rate-limited 5/15m per IP and Neon's pooled endpoint has a low
    connection cap — repeated full E2E runs from one machine hit both. Correct app behaviour;
    run the E2E once against a freshly-started dev server (restart clears the in-process limiter).

- **Prod/PWA conversion — Phase 8 (final UI/UX polish, prompt 29).** No new deps. No rewrites.
  - **§1 Visual consistency:** swept accidental hover-bg one-offs to the codebase-standard
    bracket token — `hover:bg-ink/3`|`/6` → `hover:bg-ink/[0.06]` / `hover:bg-paper/70`
    (`month-calendar`, `day-detail-panel`, `plan/page`, `explore` inline `activity-row`-style
    buttons) and added the missing `transition-colors` on them. Rest of the system already
    uses `src/components/ui/**` primitives + tokens — no rogue hex/px found.
  - **§2 Empty states:** warmer copy + a real action —
    `plan` ("Nothing half-planned right now" / "Start above — every step saves as you go…"),
    `memories` ("The best part comes after the date."),
    `explore` ("Find somewhere worth remembering." + *Add a place*),
    `notifications` ("You're all caught up." + *Choose what MONO tells you*).
    history/upcoming/favorites/timeline empties reviewed — already fine.
  - **§3 Microinteractions:** `favorite-heart` pops (`motion-safe:anim-pop`, 280ms) when it
    becomes a favourite; `score-scale` cells get `motion-safe:active:scale-[0.97]` press
    feedback. Partner-connect (invite copy = icon swap + toast + "Copied"), onboarding forms
    (`SubmitButton pendingText`), reveal/`anim-rise` — already good, left as-is.
  - **§4 Error & loading UX — "no button clickable while processing":** added
    pending/`disabled`/`loading` to every server-action trigger that lacked it —
    `status-control` (`isPending` + per-target `running`), `lifecycle-buttons`
    (`useActionState` `isPending` → `loading` on Start/Complete, click guarded),
    `review-waiting` (`reopening`/`discarding`/`busy`), `photo-lightbox` (`ChromeButton`
    gained a `busy` prop → make-best star disables while pending), `expense-row` (Save →
    `SubmitButton`, delete/edit `disabled={deleting}` + trash→clock icon), `memory-form`
    (Remove-memory `loading`/`disabled`). `rec-feedback` / `partner-activity` /
    `notifications-list` reviewed — fine (optimistic / navigate-away).
  - **§5 Mobile-first re-audit (puppeteer @ 390px + measured, logged in as the admin couple):**
    zero horizontal overflow across 20+ authed routes. **Two real clipping bugs found & fixed:**
    1. **`ScoreScale` (the 1–10 review sliders) overflowed the viewport** — each cell carried
       `.tap` (`min-width: 2.75rem`), so 10 cells + gaps = 476px inside a 390px screen, and an
       ancestor clip hid cells **9 and 10** — those scores were unreachable on every phone.
       Fixed: `tap h-9` → `h-11 min-w-0 flex-1` (keeps a 44px-tall touch target; width shares
       the row). Re-measured: row 358px, all 10 cells visible, no clip.
    2. **`date-picker` "When?" shortcut chips** (`scroll-x no-scrollbar`) clipped "Next weekend"
       with no scroll affordance → `flex flex-wrap gap-2` (4 short chips wrap cleanly).
    Bottom nav / sticky "Plan a date" / safe areas / recap form / long titles / calendar grid /
    404 page all check out at 390.
  - **§6 Emotional quality:** product voice is already warm & personal throughout ("you two",
    "How was it, really?", "the bit you'll both bring up years from now"); `/dashboard` is
    already just a redirect to `/home` (rename long done). Softened the one stiff line —
    `error.tsx` "The error has been logged. You can try again." → "It's been noted on our end —
    nothing you did. Give it another try."
  - Verified: `tsc` clean · `eslint .` 0 · `vitest run` **78/78** · `next build` compiled
    successfully (all routes, exit 0). Temp puppeteer scripts + seed dates removed. Checklist
    `docs/pwa-conversion-checklist.md` §2 updated. **DONE**
- **Prod/PWA conversion — Phase 7 (deployment prep).** One new dep: `@aws-sdk/client-s3`
  (S3-compatible; justified).
  - **Env / secrets:** `.env*` git-ignored, `git ls-files` shows nothing sensitive committed.
    `env.ts` gained a `superRefine` `productionSafe` guard — a *running* prod server throws on a
    placeholder `AUTH_SECRET` / localhost `DATABASE_URL` / non-https `APP_URL` / `s3` driver
    without creds; soft-warns on `local` storage in prod; **skipped during `next build`** via
    `process.env.NEXT_PHASE === "phase-production-build"`. `prisma/seed.ts` refuses
    `NODE_ENV=production` unless `-- --force`.
  - **Migrations:** created `prisma/migrations/20260902000000_init/migration.sql`
    (`prisma migrate diff --from-empty --to-schema-datamodel`, 737 lines) + `migration_lock.toml`;
    the dev Neon DB (built via `db push`) bootstrapped with `migrate resolve --applied` →
    `prisma migrate status` = up to date. `package.json`: new `vercel-build` =
    `prisma generate && prisma migrate deploy && next build` (Vercel auto-prefers it; local
    `build` unchanged), `db:status` script.
  - **Production storage:** `src/lib/storage/s3.ts` is now a real `S3StorageDriver` (put/get/
    delete/exists, `NoSuchKey`→`NotFoundError`, private — no ACL, served only via the auth'd
    `/media` route). Env `S3_BUCKET`/`S3_REGION`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/
    `S3_ENDPOINT`(blank=AWS)/`S3_FORCE_PATH_STYLE`. Added to `serverExternalPackages`.
    **5 unit tests** (mocked `S3Client.send`). Also: corrupt-but-sniffed image → 400 (was in
    Phase 5), `uploadErrorResponse` ZodError → 400.
  - **HTTPS:** session cookie already `secure: isProduction` + `httpOnly` + `SameSite=Lax`;
    `APP_URL` used for invite/reset/OAuth URLs; HSTS/CSP/frame headers prod-only in
    `next.config.ts` (unchanged).
  - **`DEPLOY.md`** — full provider-agnostic runbook (environments table, every env var,
    Neon setup + migration procedure + rollback, private-bucket setup, Vercel deploy, domain +
    HTTPS, and the §7 post-deploy verification checklist).
  - **Verified (prod build, `next start` NODE_ENV=production, real secret + https APP_URL):**
    `/api/health` up · signup → onboarding · new user persisted w/ bcrypt hash · session valid
    + survives reload · login as connected couple → `/home` · 10 authed pages 200/no-error/
    0-overflow · manifest valid · `/offline` reachable · SW registers+activates. Prod env guard
    proven: placeholder `AUTH_SECRET` → request 500 with the reason.
  - tsc/eslint/**vitest 78**/`next build` green. Checklist §10 updated. **DONE**
- **Prod/PWA conversion — Phase 6 (notifications).** No new npm deps — web push hand-rolled on
  `jose` (already present) + Node `crypto`.
  - **Real Web Push:** `src/lib/notifications/web-push.ts` `WebPushChannel` — RFC 8291 key
    derivation + RFC 8188 `aes128gcm` payload encryption + RFC 8292 VAPID (ES256 JWT via jose).
    `getPushChannel()` returns it when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` env set, else the
    existing `NoopPushChannel`. `env.ts` gained `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
    `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (all optional). `scripts/generate-vapid.mjs`
    (`npm run vapid`) — a keypair is in `.env` (subject `mailto:notifications@mono.local`).
    **`web-push.test.ts` (5 tests): compliant-client decrypt round-trip passes, VAPID JWT
    verifies, 410 → `PushSubscriptionGoneError`** (→ `PushRelayChannel` auto-clears the sub via
    `setPushSubscription(userId, null)`).
  - **SW (`public/sw.js` → `mono-v2`):** `push` → `showNotification`; `notificationclick` →
    focus a matching tab or open one.
  - **Client:** `enable-browser-notifications.tsx` rewritten — benefit-first copy, **never
    prompts on load**, `Notification.requestPermission()` → `pushManager.subscribe(...)` →
    `savePushSubscriptionAction`; "Turn off" unsubscribes. State machine: `unsupported` /
    `not-configured` (no VAPID) / `ios-needs-install` / `denied` / `off` / `on` — the first four
    show a message and **no button** (no broken control).
  - **Reminders app-wide:** new `<ReminderPoller>` in `app-shell` calls a new
    `dispatchMyRemindersAction()` on mount / every 10 min visible / on focus (was Home-only via
    `getHomeData`). Still no cron.
  - **Verified (puppeteer + Prisma):** opt-in (no load prompt), graceful degradation (APIs
    deleted → message, no button), poller delivers a due reminder once, second dispatch **no
    duplicate**, **cancelled-date** reminder doesn't fire, **disabled category** suppresses its
    reminder. The 6 events + pref gating + timezone + stale-retire were already wired in
    `reminder-service` / `review-service` / `plan-service` / `notification-service` — reviewed,
    not rebuilt.
  - Also hardened in Phase 6: `uploadErrorResponse` maps `ZodError` → 400.
  tsc/eslint/vitest(73)/`next build` green. Checklist §6 updated. **DONE**
- **Prod/PWA conversion — Phase 5 (photo experience).** No new deps.
  - **Upload:** `photo-uploader` rewritten around a `MAX_CONCURRENT = 3` imperative queue
    (refs + `pumpRef`) so a 20-photo drop never stalls the tab; new `queued`/`preparing` states;
    **cancel** now also pulls a still-queued item; **retry** re-queues the already-prepared
    `File` (no re-select); an `online` listener auto-re-queues every `error` item; clearer
    failure copy (413 → "too large", offline → "You're offline").
  - **Image processing:** `client-resize.ts` — `createImageBitmap(file, {imageOrientation:
    "from-image"})` bakes EXIF rotation into the pixels BEFORE the canvas strips EXIF (was the
    default `"none"` → sideways portraits). Verified e2e: a 3000×2000 JPEG tagged orientation 6
    stored upright 1707×2560. `sharp-processor` wraps its pipeline → a corrupt-but-sniffed image
    now throws `ValidationError` (400) instead of 500.
  - **Best photo:** `photo-gallery` shows a toast + disables the star while pending (`bestPending`,
    prevents double-fire) on top of the existing ring + "Most like you" badge; bigger 36px hit
    targets. `Date.bestPhotoId` → `resolveDateCover` stays the one cover source of truth;
    `setBestCouplePhotoAction` `revalidatePath("/", "layout")` propagates to home/memories/
    timeline/couple/stats. Verified: DB `bestPhotoId` set + `BEST_PHOTO_SET` event logged.
  - **Privacy re-audit (puppeteer):** `/media` foreign-couple / foreign-user / `..` / dotdot /
    bare key → all 404; upload to a foreign valid-cuid `dateId` → 404 **before** the sharp
    pipeline (new `assertDatePhotoUploadable` / `assertPhotoReplaceable` pre-checks in the
    route); malformed id → 400 (`ZodError` mapped in `uploadErrorResponse`); unauth `/media` →
    404. Headers already `noindex, noimageindex` + `cache-control: private`.
  - tsc/eslint/vitest(68)/`next build` green. Checklist §5/§11 updated. **DONE**
- **Prod/PWA conversion — Phase 4 (Android + desktop cross-compat + breakpoints).** No new deps,
  no per-browser forks.
  - **Back button:** new `useBackButton(onClose, active)` in `_dialog-primitives` — History API
    (push a throwaway entry on open, `popstate` → close, `history.back()` to pop it on any other
    close; `onClose` via a ref synced in an effect to satisfy `react-hooks/refs`). Wired into
    `<Modal>` (⇒ `useConfirm`), `<BottomSheet>`, `<PhotoLightbox>`, photo-wall `WallViewer`.
    Android/desktop Back (and back-swipe) now closes the overlay instead of leaving the page.
  - **Safari/Firefox CSS:** `-webkit-backdrop-filter` confirmed present in compiled CSS (Tailwind
    v4 emits it) — no change needed. `.scroll-area` gains `scrollbar-width: thin` +
    `scrollbar-color` for Firefox. `.skeleton` gains a flat `background: var(--color-line)`
    fallback before the `color-mix(in oklab …)` line (Safari < 16.2). No `:has()` /
    `text-wrap: balance` / container queries anywhere.
  - **Verify (puppeteer vs `next start`):** width sweep **320/375/390/430/768/1024/1280/1440 ×
    12 routes = 96 loads — 0 h-overflow, no errors, `<main>` present everywhere**; cross-UA
    (Android Chrome / macOS Safari / Firefox / Edge UA strings) → identical layout, nav+bell,
    0 overflow; **back-button test**: open the disconnect confirm dialog → browser Back → dialog
    closes, still on `/settings`. tsc/eslint/vitest(68)/`next build` green. 320px `/home` is
    dense (install banner wraps to 3 lines) but legible + no overflow — noted in checklist.
  Checklist §1/§3 updated. **DONE**
- **Prod/PWA conversion — Phase 3 (iPhone Safari + installed-PWA polish).** No new deps.
  - **Safe areas:** new `.above-bottom-nav` (`calc(--bottomnav-h + env(safe-area-inset-bottom))`)
    on `<StickyBar>` so a sticky Save row clears the nav AND the home indicator; new
    `.dialog-inset` (`max(1rem, env(safe-area-inset-*))`) on `<Modal>`. Header `pt-safe`, bottom
    nav `pb-safe`, bottom sheet `pb-safe` already there.
  - **Viewport:** last raw `100vh` (`global-error.tsx`) → `100dvh`. `<Modal>` now
    `max-h-[calc(100dvh-2rem)] flex-col overflow-hidden` with the body in a `scroll-area` —
    usable in landscape / keyboard-up. `min-h-dvh` everywhere else already.
  - **iOS focus-zoom:** UNLAYERED `@media (pointer: coarse){ input/select/textarea{font-size:16px} }`
    in `globals.css` — unlayered so it outranks Tailwind's `@layer utilities` `sm:text-sm`,
    fixing landscape phones too (the earlier `@media (max-width:639.98px)` attempt missed
    landscape). Reverted the interim per-component `text-base sm:text-sm` churn.
  - **Photo/camera:** new `src/lib/images/client-resize.ts` `downscaleImage` — `createImageBitmap`
    → canvas → `toBlob("image/jpeg",0.82)` at ≤2560px, run BEFORE `validateImageUpload`. Fixes
    the real bug where an iPhone camera capture (HEIC, not in `IMAGE_UPLOAD.accept`) was
    rejected. Wired into `photo-uploader` (+ `"preparing"` status), `quick-photo-button`,
    `image-upload`. Camera permission still only on explicit "Take a photo" (`<input capture>`,
    no `getUserMedia`).
  - **Gestures:** `EDGE_GUARD = 24px` in `photo-lightbox` + `photo-wall` — a swipe starting at
    the screen edge is left to Safari's back/forward gesture; swipe stays optional (44px
    prev/next buttons + arrow keys remain).
  - **Verify:** tsc/eslint/vitest(68)/`next build` green. Puppeteer iPhone audit (UA + 390×844
    & 844×390, `isMobile`+`hasTouch`, `next start`): **15 screens × portrait + landscape all
    clean** — 0px h-overflow, every field ≥16px (incl. landscape), no console errors, no raw
    100vh. `env()` safe-area is 0 in headless so notch rendering is code-reviewed, not shot.
  Checklist §4/§5/§13 updated. **DONE**
- **Prod/PWA conversion — Phase 2 (PWA infrastructure).** No new deps (hand-rolled SW; icons
  via the existing `sharp`).
  - **Manifest:** `src/app/manifest.ts` → `/manifest.webmanifest` — `start_url:/home`, `scope:/`,
    `display:standalone`, `orientation:portrait`, `theme_color`/`background_color` `#f5f1ea`,
    `id`, `categories`, 4 icons (192/512 `any` + 192/512 `maskable`).
  - **Icons:** `scripts/generate-icons.mjs` (`npm run icons`) rasterises the ring+disc mark on
    the ink ground → `public/icons/icon-{192,512}.png` (rounded), `icon-maskable-{192,512}.png`
    (full-bleed, ~44% safe-zone), `src/app/apple-icon.png` 180 (square opaque). Committed.
  - **Standalone:** `metadata.appleWebApp {capable, title:"MONO", statusBarStyle:"default"}`
    (Next emits `mobile-web-app-capable`, apple title/status-bar meta, apple-touch link).
    Safe-area + consistent nav already done in Phase 1.
  - **Service worker:** `public/sw.js` — `VERSION="mono-v1"`; precache `/offline`+icons+manifest;
    cache-first `/_next/static/**` + static img/font; network-first navigations → `/offline`;
    `/api/**` & `/media/**` never intercepted; `activate` purges non-`VERSION` caches;
    `SKIP_WAITING` message handler. `next.config.ts`: `/sw.js` `no-cache,no-store` +
    `Service-Worker-Allowed:/`, CSP `worker-src`/`manifest-src 'self'`. `proxy.ts` matcher
    excludes the PWA static files. `/offline` route = tiny inline-styled page + `<OfflineRetry>`.
  - **Registration:** `<ServiceWorkerManager>` in root `layout.tsx` — **prod only** (dev
    untouched), update-detected → "MONO just updated · Refresh" bar → `postMessage` →
    `controllerchange` → one reload; `reg.update()` on tab refocus.
  - **Install:** `<InstallPrompt>` — `variant="banner"` on Home (snooze 14d, ≤3 nudges),
    `variant="card"` in Settings (always). `beforeinstallprompt` for Chromium; iOS Safari gets
    "Share → Add to Home Screen" copy; hidden when standalone/installed; `appinstalled` sets a
    permanent flag. Env read via `useSyncExternalStore` (no hydration mismatch).
  - **Verify:** tsc/eslint/vitest(68)/`next build` green (37 static pages; new `/manifest.webmanifest`
    `/apple-icon.png` `/offline`). Puppeteer vs `next start`: manifest valid + right content-type;
    all 5 icons load at correct dims; SW registers+activates (scope `/`); online nav OK;
    **server killed → nav falls back to `/offline`**, precached shell + cached fonts/CSS/JS still
    serve, **`/api/health` does not** (privacy). CDP offline-mode doesn't reach SW fetch context —
    killing the server is the valid test.
  Checklist §1 + §11 CSP updated. **DONE**

- **Prod/PWA conversion — Phase 1 (responsive UI transformation).** No rewrites; targeted on a
  strong existing foundation.
  - **Navigation:** new `src/components/navigation/app-header.tsx` — a persistent header on
    every authed page. Mobile = compact bar (logo + Explore + notifications bell w/ unread badge
    + account-menu popover). Desktop = slim right-aligned strip (bell + account menu:
    Couple / Your profile / Settings / Sign out). Popover is a11y-complete (haspopup/expanded,
    Escape→restore focus, outside-pointer close, close-on-nav via onClick not effect). Deleted
    `navigation/top-bar.tsx`; `app-shell.tsx` uses `AppHeader`; `(app)/layout.tsx` now fetches
    `getUnreadNotificationCount`. `home-header.tsx` lost its local bell/profile cluster (now
    global). **Fixes the gap where notifications/profile were reachable only from `/home`.**
  - **Desktop widths:** `--content-narrow` 44rem / `--content-max` 72rem (was 68) /
    `--content-wide` 84rem tokens; new `src/components/layout/page-container.tsx`
    `<PageContainer width>`. Shell `main` now only gutters + `--content-wide` bound; every
    `(app)` page wrapped and given an intentional measure (settings/notifications → narrow;
    photo wall + history grid → wide, with the reading/timeline views self-constraining to
    `--content-max`; rest → default). Grid views go `lg:grid-cols-4` on wide pages.
  - **Forms:** `<Input>` now sets `inputMode` + capitalize/correct hints per `type`
    (email/url/tel/search/number). New `src/components/system/unsaved-guard.tsx` (`beforeunload`
    while dirty) wired into recap / couple-profile / profile / custom-place / review forms.
  - **Touch:** gallery tile actions get `pointer-coarse:opacity-100` (were hover/focus only).
    Confirmed swipe is optional (lightbox/wall have 44px EdgeButtons + arrow keys).
  - **Bug fix:** `enable-browser-notifications.tsx` hydration mismatch on `/settings/notifications`
    (server "unsupported" vs client "default") — reworked to `useSyncExternalStore` + server
    snapshot.
  - **Verify:** tsc / eslint / vitest(68) / `next build`(48 routes) all green. Puppeteer
    logged-in QA: 15 routes × {390px, 1440px} → **0px horizontal overflow everywhere**, nav +
    bell present on all, no console/hydration errors. (Test couple has no completed dates, so
    grid/timeline density not visually verified — noted in checklist.)
  Checklist `docs/pwa-conversion-checklist.md` §2/§3/§4b/§12/§13/§14 updated. **DONE**
- **Prod/PWA conversion — Phase 0 (audit & stabilize).** Full audit of the 20-prompt MONO
  codebase. **Stabilization: all green, no build-blockers** — `tsc --noEmit` clean, `eslint .`
  clean, `vitest` 68/68, `next build` OK (48 routes). Findings: codebase is production-quality
  and fully wired (every action → real service → Prisma; 68 unit tests on pure rules; client/
  server boundary clean — all `@/server/services` imports in client comps are `import type`;
  all `localStorage`/`sessionStorage`/theme-boot in `try/catch`; `navigator.share`/`clipboard`/
  `Notification` all feature-detected; no Capacitor/RN/Cordova; photo upload uses
  `<input type=file capture>` not `getUserMedia`). **Biggest gap: zero PWA infra** — `public/`
  is empty, no `manifest`, no icons (192/512/maskable/apple-touch), no service worker, no
  offline shell, no install prompt. Known intentional stubs: S3 storage (`s3.ts` throws — breaks
  photos on Vercel), SMTP email, web push (`NoopPushChannel`), Google OAuth (501), reminder
  cron. Non-issues (do not touch): `/dashboard` redirect stub, dev-only `/style` route,
  `next/image` only in dev style gallery, no client-state lib (RSC by design). Created
  **`docs/pwa-conversion-checklist.md`** (12 sections, tracked done/remaining). **DONE**

- **`publish`** — updated `memory.md`, ran `npm run build` (green), committed the accumulated
  work from every 2026-09-02 pass (Memories → Couple profile → Explore → Notifications →
  Security → Reliability/perf → Final quality pass) and pushed to `origin/main`.
- **Final implementation & quality pass (6-part prompt).** Journey: traced the full lifecycle
  end to end — no broken transition. Business logic: single-sourced `round1`/`mean` in
  `lib/review/scale`; new `isRevealed` / `dateCoupleScore` in `lib/date/review-reveal` used
  across `history` / `couple-insights` / `explore` / `home` services (fixed Home showing a
  non-reveal-gated combined score); inline score-averaging in `place-*` / `recommendation`
  services → `averageScore`/`mean`. Animation: CSS-only one-shot polish on connect / plan-saved
  / date-completed / review-submitted / form-success / milestones. Testing: added **vitest** +
  `test` script + `vitest.config.ts`; **68 unit tests / 9 files** (scoring, reveal, lifecycle
  transitions, expense split & breakdown, compatibility, timezone, couple isolation w/ mocked
  prisma) — all green. **`prisma db push` synced the live Neon DB** with the schema (all
  prior-session deltas; no data loss). Product-standard sweep: no fake buttons / dead nav /
  placeholder pages; screenshot 30/30 (no horizontal overflow); dev log clean; `/api/health` up.
  `tsc` / `eslint`(0) / `vitest`(68) / `next build`(55 routes) / `prisma validate` + `generate`
  all green. **DONE**
- **Reliability & performance pass (6-part prompt).** Loading: +6 route `loading.tsx`
  skeletons. Errors: `global-error.tsx`, `(app)/error.tsx` (offline-aware), `explore/error.tsx`;
  place-picker sheet gains non-OK/offline handling + retry + caught select failure. Offline:
  `use-online-status` hook, `<OfflineBanner>` in shell, `<OfflineNotice>`, `use-local-draft`
  (localStorage) wired into `<MemoryForm>`. Perf: `getFavorites` N+1 removed;
  `getBestPhotoWallPage` cursor pagination + `<PhotoWall>` infinite scroll + `.cv-auto`
  content-visibility on gallery tiles; history 250-cap notice. A11y/mobile: audited (base
  already strong — slider role, focus traps, labelled icons, colour+text chips); `<StickyBar>`
  now clears the fixed mobile nav (`bottom-(--bottomnav-h)` / `lg:bottom-0`). `docs/architecture.md`
  +"Reliability, performance & resilience" section. `tsc`/`eslint`(0)/`next build`/`next dev` green. **DONE**
- **Privacy & security implementation pass (6-part prompt).** Wrote `docs/security.md` (full
  audit). Fixed: (A) `/media/[...key]` path traversal — non-canonical keys (`..` segments etc.)
  now rejected before prefix auth + `..`-guard in `local.ts`; dropped SVG from media MIME +
  `nosniff`. (B) `readImageUpload` sniffs magic bytes (client `Content-Type` discarded), size
  re-check, same-origin check. (C) new `lib/security/rate-limit.ts` on
  login/register/reset×2/join/accept/upload. (D) `next.config.ts` security headers (CSP,
  X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, prod HSTS). (E) new
  `/settings/privacy` page. Verified-good with no change: couple isolation via `authorize*`
  everywhere; bcrypt-12 + timing-safe + no enumeration; JWT httpOnly/Secure/Lax + tokenVersion;
  hashed single-use expiring reset & invite tokens; zod on all input; Prisma parameterised;
  robots disallow-all + noindex; destructive flows already confirmed. `tsc`/`eslint`(0)/
  `next build`(54 routes)/`next dev` (headers + traversal 404s) green. **DONE**
- **Notification & reminder system (6-part prompt).** Schema `ReminderKind` +CUSTOM/+MEMORY,
  `NotificationType` +DATE_NEEDS_ACTION/+REVIEW_REMINDER/+MEMORY_REMINDER, `NotificationPreference`
  +memoryReminder (only change; `db push` deferred — dev-server engine lock). New pure libs:
  `lib/utils/timezone.ts` (`zonedTimeToUtc` — tz-correct day-of reminder), `lib/notifications/{prefs,types,channels}.ts`
  (6-category source of truth, pref-gate maps + `notificationHref`, channel registry
  `deliverNotification` = in-app authoritative + best-effort push → the "no hardcoded provider"
  seam). Hardened `notification-service.fanOut` (per-recipient pref gate + 10/60-min dedupe) and
  `reminder-service` (tz DATE_DAY, CUSTOM/MEMORY kinds, `snooze`, expired-retire, CANCELLED
  never fires, per-reminder try/catch, 18h re-deliver guard, "Your date is waiting for its
  review."). New triggers: `notePlanEditToPartner` in plan edits (DATE_EDITED), `nudgeStaleDates`
  in `promoteDueDates` (DATE_NEEDS_ACTION), `ensureMemoryReminder`. `getPartnerActivity` (grouped
  friendly lines) + `<PartnerActivity>` on Home (pref-gated); removed dead `getUnseenPartnerEdit`.
  `/notifications` rebuilt (`<NotificationsList>` — New/Earlier groups, deep-link rows,
  mark-read-on-click); `<DateReminderControls>` on `/dates/[id]`; settings form auto-includes the
  memory toggle. `tsc`/`eslint`(0)/`next build`(53 routes)/`next dev` green. **DONE**
- **Explore discovery engine (6-part prompt).** Schema +`RecommendationFeedback` model +
  `RecommendationTargetType`/`RecommendationSignal` enums (only change; `db push` deferred —
  dev-server engine lock). Pure `lib/explore/{date-ideas,compatibility,visited}.ts` — fixed
  10-idea catalogue, deterministic Couple Match % (weighted blend of both partners' category
  ratings + agreement; `null` when thin, never invented), `classifyVisited` (new/visited/
  revisit/loved/avoid). `explore-service.getExploreHome` — one deterministic loader, per-member
  ×category rating map (reveal-gated), 8 sections reordered by history depth, `avoid` filtered
  from recs (search is the escape hatch). `+getRecommendationFeedbackMap`/`setRecommendationFeedback`.
  `actions/explore.ts` `recommendationFeedbackAction`. `/explore` = discovery home (no query)
  vs. existing `searchPlaces` grid (any query), latter now with visited badges + feedback chips.
  Components `explore-home` / `recommendation-card` / `idea-card` / `match-badge` /
  `visited-badge` / `rec-feedback` (optimistic). `tsc`/`eslint`(0)/`next build`(53 routes)/
  `next dev` green. **DONE**
- **Couple Profile + private relationship insights (6-part prompt).** Schema `User`
  +`theme`/`hideMoneyInsights`/`hidePartnerPreferenceGap` (only change; `db push` deferred —
  dev-server engine lock). Pure `lib/couple/insights.ts` (deterministic per-category couple &
  per-person averages with min-sample guards, neutral-language preference gaps that are never
  framed as problems, insight builders that only emit when data supports them) +
  `lib/settings/theme.ts` (no-flash boot script). Services: `couple-insights-service`
  (`getCoupleProfile` — one reveal-gated loader; avg score carries `scoredDateCount`,
  lowest-rated hidden unless ≥2 differing scored dates, spend null≠0), `user-settings-service`,
  `account-service` (`exportCoupleData` JSON, `deleteAccount` = archive couple + soft-delete
  user + bump token version), `couple-service` +`getCoupleProfileForEdit`/`updateCoupleProfile`/
  `disconnectCouple` (archive, nothing hard-deleted). `actions/settings.ts` (couple profile,
  user settings, theme fast-path, disconnect→`/onboarding`, delete→typed "DELETE"→`/login`).
  `/couple` rewritten (profile header + statistics + category preferences/differences +
  insights + settings links, `loading`/`error`); new `/settings` hub + `/settings/couple` +
  `GET /api/export` (members-only, session-scoped, attachment). Components under
  `components/couple/**` + `components/settings/**` (incl. `theme-applier` in `(app)/layout`,
  `preferences-form` with live theme preview, `danger-zone` with `useConfirm` + typed delete).
  `globals.css` gains `:root[data-theme="dark"]` + scopes the media query to
  `:root:not([data-theme])` — resolves the manual-theme-toggle backlog item. `tsc`/`eslint`(0)/
  `next build` (52 routes)/`next dev` (307/401 unauth) green. **DONE**
- **Dedicated Memories experience (6-part prompt).** Schema: `DatePhoto.isFavorite`
  (+`@@index`) — only change; `db push` deferred (dev-server lock). Reuse-first:
  `history-service` now exports `HISTORY_INCLUDE` + `mapDateRowToItem` (single row→
  `DateHistoryItem` mapper) and `DateHistoryItem` gained place/memory favourite +
  `memoryId`/`memoryTitle`; every memory loader and `getDateHistory` share it. New pure
  `lib/date/milestones.ts` — `computeMilestones` (first/nth date, first-city, regulars,
  anniversary MM-DD, top-score; real facts only, never manufactured). `photo-service`
  +`isFavorite`, +`togglePhotoFavorite`, +`getBestPhotoWall`/`listFavoritePhotos`
  (→ `WallPhoto`). `memory-service` +`toggleMemoryFavorite` / `loadCompleted` (private) /
  `getMemoryHome` / `getMemoryTimeline` / `getFavorites` / `getMemoryDetail` (reshapes
  `getDateExperience`, zero new rules). Routes `/memories` (Journal home — photo-dominant),
  `+loading/+error`, `/memories/timeline` (year-grouped spine), `/memories/photos`
  (`<PhotoWall favoritable>`), `/memories/favorites` ("Our Favourites" — dates/photos/places),
  `/memories/[id]` (`<MemoryDetailView>` — editorial, no technical metadata). Components
  `memories-nav` / `favorite-heart` (optimistic, `plain`+`overlay`) / `milestone-badge`
  (+`DateOrdinal`) / `memory-timeline-item` / `photo-wall` (portal viewer, swipe/keys) /
  `memory-detail-view`. `<PhotoGallery>`/`<PhotoLightbox>` gained `readOnly`;
  `<FavoriteHeart>` wired into `/dates/[id]` memory card + managed gallery tiles. Actions
  `memories.ts` (`toggleMemoryFavoriteAction`) + `photos.ts` (`togglePhotoFavoriteAction`),
  both id-validated + couple-authorized + path-revalidating. `tsc` / `eslint` (0) /
  `next build` (45 routes) / `next dev` (all five `/memories*` routes 307 unauth) green.
  Needs DB + login to exercise. **DONE**
- **GitHub + live database + Vercel prep.**
  - Initialised the repo (`git init -b main`), added remote `origin`
    `https://github.com/Tus-GitHub/MONO.git` (was empty), committed the whole project (305 files;
    `.env` excluded by `.gitignore`) and pushed to `main`. **DONE**
  - Connected **Neon Postgres** (`neondb`, ap-southeast-1): pooled `DATABASE_URL` in `.env`
    (`+ connect_timeout=15` for Neon auto-suspend cold starts); `npx prisma db push` created all
    20 tables (no migration files). `prisma generate` still hits the Windows `EPERM` engine-lock
    while `next dev` runs, but the TS client already matches the schema. **DONE**
  - Verified the DB end to end: a full relational smoke test (users→couples→members→places→
    dates→activities→events→reminders→photos→reviews→ratings→revisit→expenses→memories→
    notifications, deep reads, aggregate, `$transaction`, couple-cascade delete) — all passed,
    DB left empty. **DONE**
  - `npm run build` — green, 40 routes, no errors. **DONE**
  - Documented the Vercel deploy: set `build` to `prisma generate && next build`; env vars
    (Neon `DATABASE_URL`, new `AUTH_SECRET`, `APP_URL`, storage/email/image/place vars);
    **image uploads will fail on Vercel** (local-disk `STORAGE_DRIVER`, `s3.ts` not implemented);
    post-deploy check via `/api/health` + register/create-couple. **DONE**
- **`publish` command + rules.** Added `CLAUDE.md` Rule 2 ("update `memory.md` after every
  prompt") and Rule 3 (the `publish` workflow: update memory → `npm run build` → on success
  `git add -A` + commit + push to `origin main`; on failure show errors, no commit). Added the
  `/publish` slash command at `.claude/commands/publish.md`. **DONE**
- **Test account(s) + connected couple seeded in Neon.** `admin@gmail.com` / `admin@123`
  (name "Admin") and `admin1@gmail.com` / `admin@123` (name "Partner"), both bcrypt cost 12,
  both `profileCompletedAt` set. Joined as couple **"Admin & Partner"**
  (`id cmtj2vf850001k2041yhzpov8`, invite `B8A-W5KN`) — `status=ACTIVE`, `setupCompletedAt` set,
  admin = OWNER / admin1 = PARTNER (both ACTIVE), 6 default review categories. So the onboarding
  state machine (`onboarding-service.ts`) resolves to `ready` and login lands straight on
  `/home` with the full app UI. MONO has **no admin role** — these are normal users; the
  password is below the sign-up policy (≥10 chars + uppercase) so it can't be recreated via the
  form, but `loginSchema` doesn't enforce complexity so it logs in fine. **DONE**
- **Dev server** was already running on **http://localhost:3217** (PID 21004; Next 16 refuses a
  2nd `next dev` for the same dir — it prints the existing port). `/login` 200,
  `/home` 307→`/login` when logged out. **DONE**

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
