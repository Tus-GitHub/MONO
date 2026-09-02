# MONO — Production & PWA Conversion Checklist

Living tracker for turning the completed 20-prompt MONO build into a polished responsive web
app and installable PWA. Status set by the Phase 0 audit (2026-09-02).

Legend: `[x]` done · `[ ]` remaining · `[~]` partially done / needs verification

---

## 0. Stabilization (Phase 0 — gate before conversion work)

- [x] TypeScript: `npx tsc --noEmit` — clean
- [x] Lint: `npx eslint .` — clean (0 warnings)
- [x] Tests: `npx vitest run` — 68 pass / 9 files
- [x] Production build: `next build` — succeeds, 48 routes
- [x] No build-blocking errors to fix
- [x] Client/server boundary clean — every `@/server/services/*` import in a client
      component is `import type` only; no component imports `prisma`
- [x] All server actions wired to real services; all services hit the DB (no stub services)
- [x] `localStorage` / `sessionStorage` / theme boot script all wrapped in `try/catch`
- [x] No native-app framework (Capacitor / Cordova / React Native) anywhere

---

## 1. PWA

- [x] Web app manifest — `src/app/manifest.ts` → `/manifest.webmanifest` (`application/manifest+json`).
      `id`, name, `short_name: "MONO"`, description, `start_url: "/home"`, `scope: "/"`,
      `display: "standalone"` + `display_override`, `orientation: "portrait"`,
      `theme_color`/`background_color` `#f5f1ea` (mirror `--paper`), `categories`. Installed app
      launches straight into `/home`.
- [x] `<link rel="manifest">` auto-injected by Next; verified in `<head>`.
- [x] Icon set generated from the brand mark via `sharp` (no new dep) — `scripts/generate-icons.mjs`
      / `npm run icons`. `public/icons/icon-{192,512}.png` (`purpose: any`, subtle rounding),
      `icon-maskable-{192,512}.png` (full-bleed, ~44% safe-zone), `src/app/apple-icon.png` 180×180
      (square, opaque — iOS rounds it). All opaque on the brand ink ground → read on any wallpaper.
- [x] `metadata.appleWebApp` — `{ capable: true, title: "MONO", statusBarStyle: "default" }`;
      emits `mobile-web-app-capable`, apple title + status-bar meta, apple-touch-icon link.
- [x] Service worker — hand-rolled `public/sw.js`, no dependency. Versioned caches (`mono-v1-*`);
      **precache** = `/offline` + icons + manifest; **cache-first** for `/_next/static/**` and
      static images/fonts; **network-first** for navigations → cached `/offline` on failure
      (page HTML never written to cache); **`/api/**` and `/media/**` never touched**. `activate`
      deletes every cache not on the current `VERSION`; `skipWaiting` on the page's nudge.
- [x] `/offline` route (`src/app/offline/`) — tiny, no auth, inline-styled fallbacks + `OfflineRetry`
      (auto-reloads on the `online` event).
- [x] SW registration — `<ServiceWorkerManager>` in the root layout: **production only** (dev
      untouched), `'serviceWorker' in navigator` guarded, `reg.update()` on tab refocus.
- [x] Update flow — detects a `waiting` worker → slim "MONO just updated · Refresh" bar →
      `postMessage("SKIP_WAITING")` → `controllerchange` → one reload.
- [x] Install experience — `<InstallPrompt>`: `banner` on Home (dismiss → snooze 14 days, ≤3
      nudges ever) + `card` in Settings (always available). `beforeinstallprompt` captured for
      Chrome/Edge/Android; iOS Safari gets "Share → Add to Home Screen" copy with the share glyph;
      renders nothing when `display-mode: standalone` / already installed. `appinstalled` sets a
      permanent flag.
- [x] `next.config.ts` — CSP `worker-src 'self'` + `manifest-src 'self'`; `/sw.js` served
      `no-cache, no-store` + `Service-Worker-Allowed: /`; `proxy.ts` matcher excludes
      `sw.js` / `manifest.webmanifest` / `icons/` / `apple-icon.png`.
- [x] **Verified (puppeteer against `next start`)**: manifest loads + valid; all 5 icons load at
      the right dimensions; SW registers + activates (scope `/`); online navigation still works;
      **server killed → navigation falls back to `/offline`**, precached shell + cached
      fonts/CSS/JS still serve, **`/api/health` does NOT** (privacy); dev build never registers a SW.
- [x] **Android back button / back-swipe closes an open overlay** instead of leaving the page —
      new `useBackButton` hook in `_dialog-primitives` (History API: push a throwaway entry on
      open, `popstate` → close, pop it back on any other close). Wired into `<Modal>` (so also
      `useConfirm`), `<BottomSheet>`, and both photo viewers. Verified: open confirm dialog →
      browser Back → dialog closes, URL unchanged.
- [x] Responsive width sweep **320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440** × 12 routes —
      0 horizontal overflow, no console errors, `<main>` present everywhere. `lg` (1024) is the
      mobile-nav → sidebar switch; 768 stays on the mobile shell (correct for tablet portrait).
- [ ] Lighthouse "Installable" + PWA audit in a real Chrome against the deployed HTTPS origin
- [ ] `theme_color` currently light-only — consider a media-aware pair once installed dark-mode
      splash is observed on a device
- [ ] Bump `mono-v1` → `mono-v2` on the first post-launch shell change and confirm the update bar
      appears and old caches are purged
- [ ] The 320px install banner is dense (icon + 3-line copy + Add + dismiss) — fine and legible,
      but could drop the icon below 360px if it ever bothers anyone

## 2. Responsive UI

- [x] Mobile-first Tailwind v4 layout; desktop sidebar + mobile top bar & bottom nav shell
- [x] `env(safe-area-inset-*)` handling in `globals.css`; `--bottomnav-h` token; `StickyBar`
      clears the fixed mobile nav
- [x] `overflow-x: clip` / `max-width: 100%` guards; screenshot QA asserts no horizontal overflow
- [x] `prefers-reduced-motion` respected globally
- [x] **Intentional per-page desktop widths** — `<PageContainer width="narrow|default|wide|full">`
      (tokens `--content-narrow` 44rem / `--content-max` 72rem / `--content-wide` 84rem). Shell
      supplies only gutters + outer bound; each page picks its measure. Applied across all
      `(app)` pages: settings/notifications → narrow, galleries (photo wall, history grid) →
      wide with the reading views self-constraining, everything else → default.
- [x] **Authed visual QA (puppeteer, logged-in): every page has 0px horizontal overflow at
      390px and 1440px**; nav + notification bell present on all; no console/hydration errors.
- [x] **Phase 8 mobile-first re-audit (puppeteer @ 390px + per-element width measurement,
      logged in as the admin couple, incl. a seeded completed + upcoming date).** 20+ authed
      routes: 0 horizontal overflow. **Two real clipping bugs found & fixed:**
      (1) `ScoreScale` — every cell carried `.tap` (`min-width: 2.75rem`), so 10 cells + gaps =
      476px inside a 390px viewport and an ancestor clip hid cells **9 & 10** → those review
      scores were unreachable on any phone. Now `h-11 min-w-0 flex-1` (44px-tall target, width
      shares the row); re-measured 358px, all 10 visible.
      (2) `DatePicker` "When?" shortcut chips (`scroll-x no-scrollbar`) clipped "Next weekend"
      with no scroll affordance → `flex flex-wrap gap-2`.
      Bottom nav / sticky "Plan a date" / recap form chips / long titles / calendar grid / 404
      all check out at 390.
- [ ] Re-run responsive QA at 320 / 414 / 768 / 1024 / 1280 / 1536 after PWA chrome is added
      (install banner, offline bar, SW toast must not cover content or nav)
- [ ] Verify large-text / 200% browser zoom doesn't break the shell
- [ ] Landscape phone check (safe-area left/right, bottom nav)
- [~] Populate the test couple with real dates/photos and re-shoot the grid/timeline views —
      Phase 8 seeded + shot a completed date (detail / recap / review / memory) and an upcoming
      date at 390px; still want photo-density grid/timeline/photo-wall/lightbox against many
      real photos (needs seeded `/media` assets)

## 3. Browser compatibility (Chrome, Edge, Firefox, Safari macOS, Safari iOS, Chrome Android)

- [x] `navigator.share` feature-detected, falls back to clipboard
- [x] `navigator.clipboard` in `try/catch` with a manual-copy toast fallback
- [x] `Notification` API — now via `useSyncExternalStore` with a server snapshot; fixed a
      hydration mismatch on `/settings/notifications` (server "unsupported" vs client "default")
- [x] Per-`type` mobile-keyboard hints baked into `<Input>` (email → `inputMode=email` +
      no autocapitalize/autocorrect; url, tel, search, number likewise)
- [x] No `100vh` in shipped UI (fixed in Phase 3)
- [x] **`backdrop-filter`** — Tailwind v4 emits `-webkit-backdrop-filter` alongside
      `backdrop-filter` (confirmed in the compiled CSS), so the frosted header / nav / scrims
      blur on Safari + iOS.
- [x] **No fragile modern CSS** — `:has()`, `text-wrap: balance`, container queries: **none
      used**. `color-mix(in oklab …)` used once (skeleton shimmer) now has a flat
      `background: var(--color-line)` fallback line for Safari < 16.2.
- [x] **Firefox scrollbar** — `.scroll-area` now sets `scrollbar-width: thin` +
      `scrollbar-color` (Firefox) next to the existing `::-webkit-scrollbar` rules.
- [x] Date/time — native `<input type="date"|"time">` (recap form) + custom keyboard-friendly
      pickers (plan flow); render acceptably on every engine.
- [x] `sharp` / server-only packages kept out of the client bundle via
      `serverExternalPackages` (`next.config.ts`); client image work uses `createImageBitmap` +
      canvas only.
- [x] **Cross-UA render check** (puppeteer, Android Chrome / macOS Safari / Firefox / Edge
      user-agents): identical layout, nav + bell present, 0 overflow, no console errors — no
      UA-sniffing branches in the app.
- [ ] Real-engine pass (actual Safari / Firefox, not just their UA string in Blink): auth,
      plan flow, photo upload, review reveal — device/VM only

## 4. Mobile Safari (iOS) specifics

- [x] `viewport-fit=cover` set; safe-area padding in CSS
- [x] `-webkit-tap-highlight-color: transparent`, `-webkit-text-size-adjust: 100%`,
      `-webkit-overflow-scrolling: touch`, `overscroll-behavior: contain`
- [x] `apple-touch-icon` + apple web-app meta (via `metadata.appleWebApp`) — Phase 2
- [x] **Safe areas end to end** — `pt-safe` on the app header, `pb-safe` on the bottom nav,
      `pb-safe` on the bottom sheet, new `.above-bottom-nav` (`calc(--bottomnav-h + safe-inset-bottom)`)
      on `<StickyBar>` so a sticky "Save" row clears both the nav and the home indicator, new
      `.dialog-inset` (`max(1rem, safe-inset-*)`) on `<Modal>`. No content sits under the home
      indicator.
- [x] **No fragile `100vh`** — last one (`global-error.tsx`) → `100dvh`. Shell + sheets +
      lightbox all `dvh`. `<Modal>` capped at `max-h-[calc(var(--vvh,100dvh)-2rem)]` with an
      internal `scroll-area` so it stays usable in landscape and with the keyboard up.
- [x] **Keyboard-aware layout (prompt 31)** — `viewport` gains `interactive-widget=resizes-content`
      (Chromium shrinks the layout viewport for the keyboard). `<ViewportManager>` (mounted in
      `AppProviders`, so it also covers auth/onboarding) publishes `--kb` (keyboard occlusion px),
      `--vvh` (true visible height px) and `[data-kb="open"]` on `<html>` from
      `window.visualViewport` on a rAF — this is the iOS Safari path, where the meta is ignored.
      Consumers: the fixed `BottomNav` slides away (`translateY(110%)`) so it never floats over
      the last form row / Continue button; `<Modal>` top-aligns + its panel caps to `--vvh`;
      `<BottomSheet>` (and the photo-lightbox caption) ride up by `bottom: var(--kb)` and cap to
      `--vvh`; `.above-bottom-nav` sticky bars drop the nav offset and only clear `--kb`;
      `place-detail`'s action bar moved off `bottom-0` onto `.above-bottom-nav`. Auth + setup
      shells swapped `justify-center` for `overflow-y-auto` + `m-auto` so a tall form scrolls to
      both ends on a short viewport. `<ViewportManager>` also nudges a keyboard-clipped focused
      field into view (`scrollIntoView({ block: "nearest" })`, coarse-pointer `scroll-margin`).
      No hardcoded keyboard height; degrades to the `dvh` fallbacks where `visualViewport` is
      absent. Puppeteer-verified with `--kb`/`data-kb` injected.
- [x] **iOS focus-zoom killed** — an unlayered `@media (pointer: coarse)` rule floors every
      `input`/`select`/`textarea` at 16px (unlayered so it also beats `sm:text-sm` on a
      *landscape* phone). Verified 0 fields < 16px across 15 screens in **both** orientations.
- [x] Photo upload from iOS — client `downscaleImage` (`src/lib/images/client-resize.ts`)
      transcodes an HEIC camera capture to JPEG and shrinks 12 MP shots to ≤2560px **before**
      validation, so a camera photo is no longer rejected for being HEIC; library picker offers
      Photo Library + Take Photo; `multiple` on the library input.
- [x] Swipe / edge-back — lightbox & photo-wall swipe now ignore a gesture that starts within
      24px of the screen edge, leaving Safari's back/forward gesture alone; both keep visible
      44px prev/next buttons + arrow keys.
- [ ] Web Notifications on iOS only work in an **installed** PWA on iOS 16.4+ — the "Allow
      notifications" UI already feature-detects and shows an `unsupported` state; consider a
      "install first" hint when not standalone
- [x] Sticky "Save" bar with the keyboard open — `.above-bottom-nav` now resolves to
      `bottom: calc(var(--kb) + safe-inset)` while `html[data-kb="open"]`, so it rides just above
      the keyboard instead of being covered (prompt 31). Still worth a real-iPhone feel check.
- [ ] On a real iPhone: installed (standalone) status-bar colour, no Safari chrome, that
      internal links stay in-app, pull-to-refresh vs. the fixed nav, keyboard open/close on
      Login / Signup / Plan basics / Add-expense sheet / Place-search sheet / Review form, and
      an orientation flip mid-type

## 4b. Navigation (responsive, consistent on every authed page)

- [x] Mobile: compact sticky header (logo + Explore + notifications bell + account menu) and
      the raised-centre bottom nav (Home / Dates / Plan / Memories / Couple)
- [x] Desktop: fixed sidebar (logo, persistent **Plan a date**, primary nav, couple card,
      sign out) + a slim right-aligned header strip (notification bell with unread badge +
      account menu popover: Couple space / Your profile / Settings / Sign out)
- [x] **Notifications + profile controls are now global** (were only on `/home`'s header)
- [x] Account menu popover is keyboard + pointer + touch accessible (`aria-haspopup`,
      `aria-expanded`, Escape closes + returns focus, outside-pointer closes, closes on nav)
- [x] Bottom nav omits Explore, so Explore has a dedicated header icon on mobile
- [x] The fixed bottom nav no longer overlaps focused form controls — it slides out
      (`translateY(110%)`) while `html[data-kb="open"]` (prompt 31). `place-detail`'s sticky
      action bar also moved onto `.above-bottom-nav` so it clears the nav on mobile.
- [ ] Add an unread indicator to the bottom-nav couple/home tab if a notification arrives while
      the header is scrolled away (currently the bell badge is in the sticky header)

## 5. Camera / photo

- [x] Uses `<input type="file">` (gallery) + a second input with `capture="environment"`
      (camera) — correct web approach, **no `getUserMedia`**
- [x] Server-side pipeline: magic-byte sniffing (client `Content-Type` discarded), size
      re-check, same-origin check, EXIF strip, WebP re-encode + 3 variants + blur placeholder
- [x] `<Photo>` primitive: aspect-box (no CLS), blur-up, lazy, `srcSet`; deliberately not
      `next/image` (sources are per-request authorized `/media`)
- [x] **HEIC / large photos** — `downscaleImage` on the client: `createImageBitmap(file, {
      imageOrientation: "from-image" })` → canvas → `toBlob("image/jpeg", 0.82)` at ≤2560px.
      Runs before `validateImageUpload`, so an iPhone camera HEIC (not in `IMAGE_UPLOAD.accept`)
      becomes an accepted JPEG. Best-effort; falls back to the original file. Wired into
      `photo-uploader`, `quick-photo-button`, `image-upload`.
- [x] **EXIF orientation — fixed & verified end to end.** `imageOrientation: "from-image"` bakes
      rotation into the pixels *before* the canvas strips EXIF; the server's `sharp().rotate()`
      then has nothing to double-rotate. Test: a 3000×2000 JPEG tagged orientation 6 stored
      upright at 1707×2560 (portrait).
- [x] **Upload never freezes the tab** — `photo-uploader` now runs a `MAX_CONCURRENT = 3`
      queue (resize + upload), so a 20-photo drop processes in waves. New `"queued"` / `"preparing"`
      states.
- [x] Multi-select + per-file progress; **cancel** works on a queued/preparing item too (pulled
      from the queue), not just an in-flight XHR.
- [x] **Retry keeps the file** — a failed item re-queues its already-prepared `File`; the user
      never re-selects. **Auto-retry**: an `online` event re-queues every `error` item.
- [x] Failure messages: 413 → "too large", offline → "You're offline", corrupt bytes that pass
      the magic-number sniff → server 400 "That image couldn't be read" (was a 500), malformed
      `dateId` → 400 (was 500).
- [x] Camera vs. library are separate inputs — camera permission only on an explicit "Take a
      photo"; dismissing a picker with no selection is a no-op.
- [ ] On a real iPhone: multi-file progress on cellular; the `online` auto-retry after a real
      connection drop

## 6. Notifications

- [x] **Opt-in permission strategy** — `EnableBrowserNotifications` never calls
      `Notification.requestPermission()` on load; it explains the benefit ("Want MONO to remind
      you about your next date … even when MONO is closed?") and only asks when the user taps
      **Turn on reminders**. Verified: no prompt on page load.
- [x] **Channel abstraction** — `NotificationChannel` (`channels.ts`): `InAppChannel`
      (authoritative — a DB row) + `PushRelayChannel` (best-effort). `deliverNotification` fans
      one payload across every channel; a channel failing is logged, not fatal. Provider code
      is isolated in `push.ts` (`PushChannel` seam) and `web-push.ts` (the one concrete
      provider). Adding FCM/APNs/email is a new file.
- [x] **Real Web Push** — `WebPushChannel` (`src/lib/notifications/web-push.ts`), hand-rolled on
      Node `crypto` + `jose` (**no `web-push` dependency**): RFC 8291 key derivation + RFC 8188
      `aes128gcm` payload encryption + RFC 8292 VAPID (ES256 JWT). `getPushChannel()` returns it
      when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are set, else the no-op. `npm run vapid` prints
      a key pair. **Verified by 5 unit tests**: a compliant client decrypts exactly what the
      channel encrypts; VAPID JWT verifies; a 410 maps to `PushSubscriptionGoneError` and the
      subscription is auto-cleared.
- [x] SW `push` → `showNotification` (icon/badge/tag), `notificationclick` → focus an existing
      tab on that path or open one (`public/sw.js`, bumped to `mono-v2`).
- [x] Client subscribe flow — `pushManager.subscribe({ userVisibleOnly, applicationServerKey })`
      → `savePushSubscriptionAction` → `NotificationPreference.pushSubscription`; "Turn off"
      unsubscribes and clears it.
- [x] **`dispatchDueReminders` now fires app-wide** — `<ReminderPoller>` in the shell dispatches
      on mount, every 10 min while visible, and on tab focus (idempotent action). Was Home-only.
      Still no cron — a real scheduler is the last mile for reminders when *no* tab is open.
- [x] Events wired: upcoming date / date-day (`ensureRemindersForDate` from plan + status
      changes), partner changed date (`notePlanEditToPartner` → `DATE_EDITED`), partner
      submitted review (`review-service` → `REVIEW_ADDED`), combined review unlocked
      (`notifyCouple` on reveal), memory incomplete (`ensureMemoryReminder` → `MEMORY` kind
      one day after completion). All pref-gated + de-duped.
- [x] Settings — 6 toggles (upcoming / date-day / review / memory / unfinished-plan / partner
      activity), persisted to `NotificationPreference`, respected by both `fanOut`
      (`recipientsAllowing`) and `getDueReminders` (`categoryAllowed`).
- [x] **Graceful degradation** — `unsupported` (no `Notification`/`serviceWorker`/`PushManager`),
      `not-configured` (no VAPID on this deployment), `ios-needs-install` (iOS Safari, not
      standalone), `denied` — each shows a plain message and **no button**; in-app notifications
      keep working. Verified with the APIs deleted.
- [x] **Reliability — verified** (puppeteer + DB): the poller delivers a due reminder once;
      a second dispatch does **not** duplicate (18 h re-deliver guard); a **cancelled** date's
      reminder does **not** fire (`stateAllows` + query filter); a **disabled** category
      suppresses its reminder. Timezone-correct (`zonedTimeToUtc`), stale reminders retired
      (`STALE_MS`), time-moved < 1 h doesn't re-notify.
- [ ] A scheduler/cron (Vercel Cron / QStash) calling `dispatchDueReminders` per user, for
      reminders that come due with every tab closed
- [ ] On a real iPhone: installed-PWA push (iOS 16.4+), and that the settings copy reads right
      when `not-configured` vs `ios-needs-install`

## 7. Authentication

- [x] bcrypt cost 12, timing-safe compare, no user enumeration
- [x] Session = signed JWT (`jose`), httpOnly + Secure + SameSite=Lax cookie, `tokenVersion`
      invalidation
- [x] `proxy.ts` edge gate (signature/expiry only) + authoritative checks in layout/actions/authz
- [x] Hashed, single-use, expiring reset & invite tokens
- [x] Rate limiting on login / register / reset / join / accept / upload
- [x] Google OAuth architecture present (returns 501 until credentials set)
- [ ] Set a strong production `AUTH_SECRET` (48-byte) in Vercel — **not** the dev value
- [ ] Confirm cookie `Secure` + domain behaviour behind Vercel HTTPS; test login persistence
      across a PWA cold start (standalone) on iOS & Android
- [ ] Verify the `proxy.ts` matcher still excludes `/manifest.webmanifest`, `/sw.js`,
      `/icons/*`, `/offline` once those exist (so they're reachable unauthenticated)
- [ ] Decide: wire real Google OAuth for launch, or hide the button

## 8. Offline behavior

- [x] `useOnlineStatus` hook (SSR-safe), `<OfflineBanner>` in the shell, `<OfflineNotice>`
- [x] `use-local-draft` mirrors in-progress form values to `localStorage` (memory form wired)
- [ ] Real offline shell via the service worker (see §1) — today a cold load with no network
      is a blank page, not the offline notice
- [ ] Extend local-draft coverage to the plan flow and review form (long, losable forms)
- [ ] Queue-and-retry for a submit that fails offline, or at minimum a clear "you're offline,
      we kept your text" path on every mutating form
- [ ] Decide what's viewable offline (last-seen home? cached date detail?) vs. a plain
      "reconnect to continue" — set expectations in UI

## 9. Performance

- [x] RSC-first; no client state library; server actions + `revalidatePath`
- [x] `getFavorites` N+1 removed; `getBestPhotoWallPage` cursor pagination + infinite scroll
- [x] `content-visibility: auto` on gallery tiles; history 250-row cap with notice
- [x] `next/font` (Inter + Fraunces) self-hosted with `display: swap`
- [ ] Capture a production Lighthouse run (mobile) — target ≥90 Performance / 100 Best
      Practices / 100 SEO(private→N/A) / PWA installable
- [ ] Check First Load JS per route after adding the SW + registration code
- [ ] Verify `/media` variants (thumb/display) are actually requested at the right sizes on
      each surface (grid vs lightbox)
- [ ] Font subsetting / preconnect check; confirm no layout shift from late fonts
- [ ] Confirm route-level `loading.tsx` skeletons cover the slow (DB-heavy) pages

## 10. Deployment — **runbook: [`DEPLOY.md`](../DEPLOY.md)**

- [x] **`vercel-build` script** — `prisma generate && prisma migrate deploy && next build`
      (Vercel auto-prefers it). Local `npm run build` stays `next build` — no DB needed, so
      `publish` / CI don't touch the database.
- [x] **Migrations** — `prisma/migrations/20260902000000_init/` generated (`migrate diff
      --from-empty`, 737 lines, 95 indexes/constraints/FKs) + `migration_lock.toml`. The
      existing Neon dev DB (built with `db push`) is bootstrapped
      (`migrate resolve --applied …`) → `npm run db:status` = *up to date*. Prod runs
      `migrate deploy`. Procedure + rollback documented in DEPLOY.md §3.
- [x] **Production storage** — real `S3StorageDriver` (`src/lib/storage/s3.ts`) on
      `@aws-sdk/client-s3` (one dep, S3-compatible: AWS / R2 / B2 / MinIO). Private bucket,
      no ACL, no public URL — every read still goes through the auth'd `/media` route. `put` /
      `get` / `delete` / `exists`, `NoSuchKey` → app `NotFoundError` → 404. **5 unit tests**.
      Env: `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` /
      `S3_ENDPOINT` (blank for AWS) / `S3_FORCE_PATH_STYLE`.
- [x] **Prod env guard** (`src/config/env.ts`) — a *running* production server fails fast on a
      placeholder `AUTH_SECRET`, a localhost `DATABASE_URL`, a non-`https` `APP_URL`, or
      `STORAGE_DRIVER=s3` without S3 creds; soft-warns on `STORAGE_DRIVER=local`. Skipped during
      `next build` (`NEXT_PHASE`). **Verified**: placeholder secret → request 500 with the
      reason; real values → server serves.
- [x] **`prisma/seed.ts` refuses `NODE_ENV=production`** (unless `-- --force`).
- [x] `.env*` git-ignored (only `.env.example` tracked); `git ls-files` shows **no** secret,
      key, or `.env` committed. `.env.example` is the canonical reference (DB / auth / storage /
      S3 / email / OAuth / places / VAPID).
- [x] **Production build verified end to end** (`next start`, `NODE_ENV=production`, real
      secret, `https` `APP_URL`): `/api/health` up · signup → onboarding · new user persisted
      with a bcrypt hash · session valid + survives reload · login as the connected couple →
      `/home` · 10 authed pages 200 / no error / 0 overflow · manifest valid · `/offline`
      reachable · SW registers + activates.
- [ ] Email: `EMAIL_DRIVER=console` — password-reset links only hit server logs. Wire SMTP
      (`src/lib/email/smtp.ts` stub) before real users rely on reset.
- [ ] A reminder **cron** (Vercel Cron / QStash → `dispatchDueReminders`) for all-tabs-closed
      delivery.
- [ ] Attach a real domain, set `APP_URL` to it, redeploy; confirm HSTS/CSP survive the host
      and the post-deploy checklist (DEPLOY.md §7) passes against the live URL.

## 11. Security (audited in `docs/security.md` — re-verify post-conversion)

- [x] Couple isolation via `authorize*` on every couple-scoped op; no client-supplied couple IDs
- [x] `/media/[...key]` path-traversal rejected; magic-byte upload validation; SVG excluded from
      media MIME + `nosniff`
- [x] CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, prod HSTS
- [x] zod on all input; Prisma parameterised; robots disallow-all + `noindex`
- [x] **Media privacy re-audit (Phase 5, puppeteer)** — a member of couple A cannot reach
      couple B's photo by manipulating: the `/media` key prefix (foreign couple / foreign user
      / `..` traversal / dotdot segment / bare key → all **404**), the upload `dateId` (foreign
      valid-cuid → **404** *before* the image pipeline runs; malformed → **400**), or an
      unauthenticated request (→ **404**, no existence leak). `/media` responses carry
      `x-robots-tag: noindex, nofollow, noimageindex`, `cache-control: private`, `referrer-policy:
      no-referrer` — not indexable, not shareable through a CDN. `Date.bestPhotoId` +
      `resolveDateCover` is the single cover source of truth; a best-photo change
      `revalidatePath("/", "layout")`s so home / memories / timeline / couple / stats all update.
- [x] CSP updated for the SW/manifest: `worker-src 'self'` + `manifest-src 'self'` added;
      `script-src` unchanged (the SW is same-origin). `/sw.js` served `no-cache, no-store`.
- [ ] Re-audit CSP once install/push code lands (no new inline handlers, no external origins)
- [ ] Verify a cached SW response can never serve one user's `/media` or HTML to another
      (cache keys must not span auth; prefer network-first for anything user-specific)
- [ ] Penetration pass on the new unauthenticated surface: `/manifest.webmanifest`, `/sw.js`,
      `/offline`, `/icons/*` leak nothing
- [ ] Confirm `Permissions-Policy` still allows `camera=(self)` for the upload input

## 12. Forms (audited page by page)

- [x] Every form: `<Field>` gives a real `<label htmlFor>` + `aria-describedby` for hint/error;
      `<Input aria-invalid>`; server-side zod validation with `noValidate` + field-level errors
- [x] `autoComplete` set on auth forms (email / name / current-password / new-password)
- [x] Appropriate input types + **mobile keyboard hints** now systematic in `<Input>`
      (email/url/tel/search/number → `inputMode` + capitalize/correct off for text-ish)
- [x] Date/time: native `<input type="date">` in the recap form; custom `TimeField` /
      `DatePicker` chips for the plan flow (keyboard + touch, not swipe)
- [x] Loading / submit states: `<SubmitButton>` reflects `useFormStatus().pending` + `pendingText`
- [x] **Accidental-data-loss guard**: new `<UnsavedGuard>` arms `beforeunload` while a form is
      dirty; wired into recap, couple-profile, personal-profile, custom-place and review forms.
      Memory form already mirrors to `localStorage` via `use-local-draft`.
- [ ] Extend `use-local-draft` (or the guard) to the multi-step plan flow's free-text fields
- [ ] Client-side route-change confirmation for dirty forms (App Router has no stable hook —
      revisit if/when Next exposes one)
- [x] Verify every control renders ≥16px on iOS (no focus-zoom) — the unlayered
      `@media (pointer: coarse)` floor in `globals.css` catches every `input`/`select`/`textarea`
      regardless of the `sm` size class; re-confirmed 0 fields < 16px in Phase 3.
- [x] **Focused field stays above the keyboard (prompt 31)** — native focus scrolling +
      `<ViewportManager>`'s `focusin` assist (`scrollIntoView({ block: "nearest" })` once the
      keyboard has settled, only when the field is actually clipped) + coarse-pointer
      `scroll-margin` so "nearest" clears the sticky header. Covered for fields inside the page,
      inside `<Modal>`/`<BottomSheet>` scroll areas, and the plan wizard.

## 13. Touch, pointer & keyboard parity

- [x] No hover-*only* functionality: gallery tile actions (set-best / favourite) now also show
      on `pointer-coarse` (touch) alongside `group-hover` + `focus-visible`
- [x] Swipe is optional everywhere it exists: photo lightbox & photo-wall viewer have visible
      44px `EdgeButton` prev/next + arrow-key handlers; swipe is an addition, not the only way
- [x] Touch targets: `.tap` utility (44×44) on icon buttons; nav items, bell, account trigger,
      edge buttons all meet it
- [x] Custom dialogs use the in-app `useConfirm` (not blocking `window.confirm`), keyboard-trap
      aware; account menu closes on Escape and restores focus
- [x] Edge-swipe guard — lightbox & photo-wall drag-to-navigate ignores gestures starting
      within 24px of a screen edge, so iOS Safari's back/forward gesture still works; horizontal
      chip rails use native `overflow-x` (no `preventDefault`, no gesture hijack).
- [ ] Full keyboard pass of the plan wizard, review score scale, and the calendar month grid
- [ ] Verify the horizontal chip rails (category rail, date picker, tabs) scroll with
      shift+wheel on desktop and expose focusable items for keyboard users

## 14. Browser scroll behaviour

- [x] One document scroll: `html, body { overflow-x: clip }`, no page-level nested vertical
      scroller; `min-width: 0` on all flex/grid children stops overflow at the source
- [x] `.scroll-area` (dialogs/sheets) has `overscroll-behavior: contain`, `scrollbar-gutter:
      stable`, and a real styled scrollbar on `pointer: fine` — the browser scrollbar is **not**
      hidden on ordinary content
- [x] `.no-scrollbar` is used only on short **horizontal** chip/tab rails, where a horizontal
      scrollbar would be visual noise — a defensible reason per the brief
- [x] Wheel / trackpad / touch / keyboard all scroll the page naturally (verified: no
      `overflow:hidden` on `body`, no scroll-hijacking libraries)
- [ ] Confirm `scroll-behavior: smooth` + in-page `#again` / `#memory` anchors on the date
      page land below the sticky header (`scroll-mt-*` is already set — spot-check on mobile)

---

## Known stubs (intentional — decide per launch scope)

| Stub | File | Impact |
|---|---|---|
| S3 storage driver | `src/lib/storage/s3.ts` | throws; **photos break on Vercel** with `local` |
| SMTP email driver | `src/lib/email/smtp.ts` | throws; password-reset email only in console |
| Web push channel | `src/lib/notifications/push.ts` | `NoopPushChannel`; no real push delivery |
| Google OAuth | `src/lib/auth/oauth/**` | returns 501 until credentials configured |
| External place provider | `src/lib/places/**` | `PLACE_PROVIDER=none` → own saved places only |
| Reminder dispatch | `reminder-service` | no cron; fires only when a user opens Home |

## Non-issues confirmed by the audit (do not "fix")

- `src/app/(app)/dashboard/page.tsx` — deliberate `redirect("/home")` for the old path
- `src/app/(marketing)/style/page.tsx` — dev-only, `notFound()` in production
- `next/image` in `src/components/ui/image-card.tsx` — only used by the dev-only style gallery
- No client state library — RSC + server actions is the intended architecture
- Business logic is in `src/server/services/**` + `src/lib/**`, not components — verified
