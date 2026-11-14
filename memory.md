# Project Memory — MONO

Last updated: 2026-11-15 (encrypted chat publication and live QA in progress)



## Project Overview

**MONO** — a private two-person relationship / date application. Used by exactly two connected
people on their personal devices. Not public, not social, not a marketplace or review site.
Every feature is backed by real persistence, authentication, server-side business logic,
validation, and real data.

**Stack:** Next.js 16 (App Router; Turbopack dev, Webpack production) · React 19 · TypeScript (strict) · Tailwind v4 ·
PostgreSQL · Prisma ORM · hand-rolled secure cookie sessions (bcryptjs + jose) · zod ·
storage & email driver abstractions. Deps kept minimal: `@prisma/client`, `prisma`,
`bcryptjs`, `jose`, `zod`, `tsx`.

**Layering:** UI · database · auth · authz (couple isolation) · business logic (services) ·
validation (zod) · storage · email · utilities · types · server actions/API · reusable
components. Business rules never live only in React components — they live in
`src/server/services/**` and `src/lib/**`. See `docs/architecture.md`.

## Status

### In Progress

- **Encrypted chat production release/live QA (2026-11-15)** — explicitly authorized to publish and deploy, then test photo view-once/twice, edits and both deletion modes on production using retained synthetic QA accounts. Refresh current main, build before commit/push, verify canonical deployment, exercise real client encryption and persisted limits. Do not migrate real user history or disclose recovery keys.

- **Encrypted chat release/device verification (2026-11-15)** — implementation and automated verification complete locally; production build passed. User approved private recovery codes. Production has not been changed, no real recovery code generated and no production history migrated. Cross-device browser/PWA UI and physical iPhone/Samsung checks remain. PWA screenshot/recording blocking or detection is unavailable; no fabricated secret alerts. See docs/encrypted-chat.md.


- **Live compatibility audio continuity QA (2026-11-15)** — user requests real live testing of
  compatibility playback/output changes without microphone muting or call disconnection.
  Use existing disposable QA sessions, verify production release, compare connected state and
  microphone/media evidence before/during/after normal/compatibility changes. Actual audibility
  needs listener confirmation; desktop results do not establish iPhone/Samsung hardware routing.

- **Physical PWA audio-routing verification (2026-11-14)** — user rejects native/store costs and

  requests a workaround in the PWA. Research found Web Audio output selection as an alternate
  route and WebKit single-track WebRTC routing bug 320087 (fixed upstream; installed release
  availability not assumed). Implement opt-in compatibility playback with real exposed output
  IDs, safe rollback/cleanup and standard playback recovery. Do not label acceptance by an API
  as physical earpiece success. AudioSession playback hacks can terminate microphone tracks and
  must not be used during two-way calls. User says both phones run latest versions and asks
  whether version-specific: use runtime detection and explain update/device differences.

- **Samsung notification settings recovery (2026-11-14)** — user reports manually allowing
  MONO notifications worked while the internal Enable button did not. This is permission-flow
  feedback, not proof of end-to-end notification delivery. Existing request already runs
  synchronously from tap and supports callback/Promise; exact phone/browser blocking cause
  remains unverified. Found missing automatic recheck on returning from external settings.
  Adding focus/visibility/Permissions API observation, silent-request recovery, manual setup
  guidance, and separate allowed-but-not-registered Finish enabling state. Browser testing
  is now explicitly allowed again; zero-spend constraint remains in force.

- **Strictly free native calling feasibility (2026-11-14)** — user asks how to obtain
  speaker routing and whole-phone sharing like WhatsApp on Samsung/iPhone, then explicitly
  says it must be free. Treat zero new spend as a constraint: no paid developer membership,
  paid calling SDK or paid relay/hosting without a later user change. Research only; no native
  implementation started. Android native MediaProjection/audio routing and private distribution
  can use free tools; Google's limited-distribution account allows up to 20 authorized devices.
  Apple free Personal Team builds expire after 7 days and need rebuild/reinstall; advanced
  capabilities may require membership. Regular iOS distribution is not a guaranteed zero-cost
  route. Need existing Mac/Xcode access and target iOS version before promising a free native
  iPhone build. Native capture still follows system consent/lock/protected-content rules;
  reliable calls can require TURN relay bandwidth. User now explicitly wants working audio
  switching; asked whether a Mac/Xcode is available for free iPhone installation. No native
  build or physical routing success claimed. Browser testing is allowed again.

- **Call controls and screen-sharing follow-up (2026-11-14; browser testing resumed)**
  — User explicitly says "Now you are free to test", superseding the earlier desktop pause.
  Use only the disposable QA accounts for live calls and preserve other browser sessions.
  Requested WhatsApp-referenced voice/video layout, voice speaker/earpiece option,
  full-screen video and shared-screen viewing with thoughtfully placed controls.
  Reports iPhone sharing only MONO and cutting off when leaving for the phone home screen;
  Samsung still does not offer the needed permission, preventing screen sharing.
  Exact Samsung permission remains unclear (previously notification, now screen sharing).
  Research supported browser/OS audio routing and capture before promising native behavior;
  physical-phone keyboard and two-way audio are still unverified.
  Implementation published as 7d18288; actual device testing remains with the user.

- **Responsive/mobile keyboard and two-way audio verification (2026-11-14)** — user asks
  full responsiveness check after full-screen release, including composer above mobile
  keyboard and audible media in both directions. Check live phone-sized portrait/landscape,
  tablet/laptop layouts and long-message/tools behavior. User asked to independently test
  Android/iPhone keyboard and voice-to-video audio; desktop emulation cannot prove these.
  Keep physical-device results separate from browser layout and automated test evidence.
  26 viewport/media regression tests pass. Live DevTools 320x568 and 390x844 portrait
  layouts pass; 390x300 with long draft keeps composer visible. Found Send clipping at
  844x190 with multiline draft. Cap input against visual height, compact header/tabs while
  keyboard open/very short, and move photo preview to a sheet to avoid inflating composer.
  Normal 844x390 landscape and 768x1024 tablet pass. Fix passes TypeScript, direct ESLint
  and production Webpack build. Published 3dbceb3; production deployment
  dpl_2VAbuaJs21NbP8VvDPBD7aYVsj4M READY on the live alias. Retest 844x190 passed with
  eight-line draft and expanded tools; Send stays visible. Test draft cleared without sending.
  Further live call/page QA interrupted by repeated desktop helper "already has an active
  request" and competing window changes. Asked user to leave QA controls to this chat.
  Actual Android/iPhone keyboard and audible two-way audio results still pending.

- **Mobile voice audio and Samsung notification follow-up (2026-11-14)** — user reports
  voice calls have no sound but video calls do; Samsung installed app notification enable
  does nothing, while iPhone does show its notification prompt. Screen-sharing statement
  remains ambiguous. Found voice rendered through hidden video containing a reserved video
  track and unmounted with the dialog. Separate persistent audio-only output, aggregate
  peer tracks, preserve audio through video upgrade/minimization, expose autoplay recovery.
  Support callback/promise notification permission, bound device registration/save waits,
  and show inline progress/errors and permission recheck. Detect screen-sharing capability
  at runtime rather than assuming all iPhone versions lack it. User is self-testing;
  do not interfere with their browser/device calls. 33 targeted tests and TypeScript pass;
  final lint passes after correcting a React ref-binding diagnostic. Production Webpack
  build passes. Published/pushed 796ffadc93d2e9887601f0995b6624ab0c19c056; Vercel
  dpl_2fQcBspqyB7rYQ3Xsdjdpx58aPsB READY with canonical production alias. Physical
  Samsung/iPhone behavior needs user retest after reloading. Samsung root cause is not
  established; progress/error handling now exposes permission versus subscription failure.

- **Permission-first calling and closed-app alerts (2026-11-14)** — user uses Android +
  iPhone and asks for maximum supported background calling plus working notification
  popups. Implement pre-call device setup and permission-before-config/start; remove the
  misleading pre-permission ringtone preview. Add short-lived incoming-call Web Push and
  safe notification-to-call routing using existing outbox/subscriptions. Installed PWA
  notifications cannot provide native CallKit/Android Telecom ringing or powered-off calls;
  explained this boundary. Native distribution is not configured/claimed. Live screen-share
  test is deferred until this requested update is handled. User handles permission prompts.
  Implemented Set up calling with stopped-after-check devices, explicit ringtone preview,
  notification opt-in/popup test; call config and start now both follow media permission.
  Removed outgoing preview-before-permission and clarified busy-device versus denial errors.
  Incoming calls atomically create one recipient outbox alert; after-response delivery checks
  both active members, opt-in/session and live RINGING status, with high urgency and <=60s TTL.
  Worker v6 routes exact call URLs, handles stale alerts and blocks external navigation.
  Configured previously missing production VAPID keys securely (private key sensitive;
  public key mirrored to NEXT_PUBLIC). 47 focused tests and 174 isolated PostgreSQL tests
  pass; TypeScript/lint and production build pass. Published c0b175487523dadf9aa13da783a9ec406e1bb5ed;
  Vercel dpl_BZRr83AGpKVut89DbceABs7LBQYt READY on canonical production. Live regular Edge
  QA partner session shows Set up calling and notification opt-in. User completed microphone
  and camera setup checks. Edge exposes a quiet/blocked notification permission request;
  requested the user allow it. Physical popup, remote closed-tab delivery and phone checks
  remain pending. QA sessions/passwords remain active for this testing; revoke on completion.

- **Call timeout, ringtone and controls follow-up (2026-11-14)** — live Chrome caller
  acquired its microphone and rang the Edge receiver. Verified the receiver's Incoming
  voice call dialog with Answer/Decline; Edge autoplay was blocked and showed Play ringtone.
  The caller's 40-second connection deadline incorrectly included unanswered ringing and
  reported a network error. Fix that distinction, offer explicit sound setup/retry, and add
  requested green pickup/red hang-up icons. Actual connected media and song audibility still
  need verification; no completed voice/video/screen-share claim. User handles device prompts.
  Implemented separate 61-second unanswered/40-second post-answer deadlines, 15-second
  reconnection grace, neutral missed/declined notices and call-specific service timeouts.
  Added same-element ringtone preview/setup, trusted-interaction retry, immediate sound
  stop on pickup/end, green pickup and red hang-up/decline buttons with accessible labels.
  Incoming status checks continue in background tabs (subject to browser suspension).
  21 focused regressions, TypeScript, targeted ESLint and the production Webpack build pass.
  Synced newer main 7fb2ff8 without changing upstream review/memory fixes. Published
  38f861e; production dpl_ELUgcXG1S8Xa4bHnxHJbfCATBMCi READY on canonical MONO URL.
  Live Edge confirmed green Pick up/red Decline handset controls, successful song preview
  (Audio playing/Call sounds ready), then automatic incoming-call playback with no fallback.
  Pick up displayed Edge's real microphone permission popup. User has not handled it yet;
  capture timed out after 30 seconds. Call cmwggcpzv0001l208wu6rf8rh acceptedAt remains null.
  Required async questions pending: allow microphone and confirm hearing the song. Do not
  claim connected voice/video/screen or audible playback at both ends. Keep QA sessions
  for continuation; revoke only after finishing. Runtime error/fatal logs empty in 15m check.
  Follow-up: user confirmed hearing the Edge song and allowed microphone access. Actual call
  cmwggwl0g0003l208398wbz45 connected in both browsers, upgraded AUDIO to VIDEO with real
  Edge camera preview and incoming Chrome feed, then ended (13:54:57–13:56:11 UTC).
  Chrome's simultaneous webcam attempt failed despite permission Allowed (likely shared
  device contention; error cause unconfirmed); voice connection survived. Need reverse
  camera after releasing Edge's device, screen-share checks, and audible voice/Chrome-song
  confirmation. User moving/minimizing QA windows interrupted input; ready question pending.

- **Actual live call verification requested (2026-11-14)** — user requests two-user voice,
  video upgrade, screen sharing and ringtone playback at both ends. Chrome state capture
  works again on this turn. Prepare isolated QA sessions; preserve real user sessions/data.
  User is handling browser permission/display prompts and audible media verification.
  Do not equate API signaling or generated media with a verified physical-device call.
  Caller Chrome Incognito (1706342), receiver Edge InPrivate (8718318), both signed into
  existing run d8e38499. Resumed after earlier Escape/URL-policy stops. Caller acquired
  microphone and receiver showed Incoming voice call/Answer/Decline; unanswered call
  exposed incorrect 40-second network timeout, now fixed locally. Receiver autoplay was
  blocked. No connected audio/video/screen or audible-song success claim yet.
  Only the two calling QA accounts had temporary passwords re-enabled; these sessions
  remain available for the next test. Revoke their sessions/disable passwords after QA.

- **Couple call device verification** — implementation and media-helper/backend signaling
  tests pass; the right-panel permission/cancel path passes without granting devices.
  Actual two-device audio/video, voice-to-video, screen sharing and restrictive-network TURN
  still need a real-device check. After the desktop restart, Windows browser automation
  stopped because it could not confidently identify Chrome's URL; no further UI input was
  attempted. Right-panel opening was queued. The synthetic peer harness was not executed.
  Live API verification passed separately; do not describe it as browser/media verification.
  Do not claim universal relay-free calling or unlimited free provider resources.

- **Earlier fixture cleanup needs fresh scope (2026-11-14)** — owner
  cmwfhrmd70000jn085kxe763q, partner cmwfi1sjy0002js08zbkat7yu and space
  cmwfhz08d0001jn073z348rlf remain. The space is no longer empty: it contains the
  pre-existing user-created draft cmwg0fvze0005l207xwg5gne0 plus the separately named filter
  QA draft/selected café. Do not use the old empty-space cleanup request to purge this space.
  Preserve all existing data; any permanent cleanup needs a fresh, exact approved scope.



- **Remaining verification / optional hardening** — real-device QA and live provider
  verification for Push/storage remain; credential registration/email/recovery is verified.
  Shared rate limiting, OAuth-token encryption at rest and operator recovery /
  permanent-erasure policy are possible follow-ups. Portable active-content archive/restore,
  per-device session controls and atomic account closure are implemented. Vercel deployments are
  enabled; remaining provider activation and production-data migration readiness need verification.

- **Production activation / real-device QA** — Vercel deployments are enabled; add keys when ready,
  verify Push/storage delivery, and complete device/browser QA. Keyless venue search, SMTP and the complete
  credential authentication/recovery flow are live and verified.

- **Scheduled reminder activation** — endpoint implemented; production scheduler configuration
  and a closed-app live test remain pending (see DEPLOY.md).


- **Prod/PWA conversion (prompt 21+)** — Phases 0–8 done; prompts 30 (launch-readiness) + 31
  (mobile keyboard) done. Published to GitHub on 2026-11-05. Vercel Git deployments are now
  authorized and enabled; follow `DEPLOY.md` for provider and production-data activation. Remaining checks in
  `docs/pwa-conversion-checklist.md` (Lighthouse on the live origin, real-device passes, a
  reminder worker activation and the remaining provider credentials).

### Done

- **Full live crop/upload audit (2026-11-15)** — deployed saved-framing, partner-avatar
  authorization/live-update and chat-upload timeout fixes in ef70e69 and 31f5c95. Completed
  32 real upload checks and 40 flow checkpoints across both partners in Chromium/WebKit
  browser/PWA profiles; eight additional viewer/rotation profiles passed without browser
  errors. Verified pixels, private access, persistence and updates without reloading.
  Navigation warnings and physical-device limits are documented in
  `docs/reports/live-crop-audit-2026-11-15.md`. Test data retained; sessions signed out.
- **Encrypted chat implementation (2026-11-15)** — private recovery code approved by user;
  client-side encrypted messages/stickers/photos, atomic view-once/twice, author-only edit and
  delete-for-everyone, persistent delete-for-me, resumable verified legacy conversion. All529
  unit and188 PostgreSQL integration checks passed; focused46 rechecked after final review;
  TypeScript, full lint and production build passed. No production deployment/migration or
  phone/UI verification claimed. See docs/encrypted-chat.md for recovery and security limits.


- **Automatic deployment cleanup (2026-11-15)** — active on free GitHub Actions after
  successful main/Production releases. Retains canonical live plus one healthy rollback;
  resolves live through its alias even after ignored builds. All43 safety tests pass.
  Uses approved60-second share links with immediate revocation. No billing or permanent
  bypass; MONO-only API credential expires12February2027. Other local work preserved.

- **Photo adjustment and consistent couple-photo framing (2026-11-14)** — published
  4590a53; Vercel dpl_29iRfVVdP4Y1hR5HJSnKVZWe2cJ7 READY on the canonical MONO alias.
  Shared crop/drag/pinch/zoom confirmation for profile, couple, date, camera and chat;
  couple images share a 5:2 frame plus Full photo. 14 unit checks, lint and production build
  pass. Chromium completed all 13 local flow checks. Production Chromium and WebKit/PWA
  preview checks pass with zero page errors, including narrow/landscape layouts and cancel.
  No production photos changed; test sessions signed out. See the image-framing report for
  local WebKit navigation diagnostics and the limits of automated iOS/PWA coverage.
- **Free PWA compatibility audio and notification recovery (2026-11-14)** — published code
  commit 623f193; push to main succeeded. Production dpl_6NCt6phSPDnmq82pK4tiTuJXyGoz READY
  and aliased to mono-kappa-beryl.vercel.app. Opt-in alternate local audio rendering, actual
  browser output selection, normal-playback recovery, external notification permission recheck,
  and transient call-sync feedback. 38 focused test cases across the exercised suites passed,
  plus TypeScript, targeted ESLint and final production build/function-size guard (80 traces,
  largest 26.82 MiB). Actual phone route and two-way audibility are not yet verified. No new
  browser call made for this release; status/alias verified through Vercel API.


- **Call controls and iPhone typing fix (2026-11-14)** — published 7d18288; production
  dpl_d5hRLNswijv4znpi8frUtB9TEQiA READY with canonical mono-kappa-beryl.vercel.app alias.
  WhatsApp-referenced circular controls and full-stage video, Fit/Fill, floating preview,
  actual browser audio-output selection with OS-managed fallback, and screen capture
  unsupported/error/pause/end messages. Fixed chat's double focus scroll on iOS by skipping
  generic page nudging, removing extra body keyboard padding and composer scroll margin.
  35 focused Node tests, TypeScript, targeted lint and production build/size guards pass.
  Preserved concurrent function-size update through 520f4f4. No browser testing/calls/device
  captures performed at user's explicit request. Phone audibility/appearance remain unverified.

- **Function storage optimization (2026-11-14)** — published1e7a24f, Vercel deployment
  dpl_9PzErxQqAcph8654aBNkdMRyF9aF READY with all3 canonical aliases. Resources reports
  75 functions: common APIs20MB vs52.3MB before; pages20.9MB vs53.2MB. Live database
  health/home/login return200; anonymous private sessions returns401.492 unit tests,
  174 isolated PostgreSQL tests,11 online browser checks, lint/build and packed query probe
  pass. Three broader browser failures reproduce on the native baseline. Free-only,
  no SQL migration; existing working tree/calling changes preserved. Build size guards
  and documentation-only skip reduce future growth; no historical/team-wide10GB guarantee.

- **Full-screen chat and call UI (2026-11-14)** — published 7e9a458 and correction
  ce814315ae69fba61fc72d0f1fa38d88f3427310; production dpl_D8DmGyVoNs8M6J9q7GpTAGh7Hqx2
  READY on canonical URL. Chat owns the viewport, with compact header/composer, content-width
  bubbles and reduced spacing. Full-screen calls have large video, floating self-preview and
  persistent controls. Live QA caught/fixed AppTemplate's missing height, then verified composer
  visible at normal zoom, 200% (~phone-width layout), and maximized desktop. Expanded message
  tools remain above composer. Disposable outgoing video call confirmed real local preview
  and full-window controls; ended after inspection. TypeScript, lint and final Webpack build
  pass. Browser zoom restored; physical phone keyboard/safe-area checks remain unverified.

- **Live partner edit audit (2026-11-14)** — deployed `ccfca96`. Both partners can edit their
  own revealed review while preserving submission/privacy boundaries. Fixed memory-heart
  partner sync. Live expenses/totals/splits, reviews/validation, memory text/covers/favourites
  and lists passed in both directions across Chromium/WebKit phone/PWA profiles, without
  reloads (1.0–5.7 seconds), at 320/390/844px. 171 integration tests, 16 targeted unit tests,
  lint and production builds pass. All synthetic records retained. Physical iOS untested.

- **Live completion-to-memory flow (2026-11-14)** — published dbe5936, Vercel
  dpl_KfdgghnBSWnpeF5atwmNVZ38rHBs READY. Fixed hard-coded dollar prefixes in INR expense,
  recap, actual-event cost and saved-plan budget fields. Memories/favourite cards now show
  saved memory titles and open memory details. Integrated concurrent chat release 9b571a9.
  Final build/TypeScript and targeted ESLint passed. Live UI + SQL verified completion,
  INR 600/1200 expenses by different partners, two actual events, private-until-both reviews,
  revealed reflections and favourite memories with cover photos. Final deployed read-back
  passed for both users in Chromium and WebKit with phone/PWA roles swapped, including
  320/390 widths and landscape. No production error/fatal logs in the verification window.
  Synthetic records retained per user instruction. Automated profiles, not physical iOS.
  Report: docs/reports/live-post-date-2026-11-14.md.

- **Full live multiple-event partner audit (2026-11-14)** — complete on READY release 28cdeb0.
  Chromium and WebKit each passed planning café → movie, validation, start sync, uploads by
  both partners, automatic photo sync and persistence/lightbox checks. Phone and simulated
  standalone PWA roles were swapped between engines. SQL confirms two venues/events and
  two photos by different partners in both successful dates. Normal WebKit PWA link navigation
  had zero errors; forced runner navigation caused canceled/background fetch errors. No new
  application defect or patch identified; verified existing deployment remains live.
  User explicitly requested KEEP test records: LIVE QA Events 7a9b30f6e0 has two synthetic
  users, four retained QA dates (including two interrupted attempts) and five photos.
  Do not delete them. Existing user data untouched; physical iPhone testing not claimed.
  Details: docs/reports/live-events-2026-11-14.md. Isolated checkout avoids unrelated root work.

- **Published private chat, 24 games and expanded calls (2026-11-14)** — feature commit
  9b571a9 pushed to main; Vercel dpl_HcpK3nKmz69FLbFghQzEe5W2eo9F READY on
  https://mono-kappa-beryl.vercel.app. Migration applied successfully. Preserved upstream
  28cdeb0 uploads, multi-event dates and iOS fixes. Supplied Anywhere With You MP3 rings on
  both ends, with autoplay fallback and cleanup. Either partner can add camera video or
  explicitly share a selected screen in the same call; Stop sharing restores prior camera.
  Passed 460 unit tests / 64 files, 169 local DB tests / 16 files, TypeScript, ESLint after
  the ref-return fix and webpack production build. Vercel Turbopack build also passed.
  Live normal-login/API checks passed text/emoji, sticker, private 360x240 image delivery,
  read receipts, space isolation, all 24 game invite/accept/move/result paths, complete
  Tic-tac-toe win/draw and persisted matching scores, incoming calls, both-partner video
  upgrades, decline, hang-up and signal cleanup. Live MP3 SHA-256 matches supplied source;
  HTTP206 audio ranges pass. No error/fatal runtime logs in the checked release window.
  Four isolated QA accounts and two spaces (run d8e38499) retained, with all 8 test sessions
  revoked and password login disabled. Main test space ccbf2f017574245eebb2e9257 has 53
  messages, one synthetic image and 25 finished matches across 24 games; foreign-access
  space cb235946c35d04bffbc29829c remains empty. Existing user data untouched. Non-secret
  evidence: .postgres-test/chat-release-live-report.json; browser/device limits above.

- **Uploads, multi-event dates and partner updates (2026-11-14)** — published aa28a06,
  Vercel dpl_cCpjG32RrwM4k7zhoM5eBdBZSV1g READY on mono-kappa-beryl.vercel.app.
  Fixed production local-disk uploads with private storage on existing Neon Free plan;
  no billing/autopay setup. Added separate venues/times for same-day Events, editable
  two-hour defaults, red per-step validation, ongoing Memories uploads, automatic visible
  partner refresh and schedule-only first-date recreation. Existing design/data preserved.
  Passed 415 unit, 134 isolated DB tests, 14 authenticated browser/provider scenarios,
  TypeScript, ESLint and final production build. Live HTTPS public Safari-style/PWA checks
  passed with zero JS/request errors, mono-v5 caches, healthy DB and protected endpoints.
  No error/fatal logs in the live test window. Signed-in flows used an isolated local DB
  and real private storage, not production user mutations. Own private test objects, local
  database/storage and temporary credential file removed. Automated iOS profiles only.

- **iOS keyboard and landscape fixes (2026-11-14)** — deployed e14197b on READY Vercel
  dpl_7iFGQchx2u3B6tvthNRrCsodStwt at https://mono-kappa-beryl.vercel.app. Preserved 81694ed.
  Offset-aware viewport/focus handling, pinch exclusion, notch/home-indicator safe areas,
  short-dialog scrolling, sheet focus preservation and landscape-enabled manifest; v4
  worker cache refreshes the old manifest. Same design, no new dependencies/schema/keys.
  All 404 unit tests, full ESLint, TypeScript/production build, 300 browser-matrix checks,
  27 post-sync checks, 25 tablet/desktop samples and 17 live HTTPS/worker/offline checks passed.
  No browser page errors or deployment error/fatal logs in the checked window. Dedicated
  local test database/storage removed. User selected automated checks only: WebKit on
  Windows and simulated keyboard/safe-area/standalone modes do not verify a physical iPhone.
  Reopen/refresh the installed PWA to receive the update. Reports: docs/testing.md and ignored
  .screenshots/ios-keyboard/{local,post-sync,live-results.json,desktop-regression.json}.

- **Private chat and 24 scored games (2026-11-14)** — implemented locally, uncommitted and
  not deployed. User chose classic four-token Ludo and expanded to 20+ games. All 24 games
  are playable with server-authoritative turns, hidden-state redaction, persisted outcomes,
  invitations/rematches and per-game W/L/D. Text, emoji, eight sticker cards, compressed private
  image sharing, read receipts/typing/unread header, and WebRTC voice/video UI/signaling are
  implemented using existing auth/Postgres; no paid provider signup or billing changes.
  Chat images are byte-signature checked/re-encoded, capped at 512 KiB each and 25 MiB per
  space, served by authenticated no-store routes; no blob bytes in polling. Games load lazily;
  bounded incremental polling pauses in hidden tabs. Calls have permission/connection deadlines,
  track cleanup and optional COUPLE_ICE_SERVERS relay configuration. Added BSD-2-Clause
  chess.js 1.4.0 only. Migration 20261114130000 applied to isolated local test DB only.
  All 432 unit tests, 164 DB integration tests, final full ESLint, TypeScript and Webpack
  production build pass. Right-panel two-account QA verified message/sticker/emoji/photo
  delivery, 24 cards/search, Tic-tac-toe invitation/acceptance/first move/turn enforcement,
  staged Ludo finishing move and saved win/loss after reload, staged chess/memory/dice controls,
  call cancellation and 320/390/1280 layouts. Fixed chess rank labels and cramped mobile header.
  Final new-tab console errors empty. Screenshots: .postgres-test/arcade-24-preview.png,
  arcade-overview-preview.png and arcade-scores-preview.png. Local preview retained on
  http://127.0.0.1:3213/chat (session 33708) with disposable example.invalid accounts and
  isolated PG port 55451/database mono_test_together_20261114; helpers/credentials ignored.
  Production remains 81694ed. Docs: docs/chat-and-games.md, docs/testing.md. Planner portable
  archive v1 does not include new history; complete DB backups preserve it. Real-device
  media/relay verification remains as noted above; no actual mic/camera was granted.

- **SOCIAL branches, radius and explicit Save (2026-11-14)** — published 81694ed; READY
  production deployment dpl_G7ZXLpoKsWhG92mNCxometswDF8T on the canonical alias, sin1.
  Rebased onto 297ac22, preserving the responsive photo fixes; combined build passed.
  Shared Explore/picker city and location search offers 1/5/10/20/50/100 km, separate branch
  IDs/addresses/distances, real matched photos, and exact-word brand results. No default city;
  Jaipur was the earlier saved QA café. New plans stay on-device through all four steps until
  explicit Save, with atomic venue/activity writes and duplicate-save protection. Nullable
  migration applied successfully. 396 unit and 130 distinct DB regressions pass, with full
  lint/TypeScript/Webpack builds. Local UI/SQL proved zero records before Save and exactly one
  planned date/place/activity afterwards. Live Explore and picker both showed five SOCIAL
  outlets within 20 km, only Noida at 749 m within 5 km, and three loaded source photos.
  Live new-plan navigation through Review preserved all five existing drafts and versions
  0/4/0/0/2. Health/database up; error/fatal logs empty. Real device GPS remains untested;
  permission/timeout/cancellation/high-accuracy retry use mocks. Isolated local test cluster
  stopped/removed. Screenshot: .postgres-test/social-radius-live-81694ed.png. User drafts and
  accounts preserved; chat remains the deferred next update.

- **Filter publication, live retest and Use my location (2026-11-14)** — initial a95439b
  pushed/deployed and migration 20261114060000 applied. Live testing found All + city omitted
  provider results; fixed that and comma-separated saved city/region matching. User then
  requested Use my location: added an explicit permission button, approximate coordinates,
  bounded/cancellable acquisition, manual city fallback, distances and a 20 km nearby radius
  for selected categories or All. Published final 7554357 to main; production deployment
  dpl_7kB1rqiupAw7qQ84ZsUtBkm34xSJ is READY on the canonical MONO alias in sin1.
  389 unit + 122 isolated PostgreSQL tests, TypeScript, full lint and production Webpack build
  passed; Vercel's normal build passed. Health is 200/database up and location Permissions-Policy
  permits self. Right-panel live checks passed Adventure/Activities, Café, Restaurant, All city
  results, Add Bowling once, actual café selection, save and reopen. Synthetic Jaipur point:
  20 mixed nearby venues across eight categories, max 0.370 km; 20 cafés, max 1.280 km.
  Native device location was not acquired; permission/timeout/cancellation paths use unit mocks.
  PostgreSQL confirmed QA category cafe, selected Cafe Coffee Day and one Bowling activity.
  Existing draft remained version 0/unmodified. No runtime error/fatal logs found. QA draft
  cmwg2h9kg0001jt076tb15r6d (MONO filters QA 20261114-a95439b) and its selected café were
  retained separately for review; no destructive cleanup or account removal was performed.
  Screenshot .screenshots/live-filter-location-7554357.jpg and non-secret JSON evidence
  .postgres-test/live-filter-results-7554357.json retained. Local test cluster stopped/removed.
  Couple messenger remains the next update, as explicitly requested.

- **Responsive photo fixes (2026-11-14)** — published 3a2332b; production deployment
  dpl_5n2nZMZvj9ENNMX3Y4dA5ugSothY is READY on the canonical MONO alias, Singapore.
  All three findings fixed: date/memory captions contribute to hero height while retaining
  the original ratio as a floor, and both photo viewers use a fixed dark backdrop token.
  Existing typography, gradients, spacing, corners and controls preserved. Full lint and
  final combined production build/TypeScript pass. 816 full-matrix local checks plus
  144 post-sync focused samples pass, covering 25 main sizes (320–3840px), both themes,
  browser/PWA emulation, long/max/short captions, photos/fallbacks and both viewers.
  Minimum measured viewer-control contrast ~9.99:1. All 100 live deployed-stylesheet
  samples pass; health 200/database up; new-deployment error/fatal scan clean. Existing
  a95439b/7554357 plan/nearby updates preserved. No production accounts modified.
  Local synthetic database/storage/log removed, servers and idle cluster stopped,
  own published-change backup stash removed. Native physical-device QA remains separate.
  Report and screenshot evidence: docs/reports/responsive-audit-2026-11-14.md.

- **Whole-site responsive layout audit (2026-11-14)** — completed against live 5bd1a57;
  25 main viewport configurations from 320px to 3840px, breakpoint boundaries and landscape,
  plus selected short-landscape, desktop pointer, light-theme and standalone/PWA variants.
  Recorded 1,971 screen/viewport samples (290 public live, 1,593 local main, 88 focused).
  All page groups, settings, planning/date/memory states, onboarding/invitations, empty
  states, menus/dialogs/sheets, photo viewer and archive-file preview covered. No measured
  page-level horizontal overflow, clipped control labels, unexpected blocked primary nav
  or uncaught browser errors. **Not fully responsive:** confirmed completed-date result
  label/title cropping at 320–360px and memory ordinal cropping at 320px with valid long
  content; also found weak white-on-pale photo-viewer control contrast in dark mode.
  Findings, source locations, suggested corrections and screenshot evidence are in
  docs/reports/responsive-audit-2026-11-14.md. These defects were audited, not fixed or
  deployed. Physical iOS/Safari keyboard/safe-area/zoom testing remains separate.
  Local synthetic database, generated test-image storage and private preview/server log
  removed; local servers stopped and idle test cluster stopped. Primary work preserved.

- **Plan-aware filtering across every category (2026-11-14, local)** — added plan-type chips
  and conservative title recognition; Adventure selects Activities, Nature selects Park,
  and Café/Restaurant/Bar/Cinema/Museum/Shopping/Staycation use the matching Where filter.
  Manual changes and All remain available. Nullable, validated `dates.discoveryCategory`
  persists the choice independently of the custom title and supports duplicate/archive restore;
  additive migration 20261114060000 exists and was applied only to the isolated local database.
  Picker separates matching ideas (which add real plan activities) from saved/provider venues.
  Added city browsing, mixed HOME/TRAVEL handling, category checks on provider results,
  stale-response protection and bounded search waits. Real provider testing caught a city-layer
  regression that chose small Jaipur villages; the corrected city/area lookup returned venues
  in Jaipur, Rajasthan and excludes venue objects from city-center selection.
  Right-panel local fixture passed Adventure → Activities, Add Bowling once, Café filtering,
  Restaurant + city, All, place selection, save/reopen and activity persistence. Custom title
  remained intact; real PostgreSQL confirmed category, café and one Bowling. 382 unit + 118
  database tests, TypeScript, full lint and Webpack production build passed. Screenshots and
  non-secret results retained in ignored local artifacts. Local preview stopped after testing.
  Not committed, pushed, deployed or migrated in production. User explicitly chose filters
  first and couple chat as the next update; no messaging/provider/billing changes were made.

- **Faster verification and space joining (2026-11-14)** — published 5bd1a57 to main;
  READY production deployment dpl_9yezvCYm8piKkM35sKqpd4sqFt9K serves the canonical MONO
  alias in sin1. Private same-origin JSON confirmation/status/hint calls bypass RSC rendering
  and the Server Action queue; confirmation has a 15-second timeout. Removed duplicate
  verification refreshes, reduced locked confirmation queries from six to two, and redirect
  connection actions straight to the resolved onboarding step. An eight-second pending hint
  offers a safe status navigation without resubmitting. 364 unit and 114 isolated PostgreSQL
  integration tests passed, along with TypeScript, targeted lint and Webpack build. The first
  sandbox build hit .next EPERM; the normal-access retry passed. Vercel's Turbopack build passed.
  Right-panel live run received all four real welcome/verification emails. Partner signed up
  from the owner's link, was blocked while unverified, confirmed the actual email, unlocked
  the original popup without refresh, returned through the email's invitation link, joined and
  reached the connected setup with both names. Observed warm click-to-visible timings:
  confirmation 305ms, verified-status check 508ms, join to profile 879ms (include browser control
  overhead; not an SLA or cold-start guarantee). Database: two verified users, two active
  members, one accepted invitation, one join notification. No generic error or production
  error/fatal logs. Screenshots and non-secret result JSON retained; cleanup approval pending.

- **Live signup → email verification → invitation join (2026-11-14)** — tested on bc0bc2c,
  READY deployment dpl_GLtRwnxUBeqizLGJ7ZfsAJ7hpgYD, in the right-panel browser. Two
  disposable accounts received actual welcome/verification emails. The owner verified and
  created a space/link; the partner registered from that link, saw the automatic verification
  popup, was blocked before verification, confirmed the actual inbox link, returned to the same
  invitation and accepted. Connected setup showed both names. Real PostgreSQL confirmed both
  verified, two active members, one accepted invitation and one joined notification. No
  “Something went wrong” appeared and production error/fatal logs were empty during the run.
  User explicitly approved permanent fixture cleanup: removed exactly two matching test users
  and their empty test space in a guarded transaction, verified zero remain, deleted both
  temporary inboxes and removed local private credentials/links. Screenshots and non-secret
  result JSON retained. No app code or existing real accounts/spaces changed.

- **Email/invitation and workflow publication (2026-11-14)** — published 18ee493 to main;
  dpl_A8292GxEwFs2ebenKgqsipEpDt4d is READY on mono-kappa-beryl.vercel.app, in sin1.
  Preserved the newer auth validation and mobile release while publishing the existing
  verified workspace changes. Combined 357 unit tests, lint and npm build -- --webpack pass;
  Vercel's normal Turbopack build also passes, with no pending migrations. Public health is
  200/database up, live verification page shows the new policy, and no error/fatal logs were
  found for this deployment. Live checks were read-only and sent no emails. Domain-based
  deliverability limitations remain; no SMTP credentials, provider settings or billing changed.

- **Required email verification and invitation recovery (2026-11-14, local)** — service-level
  locked verification checks for creating spaces, link/code joins and issuing invitations.
  Invite recipients get a resend/status popup after registration; an account-bound HTTP-only
  hint restores the original invitation after same-tab confirmation. Existing memberships
  and profile setup remain accessible. Fixed live P2028 join failures with bounded 30-second
  connection transactions, reduced round trips, retained atomic membership/link/notification
  writes and serialization retries. Reset confirmation state when a different email token is
  opened in the same tab. 346 unit and 113 isolated PostgreSQL tests pass; TypeScript/lint and
  supported Webpack production build pass. Right-panel registration → popup → resend → email
  confirmation → same invitation → explicit accept reached connected setup; SQL confirmed two
  members and one joined notification. Default local Turbopack build still hits a CSS-worker
  startup/IPC error. No publication, migration, credentials or production-user data changes.
  Brevo/Gmail audit covered welcome, verification and recovery samples: all pass SPF/DKIM/DMARC
  via Brevo's replacement sender. No custom authenticated domain exists; the user owns only
  vercel.app. Exact spam-classification cause is unavailable; inbox placement is not guaranteed.
  No provider settings or billing changed. Disposable test cluster and private email logs removed.

- **App-wide state-machine remediation (2026-11-13)** — explicit async ownership, upload
  scheduling/cancellation/retry, confirmation/history transitions, digest-bound restore
  eligibility, date capabilities under write locks, atomic favorites, reminder retirement and
  orphaned-job recovery. Pending forms preserve submitted snapshots and layout; activity
  toolbars retain failed input and wait for saves before planning navigation. Device drafts,
  image-source resets, timers, browser push and PWA replacement hardened. Full inventory and
  disposition in `docs/state-machines.md`. All 338 unit tests, 107 isolated PostgreSQL tests,
  76 functional browser checks and three production-build PWA checks pass; lint, TypeScript
  and production build pass. Browser screenshots reviewed. Production PWA smoke used an
  unavailable test database endpoint because production guards refuse loopback databases;
  real persistence was verified separately against isolated local PostgreSQL. Test database
  cluster, fixture media/logs and servers cleaned up; screenshots/results retained. Existing
  design/storage formats preserved; no dependency, migration, credential or deployment change.

- **Mobile browser/PWA responsiveness (2026-11-14)** — published 141ab3c;
  dpl_3rdtCQ19ZMDiN716baxG4ZdzU1JB READY on the canonical production alias. Functions now
  use Singapore beside Neon, confirmed by live bom1::sin1 response headers (previously iad1).
  Sampled warm public reads improved from 1392–1405ms to 158–426ms; first read 4489ms→1063ms.
  Fixed PWA-update padding swallowing bottom-navigation taps, closing-overlay interception,
  stale keyboard scroll, serialized background polling and missing navigation feedback.
  Bounded transaction timeout is 15s; unknown P2028 outcomes are never retried. Worker v3
  replaces on explicit Refresh. Existing design and validity gates preserved. 328 unit tests,
  100 PostgreSQL integration tests, lint and production build pass; nine authenticated
  mobile journey checks, two closing-overlay checks, eight local and eight live public
  browser/emulated-PWA checks, and three real worker lifecycle checks pass. Live health is
  200/database up; no new-deployment error/fatal logs found. No external drains configured.
  Physical-device QA remains a user-side check. No production accounts/data modified.
  Local synthetic database/private fixtures/logs/copied env removed and idle test server
  stopped. Unrelated primary-workspace state-machine changes remain untouched.

- **Validity-gated profile save (2026-11-13)** — published 9696b8d; deployment
  dpl_5pYYQMm8xoeWJpKGySBfQhktCLFz is READY on MONO's public alias. Profile Save changes
  requires a valid name and confirmed availability. Invalid/taken/checking/unavailable states
  disable saving; own unchanged name and available case variants work. Invalid Enter/requestSubmit
  is blocked, server duplicate rejection stays disabled until correction, stale feedback clears
  on edits and existing styles/loading/unsaved guard remain. All 317 unit tests, lint,
  build/TypeScript and nine authenticated local browser checks pass, including a local save/reload
  and 320px layout. Local synthetic database/private fixture/log removed and server stopped.
  Live health 200/database up; no deployment error logs found. No production profiles changed.
  Isolated codex/valid-profile-submit preserves unrelated unfinished workspace changes.

- **Validity-gated password updates (2026-11-13)** — published acf0680; production deployment
  dpl_9xtaqG5TGwDss7AYDEgbYNy4SbVA is READY on MONO's public alias. Reset and settings Update
  password stay disabled until their schemas pass, including matching new passwords and the
  current password in settings. Live edits, six-character/72-byte limits, invalid-submit guards,
  existing styles and loading controls preserved. Stale feedback clears after edits. All 317
  unit tests, lint, build/TypeScript, ten local browser checks and five live public reset checks
  pass. Authenticated settings checked with a synthetic local account and intercepted update
  request; no real passwords changed. Phone screenshots reviewed, health 200/database up and
  no deployment error logs found. Local database, fixture secrets/log and copied env removed;
  local servers stopped. Isolated codex/valid-password-submit preserves unrelated workspace work.

- **Validity-gated auth buttons (2026-11-13)** — published c45875a; deployment
  dpl_DWVT1NgFp4RvYDNCcBuWZNmC3HRX is READY on MONO's public alias. Create account requires
  valid required values, matching passwords and confirmed name/email availability. Sign in
  follows the existing valid-email/nonempty-password schema; Send reset link requires valid
  email. Buttons disable immediately after invalid edits, during availability checks and for
  registered/uncheckable emails. Same button styles/loading behavior, server validation and
  invalid Enter/requestSubmit guards retained. All 317 unit tests, lint, build/TypeScript,
  ten local and ten live browser checks pass. Verified 320px layouts, byte limits, case edits,
  native input events, no auth submissions and no browser errors. Live health 200/database up;
  no deployment error logs found. Isolated branch codex/valid-auth-submit preserves unrelated
  unfinished workspace changes. Local server stopped and copied env/test log removed. No
  accounts, credentials, database migrations or email sends changed.

- **Login/recovery live email validation (2026-11-13)** — published 37ddd78; production
  deployment dpl_3otsg6xZ5g9YnCb9g9pRKZQskFFJ is READY on MONO's public alias. Shared email
  format field gives immediate red borders and an inline message on login/forgot password;
  correction clears errors, and rejected submissions retain input and dismiss stale feedback
  on edits. Existing design, login feedback placement and recovery privacy retained. All 317
  unit tests, lint, build/TypeScript, eight local and six live browser checks pass. Focus/hover
  computed colors, message placement and 320px screenshots verified; no browser errors or
  availability queries. Live health 200/database up; no deployment error logs found. Published
  from codex/live-login-email in the isolated checkout; unrelated unfinished primary-workspace
  changes preserved. Local server stopped; copied env and test log removed. No account changes,
  migrations, credentials, billing or emails sent.

- **Live registration email validation (2026-11-13)** — published 1168c23; deployment
  dpl_5Z4SsShFq5YeFy1wJx6XRuLHRJp1 is READY on the public MONO alias. Invalid and already
  registered emails show the existing theme red border and inline message before submission;
  correcting the address clears errors. Debounced normalized POST checks, stale-response
  cancellation, neutral outage fallback and private boolean responses. Duplicate submissions
  receive structured email field errors, and old form feedback clears on edits. Existing UI,
  recovery/login privacy, email delivery and database policy retained. All 317 unit tests,
  99 PostgreSQL tests, seven local and six live browser checks pass; lint, TypeScript and build
  pass. Reviewed 320px screenshots; health 200/database up; no deployment error logs found.
  Local synthetic test database/fixtures/log removed and servers stopped. Live tests created
  no accounts and sent no emails. No migration, credentials or billing changes.

- **Live confirmation and exact-name uniqueness (2026-11-13)** — published 48c437e;
  production deployment dpl_E6FFtc447rRRteTFjYHhuH2bsnrs is READY on MONO's public alias.
  Password/confirmation validate as either changes, with red errors and a matching status;
  six-character minimum and strength guidance remain. Names have live availability checks and
  a race-safe case-sensitive active-user index: Tushar, TUshar and tushar may coexist, exact
  duplicates cannot. Profile and OAuth paths honor the rule. Account deletion clears name and
  nickname and releases the exact name. No existing production account was renamed or deleted.
  All 310 unit tests, 97 PostgreSQL tests, nine local browser checks and three live read-only
  browser checks pass; lint, TypeScript and final build pass. Phone screenshots reviewed.
  Production migration/index valid, health 200/database up, no deployment error logs found.
  Explicitly approved Neon test branch and all local synthetic data/private logs cleaned up;
  local servers stopped. Live verification created no accounts.

- **Six-character passwords and validation UI (2026-11-13)** — published 31c66ba; Vercel
  deployment dpl_CsWrbaEUPQ2UjEENVGBuYzL7rUVD is READY on the public MONO alias. Registration,
  recovery and settings now accept six-character passwords, with optional length/lowercase/
  uppercase/number/symbol strength guidance and Caps Lock warnings. Confirmation and bcrypt byte
  limits remain; existing login compatibility is preserved. Invalid fields use theme red borders
  with reliable hover/focus specificity and accessible descriptions. Login feedback appears below
  Remember me. Existing design retained. All 305 unit tests, seven local full-flow browser checks,
  three live public-form checks, lint, TypeScript and final build pass. Live computed-color test
  confirms red borders; 320px layout and screenshots reviewed. Local test database/private reset
  logs and credentials removed, servers stopped; real account passwords unchanged.

- **IndiaRestros-first venue photos (2026-11-13)** — user explicitly selected the source after
  the audit. Published 83ffbc1 to main; READY deployment dpl_7d7eUddDedK77tUucqQLgbBndnJm is live
  at mono-kappa-beryl.vercel.app. Indian restaurant/cafe matches try IndiaRestros first, with
  Commons for misses, rejected/ambiguous candidates and source failures. Conservative name/type/
  coordinate matching, safe same-listing URLs, provider credit without fabricated license/author,
  bounded caches/batches and upstream backoff. No API keys, accounts, migrations, new env vars,
  billing or autopay. Real checks matched 9/12 Delhi Starbucks locations and Karim's restaurant
  locations. All 302 unit tests, seven isolated browser checks, TypeScript, lint and final build
  passed; reviewed phone screenshots. Local test DB/private fixtures removed and servers stopped.
  Production health is 200/database up, with IndiaRestros allowed in image CSP. Authenticated UI
  verification used isolated local data and actual upstream photos; no production fixtures were
  created. Coverage remains partial; image-load failures retain the existing placeholder.

- **Broader free India photo-source audit (2026-11-13)** — tested IndiaRestros' keyless API;
  Delhi Starbucks results do include photos and exact coordinates matching a known Photon venue.
  Its detail response identifies sampled photos as Swiggy, Magicpin and Zomato (including shared
  chain images), with no author/reusable license fields. This conflicts with its sources page's
  statement that other platforms' photos are not republished. Its API terms permit general use
  but did not resolve photo redistribution permission, so no automatic source integration was
  shipped. Mapillary/KartaView are free street imagery, not confirmed branch galleries; India
  venue coverage was not established. Foursquare photos are paid Premium; TomTom POI Photos
  exclude free/PAYG; requesting a new Flickr key requires Pro. No verified replacement meets
  broad authentic Indian venue-photo coverage plus no billing and clear reuse terms. Existing
  Commons provider, application code, credentials, live data and deployment are unchanged.
  The user subsequently selected IndiaRestros explicitly; the activation entry above supersedes
  the decision to leave the app unchanged, while preserving the audit's provenance findings.

- **Free restaurant/cafe photos (2026-11-13)** — implementation 8c58769 is live on Vercel
  (READY deployment dpl_4MZLtXrVnbKA87YoCYyEg6Way5KC). Exact OSM-to-Wikidata links resolve
  licensed Commons thumbnails, with author/custom credit, license/source links and cropping
  disclosure in Explore, saved details and the picker. No key/account/billing/autopay, migration
  or environment change. Bounded batches/cache/backoff and safe Wikimedia-only hosts; missing,
  unclear-license or failed images retain placeholders. Fixed failed SSR images before hydration.
  Real Le Grand Véfour photo/credit verified, all 284 unit tests and six local Chromium checks
  pass, screenshots reviewed at 390/320px, full lint/TypeScript/final build pass. Vercel health
  returns 200 with database up and the required thumbnail CSP. Local test DB/private fixtures
  removed, servers stopped; no production records changed for this feature. Coverage is partial
  and many local venues have no linked photo. Public services are best effort.

- **Live venue selection verification (2026-11-13)** — after explicit create-and-remove approval,
  all seven Chromium checks passed on https://mono-kappa-beryl.vercel.app at deployed 0dde5b1:
  fixture login, real cafe search/attribution/390px layout, selection/save/reload, city restaurant
  search, disabled Google photos, saved details/Maps link and session revocation. No browser
  errors; phone screenshot reviewed. Production read confirms exact Photon OSM node N14046155168
  at 28.5410984, 77.1550259 saved to the fixture draft. Deleted only fixture 33e5aff0ba62's two
  example.invalid users, couple and cascaded test content after revoking its session. Final
  database counts are zero for fixture users, couple, memberships, dates, places, sessions and
  notifications. Removed private fixture password/SQL files. Existing user data, application code
  and deployment settings unchanged; no fix or redeployment was needed.

- **Free real venue search (2026-11-11)** — Photon/OpenStreetMap is implemented and live at
  mono-kappa-beryl.vercel.app in c85c51b (READY deployment dpl_5aSrQLGDagg9qb6WVZb5XHjmaVyw),
  with Production PLACE_PROVIDER=photon. No signup, key, card, billing or autopay is required.
  Real named cafe, city/category and exact venue lookups pass; 270 unit tests, full lint,
  TypeScript and production build pass. Seven authenticated local Chromium checks verify real
  cafe results, exact selection/save/reload, restaurant search, disabled Google photos, venue
  details/Maps links and session revocation. Database read confirms exact OSM ID and coordinates.
  Phone screenshots reviewed; no browser errors. Local test database/private credentials removed
  and server stopped. Production fixture creation was rejected by automatic approval review;
  optional live write-test permission was requested, but no production fixture or user data was
  changed then. The approved live test and cleanup completed on 2026-11-13 (entry above).
  Public Photon is best effort, OSM coverage differs, and Google photos/reviews/ratings
  are unavailable. Saved/custom fallback and the existing UI are preserved.

- **Google Maps/Places status audit (2026-11-11)** — Google Places API (New) provider,
  search endpoint, date place picker/provider selection and Maps links are implemented.
  Current Vercel production metadata has neither PLACE_PROVIDER nor GOOGLE_PLACES_API_KEY;
  the runtime defaults to saved/custom places. Real Google restaurant search is not activated.
  Activation requires the Google Places configuration documented in DEPLOY.md. No keys,
  application code or deployment settings were changed for this read-only question.

- **Complete live authentication flow (2026-11-11)** — fixed initial service-worker claims
  clearing registration drafts/verification tokens and the shared guard blocking signed-in
  recovery. Recovery retains the existing visual shell; successful reset clears its cookie.
  Implementation `fc0ea27` is READY on Vercel (`dpl_Bsrig1sNRGLAYJo86TPE8FSSKBHq`). Actual
  welcome, verification and reset messages arrived in an isolated Mail.tm inbox; their real
  links completed verification and signed-in/signed-out recovery. Checked wrong/duplicate
  credentials, cookie flags/remember-me, replay denial, mismatched confirmation, two-device
  revocation, new-password login/reload and final sign-out. Database confirms verified address,
  two consumed reset links, no couple and zero active sessions. 253 unit tests, full lint,
  TypeScript, final build, 12 account browser checks and three first-visit checks on the local
  production build and live origin passed. The real user's account and credentials were untouched.
  After explicit user approval, the exact test account, cascaded auth rows, temporary inbox
  and ignored private test state were removed. The working fixture identity/results remain
  as nonsecret audit artifacts.

- **Registration welcome and verification emails (2026-11-10)** — MONO HTML/text welcome and
  verification emails now follow registration, with hashed 24-hour single-use tokens, explicit
  confirmation, safe resends and optional onboarding/settings notices. Implementation `7596136`
  is READY on Vercel (`dpl_2qLDfkfqwVsHs15Fbq6c9M2S5mjq`); its additive migration applied and
  live health reports database up. Production registration logs confirm welcome SMTP acceptance
  at 14:21:41 UTC and verification at 14:21:45 UTC. Verification for the user's existing mailbox
  was accepted at 14:22:27 UTC. Inbox placement is not observed; passwords/account access are
  unchanged. 251 unit, 92 PostgreSQL and 17 browser checks, lint, TypeScript, template previews
  and production build passed. After explicit user approval, the exact synthetic account and
  cascaded tokens/session were removed; the real user's account remains unchanged.

- **Live branded email on Vercel (2026-11-10)** — released MONO HTML/text password recovery
  through Brevo SMTP, with production-only secrets and the correct public APP_URL. Implementation
  `a7407ea` is READY on Vercel; health reports database up. Registered the user-requested mailbox
  through the live UI using an undisplayed random temporary password, revoked the temporary
  session, then requested recovery. Production POST `/forgot-password` logs confirm SMTP
  acceptance at 2026-11-10 13:15:21 UTC. The user can choose their password using the emailed
  30-minute single-use link. Inbox placement is not observed. All 240 unit tests, TypeScript,
  email lint, production build and desktop/mobile template previews passed. Other integration
  settings and the reference applications are unchanged.

- **Publish settings screens (2026-11-10)** — fresh required production build passed;
  implementation commit `6c026f7` successfully pushed to `origin main` (`Tus-GitHub/MONO`).
  Includes all three settings screens, regression tests, documentation and project notes.
  Integration keys unchanged. The enabled Git integration can deploy this push; hosted CI
  and deployment completion were not verified during publication.

- **Remaining settings screens (2026-11-10)** — added `/settings/password`, `/settings/sessions`
  and `/settings/archive`, linked from Settings and styled with existing primitives/tokens.
  Includes shared password validation and all-device sign-out; confirmed current/individual/
  other/all-device revocation; portable download, file preview, independent partner approvals,
  expiry/renewal, confirmation and restore feedback. Existing backend privacy and empty-space
  rules remain authoritative. Verified 237 unit tests, 82 PostgreSQL cases, 13 new Chromium
  browser checks, TypeScript, full lint and final production build. Reviewed phone/desktop
  screenshots and 320px enlarged archive text. Integration keys, live data and deployment are
  unchanged. Test fixtures cleaned and the local test PostgreSQL server stopped.

- **Codebase completion assessment (2026-11-10)** — reviewed architecture, features, schema,
  CI and remaining launch work. Reverified all 234 unit tests, TypeScript, lint and production
  build successfully. Core scope is substantially implemented; provider activation, physical
  device QA, production recovery verification and settings UI for backend-only archive/session/
  password controls remain. PostgreSQL/browser suites and live deployment were not rerun.
  Application code, UI and keys unchanged; pre-existing memory edits preserved.

- **Email sending status audit (2026-11-06)** — SMTP transport and password-reset integration
  are implemented; eight targeted transport/auth tests pass with mocked mail. Local `.env`
  selects `EMAIL_DRIVER=console` and has no SMTP credentials. Vercel metadata lists no EMAIL_*
  or SMTP_* variables (zero hidden production variables), so the app defaults to console there
  too. Real inbox delivery is not configured or verified. No mail was sent and no credentials,
  environment settings, UI or application code were changed.

- **Cross-browser regression fixes (2026-11-06)** — native Firefox compatibility coverage added
  with 11 checks; Chromium now runs 51 checks across five suites. Fixed unnamed notification
  toggles, asynchronous photo-viewer history closure and clipped controls at enlarged root text.
  Strict route assertions now reject 404 pages. Latest local Chromium compatibility/workflows
  passed 23 checks, including 112 responsive route/viewport combinations; the earlier journey,
  account and pagination checks passed 28 checks. Final native Firefox run passed all 11 checks.
  All 234 unit and 82 PostgreSQL tests, lint and TypeScript passed. Normal phone reference matches
  except hover/dev-tool pixels; the landscape screenshot is pixel-identical. Existing design,
  colors, copy and keys preserved. Published `9386ae6`; GitHub run `42191624217` passed all 51
  Chromium and 11 Firefox checks plus code/database checks and build. Vercel production deployment
  is READY; authenticated login/health reads return 200 and health reports the database up.

- **Detailed project and database Word report (2026-11-06)** — created the 60-page editable
  report in `docs/reports/MONO_Project_Architecture_and_Database_Report_2026-11-06.docx`.
  Covers completed functionality, architecture, all 26 application tables / 319 columns,
  50 foreign keys, 17 enums, 16 SQL CHECK declarations, six migrations, routes/actions/services,
  the full 494-file audited source hierarchy, verification evidence and remaining launch work.
  Rendered and visually inspected every page; source completeness checks passed. Corrected
  outdated table count and Google OAuth wording in `docs/architecture.md`. UI and keys unchanged.

- **Timezone, keyboard and responsive checks (2026-11-06)** — published `5ececd8`; GitHub's
  full run passed 234 unit tests, 82 PostgreSQL cases and 40 browser checks, lint, TypeScript and
  build. Fixed expense clock conversion/preservation, hidden initial focus and nested scroll
  cleanup. Verified 16 routes at seven viewport sizes. UI styling and integration keys unchanged.
  Vercel remains enabled; the audited deployment is READY. Current served login/health return 200
  and health reports database reachable. Actual-device, provider and operational checks remain.

- **Continued delivery and browser CI (2026-11-05)** — Vercel Git deployments re-enabled and
  milestone commits `b18f877` and `5883d55` pushed. All 36 browser checks and the code/database
  job passed on GitHub for `5883d55`; Vercel reports its production deployment READY. Fixed lost
  expense corrections and collapsed optional details. UI styling and keys are unchanged.
  User authorizes further validated pushes/deployments in scope without another confirmation.

- **Publish verified functionality changes (2026-11-05)** — required production build passed;
  implementation commit `f371333` successfully pushed to `Tus-GitHub/MONO` on `origin main`.
  Includes the audited functionality, archive/account controls, regression tests, migrations and
  documentation. An existing Vercel integration automatically deployed that commit despite the
  initial deferral; a follow-up paused Git deployments. The user subsequently accepted Vercel
  deployment and authorized resuming it. Keys remain unchanged. See the Task Log for details.

- **Browser E2E and functionality fixes (2026-11-05)** — added repeatable isolated Chrome suites
  and fixed calendar initialization, photo pagination/retries/caption handling, modal history and
  confirmation redirects, revoked-session navigation, private memory drafts/deletion, and image
  conversion. Verified 28 browser checks, 212 unit tests, 75 PostgreSQL cases, lint, TypeScript and
  production build. Existing UI preserved; keys, live migration, deployment and publish deferred.
  User's two-day target prioritizes the existing scope and final device/provider verification.

- **Archive/restore and account/session controls (2026-11-05)** — added bounded versioned media
  archives, session-bound per-member approvals, empty-space atomic restore and replay receipts;
  persistent device sessions, individual/other/all-device revocation, password changes, atomic
  account closure and deletion-race safeguards. Existing UI preserved. Verified 203 unit tests,
  73 PostgreSQL cases, all six migrations from an empty DB, type checks, lint and production build.
  No keys changed, live migrations, deployment or publish. See the Task Log and new usage docs.

- **Deep audit remediation pass two (2026-11-05)** — persisted per-browser push tasks with leased
  retries, device-specific subscription cleanup/logout, corrected history/photo pagination,
  staged-upload cleanup and seven-day deletion retention, current-reference media authorization.
  Added migration and operational diagnostics. Verified 183 unit tests, 42 PostgreSQL cases,
  type checks, lint, production build and preserved styling. No live database migration or publish.

- **Deep audit remediation pass one (2026-11-05)** — protected review exports/place totals and
  recommendations; serialized plan/activity/place/review/lifecycle writes; versioned plan forms;
  couple-timezone calculations and currency-safe totals. Added initial SQL integrity migration,
  real PostgreSQL integration tests and CI. Current UI preserved. Existing application DB has
  not been migrated; apply the reviewed migration after preflight before running this version there.

- **Deep project / PostgreSQL research report (2026-11-05)** — saved
  `docs/project-postgresql-audit-2026-11-05.md` and unexecuted read-only
  `docs/sql/postgresql-audit.sql`. Fourteen findings and twelve feature proposals, with code
  evidence, official sources, PostgreSQL recommendations, acceptance criteria and sequencing.
  Original priority gaps included review privacy, mutation-level plan locking, timezone semantics,
  currency totals, concurrency and database verification; remediation progress is recorded above.

- **Codebase completion follow-up (2026-11-05)** — independent reminders, rescheduling
  race protection, blocked-storage draft reset, plan-save validation, save-result-aware unsaved
  guards, and latest-result review feedback. UI preserved. See Task Log.

- **Publish (2026-11-05)** — production build passed; implementation commit `ad4ab82`
  successfully pushed to origin/main (Tus-GitHub/MONO). Credentials stayed excluded.

- **Functionality completion without UI changes (2026-11-05)** — SMTP, integration failure
  handling, protected Places photos, persistent plan/review drafts, concurrent join/reset
  protection, and runnable reminder worker implemented. See Task Log for verification.

- **Scheduled reminder implementation (2026-11-05)** — protected cron endpoint, transactional
  in-app delivery, membership eligibility, tests, and deployment instructions implemented.

- **Codebase orientation (2026-11-04)** — mapped architecture and current features; verified
  98 tests across 14 files and TypeScript check pass. No application code changed.

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

### 2026-11-15 — Full live crop and upload flow for both partners

**DONE.** Completed the live browser-picker → upload API → persisted private file → both
partners' views audit in the isolated codex/live-crop-audit worktree. Preserved concurrent
deployment-cleanup work and the root workspace. No billing, dependencies or migration added.

- Published ef70e69: private photos preserve the confirmed crop; fixed card fill positioning,
  removed edge-clipping hover scaling and cleared loaded placeholders. Partner avatar GETs
  previously returned 404; added only the current-avatar exception for active same-couple
  members, preserving all other private-media/retired-key restrictions. Avatar save/removal
  now changes the couple revision so the partner refreshes automatically.
- Published 31f5c95: live chat showed an error after its image had saved because the generic
  15-second deadline expired. Multipart images now get the same 120-second allowance as
  other uploaders, preserving ordinary chat/call deadlines and retry idempotency.
- 18 focused unit tests, four real-PostgreSQL authorization/revision tests, targeted lint,
  TypeScript/production build and the 80-route runtime-size gate passed. The dedicated
  loopback PostgreSQL instance was stopped after testing.
- 32 verified uploads and 40 flow checkpoints completed across both partners, Chromium and
  WebKit, phone browser and standalone PWA. Compared crop preview/persisted pixels and both
  partners' protected bytes; verified cancellation, shapes, Full photo, camera entry, chat
  confirmation, persistence and partner updates without manual reload. Checked saved framing
  across Home, couple/settings/onboarding, date/history/review and Memories views.
- Eight further viewer profiles passed with zero browser errors: portrait/landscape full
  views, zoom/reset, full chat photo and rotation of the crop dialog. WebKit's final matrix
  logged background navigation access-control messages despite all ten checkpoints passing;
  retain the raw strict-failure flag in local evidence. Instrumented follow-up had 19 API
  successes, zero JavaScript/page errors and an expected aborted poll. Full details and
  test-readiness corrections: `docs/reports/live-crop-audit-2026-11-15.md`.
- Vercel dpl_rUthfQB2D9RDyq5aF4K6ceqHQnKh/31f5c95 is READY on the canonical MONO domain.
  Synthetic test accounts/couple/dates/messages/photos retained as requested; all temporary
  sessions signed out. These are automated engine/standalone profiles, not physical iPhone,
  native camera or installed-device verification.

### 2026-11-14 — Automatic post-release deployment cleanup (DONE 2026-11-15)

- Final runtime6d9b5ef preserved concurrent photo/avatar release ef70e69. Automatic
  release-event run43630415393 succeeded in apply mode, removing obsolete e3e52d2
  and retaining only6d9b5ef plus ef70e69. Both keeper database checks passed; all3
  canonical aliases stayed live and public health/login returned200.519 unit tests,
  43 cleanup tests, lint/actionlint, production build/typecheck and size gate pass.
  Proof: https://github.com/Tus-GitHub/MONO/actions/runs/43630415393

- Post-documentation follow-up: a safely ignored/CANCELED deployment can become the
  project production target while the canonical domain still serves its READY deployment.
  Changed production identity to the fixed canonical alias assignment, checked against
  MONO project/team and redirect/deletion/ID consistency.43 safety tests cover this case
  and hostile/ambiguous aliases. Preserved concurrent photo/avatar release ef70e69.
  No weakening of READY or health guards.

- Published workflow/tooling through e3e52d2, based on latest ccb5027 without changing
  application source or original workspace edits. GitHub repository secret VERCEL_TOKEN
  is restricted to MONO, expires12February2027, and never enters source/artifacts/logs.
  Public repository uses free standard Ubuntu runners; no Vercel function/cron or billing.
- Successful main/Production deployment_status events from vercel[bot] trigger cleanup.
  Vercel uses SHA refs, so verify the event SHA against live main-branch metadata.
  Production target, both keeper database health checks and canonical alias are verified
  repeatedly. Preserve aliases/newer previews/in-flight work; stop on drift or uncertainty.
  Recoverable DELETE is never retried. Batch/scope/state guards are covered by41 tests.
- Explicit owner approval covers60-second shareable access to the two keeper deployments.
  Use _vercel_share and only the required same-host/same-/api/health cookie exchange;
  reject external redirects and revoke the generated credential in finally. No permanent
  project bypass credential or protection disablement. Hobby permits one share link/account;
  checks run sequentially and replace existing shareable access. Credentials stay in memory.
- Dry-run43628255017 succeeded. Saved MONO_DEPLOYMENT_CLEANUP_ENABLED=true in GitHub;
  apply43628696457 succeeded and deleted exactly5 obsolete unaliased deployments.
  Replayed the original deployment_status run (attempt2): apply=true, both keepers healthy,
  zero remaining candidates. Live dpl_EBpmWxQkrs1a6Pjz7XhMtUJj9vZN/e3e52d2 and
  rollback dpl_HiXYBDc7SVgrBEZGLVEYwXQ1jC4t/49987ce are the only2 retained deployments.
  All3 canonical aliases remain live; direct public health200/status ok/database up.
-519 application tests,41 cleanup tests, lint/actionlint and production build/typecheck/
  size gate pass. GitHub code/database checks pass; existing Chrome/Firefox E2E failures
  also occurred before this tooling release and remain outside this task. No browser app QA.
  Documentation records credential renewal, failure behaviour and rolling storage accounting:
  pruning stops future accumulation but cannot instantly erase historic usage or cap other
  projects. Operation proof: https://github.com/Tus-GitHub/MONO/actions/runs/43628696457

### 2026-11-14 — Crop uploads and preserve couple-photo framing

**DONE.** User reports uploads have no framing control and couple photos are cut
off differently across the app. Confirmed settings/onboarding used 3:2, the couple banner
5:2 and Home a circle. Added a shared pre-upload crop dialog with drag, pinch, zoom,
keyboard movement, reset, multi-photo review and full-photo preservation. All couple-photo
displays now share a 5:2 frame and contain the saved image. Cancel never uploads; only
confirmed crop pixels are sent. Camera, date and chat use the same editor. Found and fixed
landscape dialog-footer clipping and an onboarding image-positioning conflict during QA.

14 crop/resize/queue tests, targeted lint and the final production build passed (80 runtime
traces; largest 3.29 MiB, summed 209.18 MiB, unique 5.38 MiB). Final Chromium report
chromium-mwgohf04 passes all 13 end-to-end checks with zero page errors. WebKit report
webkit-mwgoggbb passes all 13 functional checks but retains one background /couple prefetch
access-control diagnostic on local HTTP; its overall zero-error assertion is not marked
passed. The two-page settled-navigation diagnostic passes. A separate full local HTTPS run
was interrupted by a test document navigation racing a refresh; no clean full local WebKit
run is claimed. Local test fixtures and browser transport are isolated.
Synced the isolated worktree through 623f193 to preserve the concurrently published call, keyboard
and PostgreSQL adapter changes. No production records or photos have been changed. Tests
run headlessly with dedicated profiles and a loopback database, without operating the shared
desktop or changing the other chat's call tests. User asked "update" and then "is it
published?"; answered accurately that the feature was not yet live and continued publishing.

Initial push was safely rejected because 623f193 landed concurrently; rebased and preserved
the audio/notification updates, then rebuilt successfully. Commit 4590a53 pushed to main.
Vercel dpl_29iRfVVdP4Y1hR5HJSnKVZWe2cJ7 is READY with the canonical alias. Live authenticated
Chromium and WebKit checks now pass: mobile touch pinch, Full photo, 320/390 portrait and
844 landscape controls, zero upload requests on cancel, zero page errors. Both synthetic
sessions signed out. The test account's saved photo was unchanged. Told the user the update
is live. Automated profiles only; no physical iPhone or installed-device test is claimed.

### 2026-11-14 — Free PWA audio-routing workaround (IN PROGRESS)
### 2026-11-15 — Live compatibility audio continuity QA (IN PROGRESS)

Testing production call between disposable owner/partner accounts. Verify normal-to-compatibility
and back, available output changes, microphone continuity and hangup cleanup. Do not treat a
Connected badge alone as proof of transmitted or audible microphone sound.

### 2026-11-14 — Free PWA audio-routing workaround (IMPLEMENTED AND DEPLOYED; phone QA pending)


User explicitly wants to stay PWA and avoid native/store costs. Implemented opt-in compatibility
playback using AudioContext.setSinkId when present; otherwise local Web Audio MediaStream into
the existing element route. Runtime detection, real enumerated output IDs, Refresh outputs,
Use normal audio recovery, bounded waits, hangup cancellation and no peer/microphone stops.
Normal supported element playback remains default. The original 37 focused tests passed; the
audio-router suite now has 10 passing lifecycle tests including late fallback after hangup
(38 focused cases total). TypeScript,
targeted ESLint and production build passed (80 traces, largest 26.82 MiB). Review found a
notification focus-event race before React rerenders; use a synchronous operation ref instead
of a captured busy state so the watcher cannot cancel the just-started enable request. Final
build passed, commit 623f193 pushed, production dpl_6NCt6phSPDnmq82pK4tiTuJXyGoz READY on all
three aliases including mono-kappa-beryl.vercel.app. Physical iPhone/Samsung routing remains
unverified. No app source changes after final build.
Included earlier notification recovery and transient call-sync feedback changes in this release.
No claim that this adds an unexposed phone earpiece or guarantees a physical route change.
My earlier blanket browser impossibility answer was too broad: browser/version capabilities and
WebKit routing bugs matter. User says both phones are latest; Apple lists iOS 27.2.1 on Nov 14;
Samsung official public release-note pages are stale, so no exact current Samsung build asserted.
Use feature detection rather than a version-specific whitelist. Actual phone test still required.

### 2026-11-14 — Store publication versus free personal installation (GUIDANCE)

User asks whether MONO can be published to Play Store or App Store. Explain publication is
possible after native implementation and store review, but ordinary developer accounts cost
Google Play US$25 once and Apple US$99/year (local pricing/taxes vary). Apple's fee waivers
are limited to qualifying organizations, not assumed for this personal app. Direct Android
installation and free temporary iPhone development installation are separate from store
publication. Strict zero-spend constraint remains; no enrollment, purchase or submission made.

### 2026-11-14 — Free native Android and iPhone migration (GUIDANCE)

User asks how to make MONO native on both platforms for free after confirming the browser/PWA
cannot reliably control iPhone built-in speaker/earpiece routing. Recommended reusing the
existing UI/backend with an open-source Capacitor shell and genuine native call/media plugins;
packaging alone does not add routing, screen capture or background call delivery. Next.js server
code remains hosted; a mobile client needs appropriate API/auth integration, not a static export
of server-dependent pages. Android personal installation can use a free signed APK/toolchain.
iPhone free Personal Team testing needs Mac/Xcode and 7-day provisioning renewal; public store
distribution and full background push capabilities are not promised free. TURN/network usage
can have costs even with open-source calling. Mac access remains unanswered. No native build,
paid purchase, new deployment or browser test performed for this guidance. Earlier desktop QA
was stopped by Computer Use URL-verification policy; do not claim screen-share/audibility pass.

### 2026-11-14 — Samsung notification permission recovery (DEPLOYED; physical Samsung QA pending)

User needed manual Samsung permission settings because the internal enable flow did not work.
Fix external settings state reconciliation without re-prompting denied users or cancelling
an active user-initiated enable operation. Preserve explicit subscription opt-in and distinguish
browser permission from device push registration. Show manual recovery/help and accurate local
test notification wording. No claim that OS-level settings can be overridden from the website.
Browser testing explicitly reauthorized. Nine focused permission/audio-output tests and targeted
ESLint passed; production build passed (80 traces, largest 26.82 MiB). During live QA, the
two disposable accounts connected a voice call; Edge offered real system/Realtek outputs and
accepted a speaker selection. Voice-to-video upgrade delivered remote camera video in Chrome.
Physical audibility not yet confirmed. Screen picker is waiting for user consent. Found stale
polling/heartbeat timeout text persisting during a connected call: separate transient sync
feedback from call errors, clear it after successful poll and explain automatic retry.
This does not fix network latency itself. Included in verified production release 623f193.

### 2026-11-14 — Resume live QA and require working phone audio routing (IN PROGRESS)

User supersedes earlier browser pause and explicitly wants working audio switching.
Current PWA already calls setSinkId on actual browser-provided outputs. Native Android
AudioManager and iPhone AVAudioSession are needed where built-in routes are not exposed.
Asked for existing Mac/Xcode access before promising zero-cost iPhone installation; no answer
yet and no native artifact built. Do not report desktop output selection as phone routing proof.

### 2026-11-14 — Free native calling feasibility (ANSWERED; implementation not started)

User requires zero cost for Samsung/iPhone speaker switching and whole-device sharing.
Checked official Android MediaProjection/AudioManager, Google limited distribution,
Apple audio routing/ScreenCaptureKit and account membership docs, and WebRTC TURN guidance.
Native integration is the path to phone-level controls; a web wrapper alone does not supply
the native call/capture implementation. Android private testing/distribution has a free route.
Apple free Xcode Personal Team profiles expire after 7 days; do not promise full native
capabilities, permanent installs, App Store distribution or unlimited relay use for free.
No browser operation, account purchase, deployment or source-code change for this discussion.

### 2026-11-14 — Publish call controls and iPhone typing fix (DONE; device QA pending)

User authorized code/research/publish but explicitly prohibited browser testing. Referenced
WhatsApp's official calling pages for full-stage media, circular controls and prominent
red/green buttons. Added browser-exposed audio output selection, Fit/Fill and screen-sharing
capability/error/paused/ended feedback without inventing phone speaker routes or overriding
capture restrictions. Samsung missing capture support is distinct from notification permission;
iPhone capture source/lifecycle remains controlled by the OS/browser. docs/mobile-calling.md
records constraints and device test steps. Fixed duplicate page focus scrolling for fixed chat,
extra keyboard body padding and inherited scroll margin; two shifted-viewport regressions pass.

All 35 focused Node tests, TypeScript, targeted ESLint and production build pass. Synced
concurrent main changes through 520f4f4, preserving the storage reduction. npm ci initially
failed from sandbox permissions/disk exhaustion; removed only this workspace's generated
.next cache/output, then exact-lockfile install and merged build succeeded. Size guard:
80 traces, largest 26.82 MiB, summed 529.13 MiB, unique 29.13 MiB. No source or QA data removed.
Published 7d18288ae370b0e7675bb4ddb9e8101d71ea2c30; Vercel deployment
dpl_d5hRLNswijv4znpi8frUtB9TEQiA READY with all three canonical aliases verified via API.
Own merge stash removed after successful push; pre-existing stash retained. No desktop/browser
operation, browser automated test or live call performed. User will test actual phones.

### 2026-11-14 — Smaller runtime functions and deployment growth guards (DONE)

- Initial isolated checkout used c0b1754; synced published calling/layout changes through
  3dbceb3 without modifying the original workspace. Prisma Client/CLI/adapter pinned6.19.3,
  Rust-free client enabled, bounded pg pool preserves URL cap/timeout/schema and verifies
  remote TLS. Existing serialization/deadlock and duplicate-name handlers support both
  engines' metadata; first6 integration incompatibilities corrected, all174 now pass.
- Explicitly trace the1.95MB WASM compiler; verified the compiled production health handler
  queries isolated PostgreSQL using only its171 packaged trace files. No native query engine
  remains in any runtime trace. Required Sharp/image processing and private R2 storage stay.
- Both production build paths use the tested Next Webpack builder and enforce45MiB per
  route/2GiB summed trace budgets, compiler presence and no private test/storage files.
  Documentation-only builds skip against Vercel's last successful SHA; missing history,
  runtime changes, same SHA and force builds continue. No paid service or SQL migration.
- Successful local production build:80 traces,28,115,928bytes largest,555,070,990bytes summed,
  30,964,710bytes unique. Native baseline copy49,560,760bytes unique:37.5% reduction.
  Counts are local trace measurements, not Vercel billing totals or sums of dashboard rows.
-492 unit tests and lint pass. Browser login, session/ownership guards, real Sharp upload,
  archive privacy/export/approval/restore/media/replay checks pass. Broader state-navigation
  and plan-edit suites fail identically against the baseline native-engine build; no app
  assertions weakened. Account harness now waits despite polling, retries only interrupted
  GET reads and emulates offline networking on its own worker/profile.11 production-build
  online account checks pass, including password change/reset, deletion and all-device
  revocation. Corrected offline-worker test also fails on the unchanged native build at
  the same assertion; do not report the whole browser suite as green. Temporary cache
  overrides are removed; local disk/OOM
  interruptions did not affect production. Free limits are shared and historical GB-month
  readings remain after deletions; documentation explains retention and manual cleanup.
- Published1e7a24f77da9e2e255916bd1021d53603c90a52f from the isolated branch onto current
  main, preserving3dbceb3. Vercel dpl_9PzErxQqAcph8654aBNkdMRyF9aF READY; Linux build
  size gate passes:80 traces,44.51MiB largest,599.48MiB summed,46.66MiB unique. Actual
  Resources accessibility view reports75 functions, common API bundles20MB (formerly52.3MB)
  and page bundles20.9MB (formerly53.2MB): approximately62% smaller packaged resources.
  Canonical health200/database up proves remote TLS/database execution; home/login200 and
  anonymous account sessions401. No production fixture data or billing change. Both local
  browser DBs verified0 users/0 couples and owned PostgreSQL55463 stopped. Original source
  workspace was clean at its last read and was never modified. Additional cleanup was
  inspected but not executed in this release; older deployments remain subject to the
  previously saved retention policy. Do not claim the historic10.25GB meter is erased.

### 2026-11-14 — Responsive layout, mobile keyboard and audio audit (IN PROGRESS)

Latest authorization: work on code/research and publish, but do NOT use a browser for testing.
User will test themselves. They reiterate WhatsApp UI reference and report iPhone typing
moving messages above the viewport while Android works. Implemented a full-stage call layout,
icon controls, real audio output picker/fallback, Fit/Fill, screen capability/error/pause/end
messages. Screen capture cannot exceed OS/browser limits. Removed generic focus page nudge
for fixed chat and body keyboard padding there; cleared inherited composer scroll margin.
35 focused Node tests pass; TypeScript/targeted lint pass. No browser operation performed.
Merged current main through 520f4f4 (function-storage work retained), reinstalled the exact
lockfile, reran all 35 focused tests and built successfully with size guards. Initial install
hit disk exhaustion; only this workspace's generated .next cache/output was removed, then
install/build succeeded. No source or QA fixture data removed. Published 7d18288; production
READY (dpl_d5hRLNswijv4znpi8frUtB9TEQiA). Physical QA remains pending with the user.

Follow-up: user explicitly paused our browser testing because another chat is using it;
wait for their resume instruction. Recorded requested WhatsApp-style voice/video controls,
speaker option, full-screen shared content, iPhone capture stopping outside MONO and Samsung
permission/capture issue. No browser actions taken after the stop instruction. No physical
audio/keyboard pass inferred from this feedback.

User requests full responsiveness and real mobile keyboard/two-way audio confirmation.
Reviewing live QA layouts and viewport/media regressions; requested Android/iPhone user
observations in parallel. Do not claim physical-phone audio from a connected UI alone.

- Fixed and published commit 3dbceb3 (responsive input cap, compact short-height header,
  photo preview in scrollable sheet). Production deployment dpl_2VAbuaJs21NbP8VvDPBD7aYVsj4M
  READY and assigned mono-kappa-beryl.vercel.app. 26 focused tests, TypeScript, ESLint and
  production Webpack build pass.
- Live Edge device emulation: 320x568 / 390x844 portrait, 390x300 short viewport,
  844x390 landscape and 768x1024 tablet checked. Former 844x190 multiline-draft failure
  retested on deployed fix: composer and Send visible, also with expanded tools.
- Cleared unsent QA draft; no messages/photos sent. Receiving Chrome QA page refreshed.
  Edge microphone readiness check succeeded before sending a call. No call connection
  or voice-to-video upgrade completed in this audit; setup is still open in Edge.
- Desktop helper repeatedly reported another active request, with other window activity.
  Pending user clarification about competing desktop use. Remaining live broader-page,
  photo-sheet and call checks, browser emulation cleanup, and physical phone keyboard/audio
  verification are not marked complete. Existing disposable QA accounts retained.

### 2026-11-14 — Full-screen chat and calls (DONE)

User explicitly authorized this UI redesign for mobile PWA and laptops. Chat now owns the
viewport, with compact partner header, fixed composer, smaller content-width bubbles and
reduced message gaps. Games/scores retain their own scrolling panels. Calls use a full-screen
modal variant, large video stage, floating self-preview and persistent bottom controls.
Existing journal pages keep their navigation. TypeScript, targeted lint and production build
pass (first sandboxed build failed to create .next directories; escalated retry passed).
Local authentication blocked by unavailable Neon TCP connection; use deployed QA session
for visual review. No database changes, new dependencies or message writes.
Live visual review found/fixed the AppTemplate wrapper height and video placeholder contrast.
Final ce81431 deployment READY; desktop and 200% narrow-layout chat/composer verified, plus
full-screen outgoing video/self-preview/controls. No claim of new physical-phone media QA.

### 2026-11-14 — Permission-first setup and incoming-call push (IN PROGRESS)
- User prioritizes setup before ringing and Android/iPhone notifications while installed app
  is closed/phone locked. Chose “Max you can do”; deliver supported PWA capability honestly.
- Existing caller already waits for media before start POST; receiver first-use permission
  and outgoing preview before permission caused confusion. Add explicit setup and remove
  early preview. Verify short expiry, membership, opt-in and stale-call handling for push.

### 2026-11-14 — Both-partner edits to expenses, revealed reviews and memories

**DONE.** User explicitly chose to allow each author to edit their own revealed review.
Added Edit my review / Save changes, shared-state copy, author-scoped updates that preserve
submitted timestamps, and rejection of shared-to-private draft/reopen/discard operations.
Live expense amounts/splits/totals and memory text edits sync without reload in Chromium
and WebKit phone/PWA profiles. Memory heart toggles reproduced a missing partner refresh;
now the atomic favourite write also changes the couple revision. 171 PostgreSQL regression
tests, 16 review unit tests and targeted lint pass. Local Webpack production build passed
after the Windows Turbopack CSS subprocess failed. Vercel's production build passed for
`ccfca96da7ce51b1c35300d618947cd062d3a5d8`, deployment `dpl_DtbvjtUiTK53czEUr3eiAZWrWqgB`.
Live post-deploy edits passed all 22 checks per engine, including invalid review rejection,
updated expense totals/splits, memory covers/hearts/list updates and same-document sync.
SQL read-back confirms author-specific scores/reflections and original submitted timestamps.
Error/fatal production logs empty. Retained all synthetic records; no existing user data changed.
Automated phone/PWA profiles only; no physical iPhone or installed-device claim.

### 2026-11-14 — Live call follow-up (IN PROGRESS)
- Resumed at user request; verified incoming pickup/decline UI in Edge InPrivate from Chrome
  Incognito on production. Ringing expired before answer, incorrectly showing a network error.
- User requests automatic song ringing plus green/red pickup/end controls. Browser autoplay
  restriction is observed, not hypothetical; do not promise forced audio or closed-app ringing.

- **2026-11-14 — IN PROGRESS: actual live voice/video/screen and both-end ringtone test.**
  Rechecked Windows browser control after the earlier URL-policy block; Chrome accessibility
  is now readable. Proceed with isolated test users, explicit capture and careful cleanup.
  Both existing QA partners logged in through Chrome Incognito/Edge InPrivate. Browser
  automation then stopped again because it could not determine the current URL with enough
  confidence. Stopped UI input immediately; actual call/video/share/song remain untested.
  Test windows/sessions retained for continuation; original real user browser session untouched.

### 2026-11-14 — Completion, expenses, reviews and memory live audit

**DONE.** Full live flow verified on retained synthetic dates. Fixed currency prefixes and
saved memory cards; deployed dbe5936 and passed all four partner/engine read-back profiles.
No existing user data changed. Keep synthetic test records. Build and targeted lint passed.

- **2026-11-14 — DONE: publish chat and games, song ringtone and expanded calls; live APIs verified.**
  User supplied Anywhere With You (1).mp3.mpeg, requested it for both ringing ends, then added
  voice-to-video conversion and screen sharing. Published 9b571a9 to existing MONO production;
  build/migration READY, all 24 game API paths and call upgrades verified in separate QA
  spaces. Song served byte-for-byte with range support. Device/browser testing remains
  pending because Windows browser automation's URL safety check stopped the run. No real
  mic/camera/screen was captured. Local direct DB access failed; connected Neon provisioned
  only dedicated fixtures, then live normal login produced valid revocable sessions.
  Test sessions revoked and QA password login disabled; fixture rows retained for review.

### 2026-11-14 — Full live multiple-event flow for both partners

**DONE.** Tested production login/planning/start/photos in Chromium phone/PWA and WebKit
PWA/phone profiles. All functional steps passed; real SQL persistence verified. No code fix
or redeployment required. User chose to retain synthetic test records. Report saved at
docs/reports/live-events-2026-11-14.md; test navigation limitations are recorded explicitly.

Additional steering in this task: user confirmed multiple venue/time events inside one day,
requested ongoing-date photo access in Memories and automatic partner state updates, and
asked for a two-hour editable time default plus validation at every Continue step. These
are included in the current isolated fix, alongside all upload types and first-date recreation.

### 2026-11-14 — Fix all image uploads and recreate-first-date scheduling

**DONE — published aa28a06; production deployment READY.** Fixed the
shared production local-disk misconfiguration with a scoped private bucket on the existing
Neon Free plan, plus image compression/request-size errors and upload-queue refresh timing.
Implemented independent venue/time events, required per-step validation, editable two-hour
defaults, ongoing-date Memories galleries, five-second visible partner synchronization and
server-authorized first-date recreation with only schedule edits. No migration/dependency,
paid plan, autopay, production user-data mutation or unrelated root-file edit. All 415 unit
and 134 isolated DB integration tests, full ESLint, TypeScript and production build passed.
Authenticated browser checks verify source preservation and real private storage. WebKit
runner needed its loopback-only HTTPS-upgrade override applied to the worker response as
well as HTML; production HTTPS policy remains unchanged. All 14 final browser checks passed
with zero JavaScript errors. Live public HTTPS checks also passed in Safari-style and PWA
profiles with zero request/JS errors, active mono-v5 workers, healthy DB, and guarded update/
upload endpoints. Production error/fatal log query found no entries in the test window.
Own private test objects, dedicated local DB/storage and temporary credentials were cleaned.
Physical iPhone checks are excluded. See docs/testing.md for coverage and deployment ID.


### 2026-11-14 — Automated iOS keyboard and landscape remediation

**DONE.** User requests Safari and installed-PWA keyboard/landscape checks, fixes,
same design and deployment. Inventory showed no connected iPhone; user selected automated
checks only. Continue independently with WebKit and explicit synthetic viewport/safe-area
profiles, preserving a clear distinction from physical iOS/Safari. Initial inspection:
viewport manager does not expose visual viewport offsetTop to fixed overlays, compares
focused elements against height without offset, and may treat pinch zoom as a keyboard;
layout/header/nav/viewer side-safe-area coverage is incomplete. Manifest currently requests
portrait orientation. Baseline confirmed pinch zoom wrongly set keyboard mode and a
confirmation field at 652px behind the simulated 430px visible edge. Fixed shifted viewport
edges, nested/page focus scroll room, notch/home-indicator safe areas, short dialog overflow,
sheet focus preservation and manifest orientation/cache version. All eight WebKit/Chromium browser/PWA and light/dark contexts
passed 300 checks with no page errors, and 25 tablet/desktop public-page samples passed.
After preserving newly published 81694ed, all 27 targeted WebKit/PWA checks passed again
against the merged optimized build with retained-focus assertions. All 404 unit tests,
full ESLint, TypeScript and the production build passed. The worker activation test was
updated to verify both v3 caches retire and v4 caches remain. Release e14197b pushed successfully; production deployment dpl_7iFGQchx2u3B6tvthNRrCsodStwt
is READY and aliases the canonical site. All 17 read-only live WebKit/worker/offline checks
passed, including the v4 cached manifest orientation and online recovery. Error/fatal logs
were empty in the checked window. Dedicated local synthetic database and storage removed.
No native device QA is claimed.
No product credentials/dependencies or production test accounts required.


- **2026-11-14 — DONE locally: private chat, classic Ludo and 20+ games.** User approves chat,
  chooses four tokens each for Ludo and explicitly requests at least 20 playable games.
  Delivered all 24 with saved W/L/D, private text/image/sticker/emoji chat and WebRTC call
  implementation. 432 unit/164 isolated integration tests, full lint/TypeScript/build pass;
  two-account right-panel QA covers invites, messages, private images, turns, staged Ludo
  scoring/reload, chess/memory/dice and call cancel. No mic/camera grant or real-device media
  claim. Local preview remains available; no commit/push/deploy or production migration.
  See Done entry and docs/chat-and-games.md for limits, screenshots and retained local fixture.

- **2026-11-14 — DONE: fix discovery and save semantics.** User screenshots show
  a location timeout and Explore showing the QA-saved Jaipur café. Explain the fixture source,
  make discovery searchable beyond saved places, improve location fallback, and create a date
  only on explicit Save. Implemented separate SOCIAL branches, source-matched photos and
  addresses, shared city/location/radius controls, and atomic idempotent explicit Save. Local
  browser and SQL verified no premature records and exactly one final save. 396 unit/130
  distinct DB cases, targeted regressions, full lint and TypeScript passed. Rebased the release
  onto newer responsive-photo commits, preserved both implementations, and rebuilt successfully.
  Pushed 81694ed3f68aeb9d96daa5978f3c16f70f291a48; Vercel READY in sin1, build 54 seconds,
  nullable migration applied. Live Explore/picker passed 5 km versus 20 km branch counts,
  source photos and addresses; exact matching removed the unrelated store. Live new-plan
  navigation reached Review with the same five pre-existing draft IDs/versions in SQL.
  Health 200/database up; deployment error/fatal logs empty. Local cluster removed. Screenshot
  .postgres-test/social-radius-live-81694ed.png. Real device GPS not acquired; chat deferred.

- **2026-11-14 — DONE: publish/deploy filters and live test.** Published a95439b, then
  7554357 with the live-discovered All correction and user's requested Use my location option.
  Final production deployment READY; migration applied. All 511 automated tests, TypeScript,
  full lint, local production build and Vercel build passed. Live category/city, All, synthetic
  nearby, selection, activity and save/reopen checks passed; existing draft unchanged. QA data
  retained for review. Native GPS permission remains a device check; no real location acquired.

### 2026-11-14 — Fix responsive photo captions and viewer contrast

**DONE.** User authorizes all three fixes, same design, viewport verification and
production deployment. Started from production 5bd1a57; synced the separately published a95439b plan-category update before release. Caption
overlays now participate in a single-cell grid; a ratio spacer retains existing dimensions
when text fits, while long captions can expand the photo area. Image layers fill that area;
typography, spacing, gradients, rounded corners and controls remain. Both lightboxes use a
dedicated fixed dark backdrop token instead of the theme-changing ink color. No schema,
credentials or dependencies changed; unrelated primary-workspace changes remain separate.
All 816 focused authenticated local screen/viewport samples pass across the 25 configurations
(320–3840px, breakpoint boundaries and landscape), two themes and browser/standalone-PWA
emulation: original long captions, maximum-length date/memory/venue text, photo and fallback
heroes, short-content ratio preservation, image fill, both viewer backgrounds/contrast and
visible close controls. No clipping, horizontal overflow or uncaught browser errors found.
Screenshots reviewed at 320px and larger sizes. Full lint and final combined production
build/TypeScript passed. Synced the separately published a95439b and 7554357 plan-category
and nearby-search releases; no changes overlap the five verified photo UI files. The
post-sync focused regression run passed 144 additional samples across 320/360/768/1440px,
both themes and browser/PWA modes. Published 3a2332b73dc2b0efe468fd74a294813c8615d156
to origin main. Vercel deployment dpl_5n2nZMZvj9ENNMX3Y4dA5ugSothY is READY on
mono-kappa-beryl.vercel.app (sin1, Next.js 16.3.4, build about 55 seconds). All 100 live
stylesheet samples pass in both themes and browser/PWA emulation, confirming the deployed
backdrop stays dark across all 25 main viewport configurations. Health 200/database up;
no error/fatal logs found for the new deployment. Authenticated hero/viewer checks used
local synthetic accounts; live checks submitted no forms and changed no accounts. Local
synthetic database, generated photo storage and server log removed; servers and idle test
cluster stopped. Copied env was never needed; own published-change backup stash removed.
Physical native-device QA remains distinct from browser/PWA emulation.

### 2026-11-14 — Whole-site responsive layout audit

**DONE.** User asks to check the complete site, clarified every screen size. Audited production 5bd1a57 (sin1); final live-alias inspection confirmed the same version. Isolated codex/mobile-layout-audit preserves unrelated primary work. 25 main viewport configurations cover 320–3840px, responsive breakpoint boundaries, phones/tablets/desktops/ultrawide/4K and landscape. Recorded 1,971 samples: 290 public live; 1,593 main local synthetic-data samples across 67 named states; 88 focused samples across 11 additional variants. Checked all page groups, seven settings subpages, all planning steps and date statuses, populated and empty histories, galleries/details, review/recap/memory editors, onboarding/invitations/unverified gates, confirmation/modal/sheet/menu/photo viewer, standalone/PWA, desktop pointer/light theme and archive file preview (without approvals or restore). No measured horizontal page overflow, clipped control labels, unexpected primary-nav blockers or uncaught browser errors. Confirmed two real clipping defects: DateResult's fixed 2:1 hero clips the result label and long title at 320px (label still clipped at 360px), and MemoryDetailView's fixed 3:2 hero clips the ordinal at 320px. Narrow evidence captures measured the result label 32.5px above its card at 320px and memory ordinal ~5.3px above its card. Also observed photo-wall lightbox white controls on a pale background in dark mode; bg-ink/95 changes with the theme while controls stay white (date lightbox shares the pattern). Report: docs/reports/responsive-audit-2026-11-14.md; summary/raw JSON and screenshots retained under .screenshots/responsive-audit-*. No product code changes or deployment made. Physical native-device behavior is outside Chromium/standalone emulation coverage. Authenticated audit used the supported local development server because production deliberately rejects loopback databases. A Turbopack cache panic was avoided using Next's documented --webpack mode; harness waits for hydration/redirect/dismissal settling. Prisma client was made independent in the isolated checkout to avoid another task's generated-schema changes. Normal signed, database-backed local synthetic sessions were used for layout setup after login had already been checked. All temporary synthetic rows/database, private preview/server log and generated image storage removed; servers and idle test cluster stopped. No production accounts changed.


- **2026-11-14 — DONE: all-category plan discovery.** User clarified Café and every other
  category must auto-filter too, then explicitly deferred private couple messaging to the next
  update. Implemented category persistence, title/chip mapping, matching ideas and venue/city
  filtering; fixed the live provider's wrong-city lookup. Right-panel local persistence checks,
  382 unit tests, all 118 integration tests, TypeScript, full lint and production build pass.
  Production unchanged; feature remains local for publication. The earlier live email fixture
  cleanup approval remains pending and its private state was preserved.

- **2026-11-14 — DONE: verification/join loading and live retest.** Published 5bd1a57;
  production READY. Confirmation 305ms, verified check 508ms and join 879ms in the warm
  right-panel test, with real emails and PostgreSQL evidence. Removed refresh/redirect
  waterfalls and bounded confirmation waiting. All 364 unit + 114 integration tests,
  TypeScript, targeted lint and production build passed. Exact disposable-run cleanup was
  requested separately because the Neon connector mandates destructive-SQL approval.

### 2026-11-14 — Live invitation acceptance from new signup — DONE

User explicitly requested live signup → actual verification email → join the invited space,
checking that no “Something went wrong” occurs. Full flow passed through the requested right
panel on bc0bc2c. Actual emails arrived in both isolated inboxes; no database shortcuts marked
accounts verified or joined them. Unverified creation/acceptance and premature status checks
showed the expected popup/feedback. The same original invitation survived registration and
same-tab email confirmation; explicit acceptance reached the connected shared-space setup.
Production PostgreSQL confirmed two verified users, two memberships, one consumed invitation
and one partner-joined notification. No generic error appeared and no production error/fatal
logs were found in the test window. Some browser automation waits elapsed while confirmation
or navigation was still loading; each final outcome was observed rather than counted as failed
or retried blindly. This is a functional pass, not a latency benchmark or inbox-placement promise.

The Neon tool required explicit approval for destructive SQL. After the user approved deleting
this exact run's test data, guarded cleanup removed the two matching users and empty space
atomically; no other member/content/space could pass its guards. Zero test rows remained. Both
temporary inboxes were deleted, and local credentials/verification links removed. Evidence:
.screenshots/live-invite-verification-6475e6cd4a.jpg,
.screenshots/live-invite-connected-6475e6cd4a.jpg and
.postgres-test/live-invite-results-6475e6cd4a.json. Existing real accounts/spaces and app source
were untouched. No additional deployment was needed.

### 2026-11-14 — Publish verified email/invitation and workspace fixes — DONE

User explicitly requested “publish these changes and deploy.” Published the verified workspace
per the project rule. The gate ran npm's build script with Next's supported --webpack option;
no build check was skipped and no compiler configuration changed. Build, TypeScript, lint and
all 357 combined unit tests passed before the successful push.

Preflight preserved published auth/profile validation from 807091f alongside pending-field
guards. The first push was rejected because mobile release c4bef34 arrived during checks;
rebased without overwriting it. Retained mobile AppLink feedback, worker v3 lifecycle,
Singapore region and the default bounded transaction settings, with the email connection
override retained. Updated the service-worker fixture to check both obsolete versions against
the current v3 caches. Pushed 18ee493bf8490c2eb9b016bdeefb45294cd5474c normally to main;
Vercel dpl_A8292GxEwFs2ebenKgqsipEpDt4d is READY on the canonical public alias. Normal hosted
Turbopack compilation passed and reported no pending migrations. HTTP health returned 200 with
database up and sin1 execution; live email-policy copy and right-panel rendering checked. No
error/fatal runtime logs found for this deployment. Live checks created no accounts and sent no
mail. No production data, SMTP credentials, provider settings or schema changed.

### 2026-11-14 — Required verification, invitation recovery and email deliverability audit — DONE locally

Started 2026-11-13 after the user reported confirmation/recovery mail in Spam and failed partner
connections. Production logs established P2028 transaction expiration for invitation and code joins.
Implemented locked server enforcement, theme-matched verification popup and explicit status/resend,
account-bound invitation navigation recovery, and longer bounded atomic connection transactions.
The full new-account invitation flow was observed in the requested right-panel browser; SQL verified
the resulting membership and notification counts. Tests: 346 unit, 113 local PostgreSQL, TypeScript,
lint, and supported Webpack production build pass. Local default Turbopack build has a CSS-worker
startup failure; do not claim it passed or that this work was deployed. Existing unrelated dirty
workspace changes were retained. Temporary local database, raw fixture email logs and server cleaned.

Checked all three actual received email types and Brevo sender/domain settings. All three pass
authentication through Brevo's automatic brevosend.com sender replacement; Brevo has only Gmail
senders and no authenticated custom domain. The user confirmed no owned domain beyond vercel.app.
No universal inbox-delivery promise is possible, and failed authentication was not established as
the reason for reported spam placement. Sender, SMTP credentials, global tracking and billing were
left unchanged. See docs/account-email.md and docs/testing.md for evidence and limits.

- **2026-11-13 — State-machine audit and remediation — DONE.** Audited and remediated
  domain, browser and worker workflows; central transition models and guards now own the
  complex flows, while existing valid explicit models and independent controls are retained.
  Added regression tests and inventory; verified 338 unit tests, 107 database tests, 79 browser
  checks, lint, TypeScript and production build. Fixed Windows test-server socket release and
  cross-suite fixture-name collisions. All changes remain local and uncommitted; no production
  data or configuration changed. Disposable local database cluster and fixture logs removed.

### 2026-11-13 — Mobile responsiveness and repeated taps

**DONE 2026-11-14.** User reports all-site slow/repeated taps, confirmed in phone browser and installed PWA. Investigated live errors, mobile touch/keyboard handling, navigation feedback, background server-action queue and database round trips. Previous production showed P2028 transaction failures in invitation/connect actions; background reminder poller invoked a serialized Server Action on every application mount. Worked in isolated codex/mobile-responsiveness; unrelated state-machine changes in primary workspace remain separate.

Implemented Singapore function region beside the Singapore database (was iad1; warm public reads ~1.4s, cold health ~4.5s), bounded 15s transactions without retrying unknown P2028 outcomes, request-local onboarding deduplication, authenticated same-origin HTTP reminder/activity polling outside the foreground action queue, navigation progress, touch manipulation and stale keyboard-scroll cancellation. Reproduced and fixed invisible PWA-update-banner padding intercepting bottom navigation; closing overlays become inert immediately. Worker v3 waits for explicit Refresh when replacing an installed worker. Existing visual style, field validity gates and isolation remain. 328 unit tests, full lint, production build/TypeScript, 100 PostgreSQL integration tests (including a successful 5.2s transaction) and nine authenticated mobile-touch journey checks pass. The journey verifies foreground Save while polling is held, all primary tabs, profile save, creation/invitation/acceptance, 320px and no browser errors. Remaining local Home tap issue was Next dev toolbar interception; test-only CSS excludes that development overlay. Two closing-overlay touch checks and eight local plus eight live browser/emulated-PWA public checks pass. Three real service-worker lifecycle checks confirm first claim preserves signup drafts and scrubbed verification tokens, and replacement waits for Refresh and reloads once. User said Continue on 2026-11-14. Published 141ab3ce45898edba6e361c211036e54c0c0ecdc to origin main; Vercel deployment dpl_3rdtCQ19ZMDiN716baxG4ZdzU1JB is READY on mono-kappa-beryl.vercel.app, build about 68s. Live headers confirm sin1; sampled public reads 1063ms first, then 158/426/426ms (warm median 426ms vs baseline 1402ms, about 70% lower in this small sample). Health 200/database up, no new-deployment error/fatal logs found; no external drains configured. Screenshots reviewed. No production records changed. Local test database and private fixture/env/logs cleaned up, idle local cluster stopped. Physical-device confirmation remains distinct from automated touch/standalone emulation.

### 2026-11-13 — Disable invalid profile-name saves

**DONE.** User requests profile Save changes disabled until the name is valid and available, same design, deployed. Reuse UniqueNameField's validity callback, keep save disabled while checking/taken/unavailable/invalid, prevent invalid Enter/requestSubmit, and dismiss stale form feedback on edits. Existing server uniqueness and authenticated self-exclusion remain. Isolated codex/valid-profile-submit preserves unrelated unfinished workspace changes. No production profile edits or migrations required. All 317 unit tests, lint and nine authenticated local browser checks pass: initial/self availability, whitespace, pending, exact duplicates/case variants, stale replies, unavailable checks, server duplicate rejection with recovery, successful local save/reload and 320px layout. Invalid Enter/requestSubmit and existing pending state verified. Only local synthetic profiles were saved; production data untouched. Local database, private fixtures/log and server cleaned up. Final production build/TypeScript passed; published 9696b8d52e9d45de693adc3285054a749694a35e to origin main. Vercel deployment dpl_5pYYQMm8xoeWJpKGySBfQhktCLFz is READY on mono-kappa-beryl.vercel.app. Live health 200/database up and no deployment error logs found. Authenticated UI was verified against local synthetic accounts; no production profile or account was modified. Copied checkout env removed; unrelated workspace changes preserved.

### 2026-11-13 — Disable invalid password updates

**DONE.** User requests disabled Update password on reset and settings until all required fields are valid and passwords match, same design, deployed. Reuse useFormValidity with resetPasswordSchema/changePasswordSchema. Preserve current-password requirement in settings, six-character/72-byte policy, pending controls and server enforcement; block invalid programmatic submission and clear stale feedback on edits. Isolated codex/valid-password-submit branch preserves unrelated unfinished workspace changes. No production account, credential or migration changes required. All 317 unit tests, full lint and ten local browser checks pass, including authenticated settings, current-password requirement, live mismatch/byte-boundary/cleared-field validation, native input events, invalid-submit guards, pending fieldset/button disable and retry after a mocked failure. No password updates were sent to the server. Phone screenshots reviewed. Local server, synthetic database and private fixtures/log cleaned up. Final production build/TypeScript passed; published acf0680c47ea94938baee3be47da7f533d417a46 to origin main. Vercel deployment dpl_9xtaqG5TGwDss7AYDEgbYNy4SbVA is READY on mono-kappa-beryl.vercel.app. All five live public reset checks pass without submissions or browser errors; authenticated settings verified locally with an intercepted update. Live health 200/database up; no deployment error logs found. Copied checkout env removed. No real password or production account was changed.

### 2026-11-13 — Disable invalid authentication submissions

**DONE.** User requests disabled signup/login/recovery buttons until all required fields are valid, same design, deployed. Use existing server schemas for client form validity, confirm registration name/email availability, invalidate pending checks immediately on edits, and prevent invalid Enter/requestSubmit submissions. Preserve existing pending-button behavior and server validation. Continue in isolated codex/valid-auth-submit checkout; unrelated unfinished primary-workspace changes remain separate. No backend, migration or credential changes. Implemented shared schema-based form validity with hydration/native-input checks, immediate availability invalidation, strict confirmed availability for registration, inline outage retry guidance and invalid-submit guards. All 317 unit tests, lint, production build/TypeScript and ten local browser checks pass. Verified empty/invalid fields, password mismatch and bcrypt bytes, pending/registered/unavailable checks, case-equivalent edits, native input events, Enter/requestSubmit blocking and 320px layouts. Local production server stopped; tests created no accounts and sent no auth requests. Published c45875a4802c0079cb753ee1388085f3cc6f4550 to origin main. Production Vercel deployment dpl_DWVT1NgFp4RvYDNCcBuWZNmC3HRX is READY on mono-kappa-beryl.vercel.app. All ten live read-only browser checks pass, with no authentication submissions, account changes or browser errors. Real registered-email lookup blocks signup as intended; simulated outage and delayed responses also preserve disabled state. Live 320px screenshots reviewed. Health 200/database up; no deployment error logs found. Copied env and local server log removed; unrelated workspace changes remain untouched.

### 2026-11-13 — Login and recovery live email validation

**DONE.** User requests live invalid-email feedback on login and forgot password, same design, deployed. Added shared format-only email field using the existing schema/primitives, preserving credential and recovery response privacy. Clear stale submission feedback when edited and retain field values after rejected actions. Existing workspace has unrelated unfinished state-machine changes, so implementation/testing/publication use codex/live-login-email in .postgres-test/login-email-worktree based on the published af806a1. No database, migration, delivery or credential changes needed. All 317 unit tests, full lint, production build/TypeScript and eight local production-browser checks pass. Red borders verified during focus/hover, accessible inline message placement, valid/empty edits, rejected-action retention and correction, 320px layouts, zero account-availability queries and zero browser errors. Phone screenshots reviewed. Local server stopped; no database writes or email sends occurred. Initial dependency-junction build restriction resolved with real dependency directories in the isolated checkout. Published 37ddd78587feb52966aae2037ccfb285ca34650b to origin main from the isolated branch. Vercel deployment dpl_3otsg6xZ5g9YnCb9g9pRKZQskFFJ is READY on mono-kappa-beryl.vercel.app. All six live read-only browser checks pass with no submissions, availability queries or browser errors. Health 200/database up and no deployment error logs found. Live 320px screenshots reviewed. Copied checkout env and local test log removed. Unrelated primary-workspace work remains untouched.

### 2026-11-13 — Live registration email validation

**DONE.** User requests live invalid/registered email feedback in the existing design and deployment. Reuse shared email normalization/schema and form primitives. Add a bounded, same-origin, rate-limited POST availability check returning a private boolean; keep addresses out of URL logs. Preserve server-side database uniqueness and give duplicate submissions a structured email field error. No migrations, credentials, billing or production account mutations required. Implemented live syntax checks, 350ms debounced normalized availability, cancellation/stale-response guards, unavailable-check fallback, structured duplicate email errors and dismissal of old submission feedback on edits. All 317 unit tests, 99 PostgreSQL tests and seven isolated browser checks pass. Lint and TypeScript pass; 320px screenshot reviewed. The exact local test database and fixture/log were removed and servers stopped. Final production build passed; pushed 1168c23ffd6420f99ea4506d00097f3aadbda3c5 to origin main. Vercel production deployment dpl_5Z4SsShFq5YeFy1wJx6XRuLHRJp1 is READY at mono-kappa-beryl.vercel.app. All six live read-only browser checks pass, including an existing registered address, case normalization, correction, stale responses, unavailable-check fallback and 320px layout. Health 200/database up; no deployment error logs found. Live checks created no accounts and sent no mail. Completion record updated after verification.

### 2026-11-13 — Live confirmation and exact active-name uniqueness

**DONE.** User requests live validation as either password field changes, and unique
case-sensitive names until account deletion, allowing case variants. Add reusable new-password
fields with immediate mismatch/minimum feedback, a debounced name-availability check backed by
server validation and a partial unique index over active users. Update profile and OAuth paths,
and erase name/nickname during the existing soft-delete transaction. Production duplicate count
is zero (aggregate read only). No existing account names or passwords have been modified.

User explicitly approved a temporary Neon test branch and cleanup. Prepared the unique index
on br-red-field-b3jyxyu2, verified duplicate rejection, case variants and name reuse after
deletion on the production clone, then discarded the prepared migration and deleted that exact
branch. Production schema will be updated by the checked-in Prisma migration at deployment.
Implemented live shared password/confirmation fields, debounced availability, private boolean-only
endpoint, registration/profile race-error handling, OAuth collision-safe initial names and name/
nickname anonymization on account closure. All 310 unit and 97 local PostgreSQL tests pass.
Adjusted generic test fixture names to respect the new invariant. Browser checks caught automatic
form resets clearing fields after rejection; prevent those resets on action forms while keeping
redirects. All nine isolated local browser checks now pass, including case-variant registration,
profile availability, live settings/recovery matching, actual synthetic account deletion and exact
name reuse. The browser harness now uses keyboard edits, accepts the existing unsaved-changes
prompt and scrolls buttons clear of fixed navigation. Lint and TypeScript pass; phone screenshots
reviewed. Temporary local database, private credentials and email logs removed; servers stopped.
The approved Neon test branch is also deleted. Final production build passed; published
48c437e2dc4008eaca4de0f6472a3600fda21fcb to origin main. Vercel deployment
dpl_E6FFtc447rRRteTFjYHhuH2bsnrs is READY on mono-kappa-beryl.vercel.app. Read-only production
inspection confirms the migration applied and the exact-case partial unique index is valid.
Health returns 200/database up. All three live public-form browser checks pass, with no account
creation or submission: live name availability, minimum/mismatch/match feedback as either
password changes and 320px recovery confirmation. No browser errors or deployment error logs
were found. No production account has been changed.

### 2026-11-13 — Six-character passwords and inline feedback

**DONE.** User requests minimum six characters, password strength/category feedback,
red validation borders and messages below the checkbox, followed by fast deployment. Existing
shared validator requires ten plus lowercase/uppercase/number; register/reset controls lack invalid
border wiring. Login has the Remember me checkbox and top-of-form feedback. Implement consistent
six-character server rules, strength guidance/new-password fields, accessible invalid indicators,
Caps Lock warning and bottom login feedback using existing tokens/components. No new checkbox,
account access, integration configuration or live-data changes are required.

Changed shared policy to six-character minimum with character mix as optional strength guidance;
retained bcrypt byte/length bounds and confirmation. Added local strength/checklist feedback for
registration/reset/settings, Caps Lock warnings and accessible invalid-field wiring. Login's
general feedback is now below Remember me; credential errors mark both fields. Fixed invalid
border specificity with aria-invalid variants so normal/hover/focus styles cannot override red.
All 305 unit tests and seven isolated browser checks passed, including actual six-character
registration, settings change/session revocation, reset/new login, strength/Caps Lock, five-character
rejection and 320px layout. The specificity correction will also get a final live computed-color
check. Full lint and TypeScript passed; local DB/private credentials/reset-link logs were removed
and test servers stopped. Final production build, TypeScript and full/targeted lint passed.
Publishing now, followed by a live public-form check without account creation or email sending.
No real accounts were changed.

Published implementation 31c66ba02fc0e0e2582927ba1ba40b098a3429a6 to origin main. Vercel
deployment dpl_CsWrbaEUPQ2UjEENVGBuYzL7rUVD is READY at mono-kappa-beryl.vercel.app. Three
live public-form checks passed: actual red computed border during hover/focus and feedback below
Remember me, six-character/strength/Caps Lock UI, 320px layout with no browser errors. Reviewed
the final live red-border screenshot. No production account creation or email sending occurred;
the validation probe submitted only malformed empty login fields. Live health is 200/database up.

### 2026-11-13 — Activate IndiaRestros photos

**DONE.** User explicitly requests IndiaRestros first for Indian restaurant/cafe photos,
Commons as fallback and live Vercel deployment, after the provenance limitation was explained.
Proceed under that authorization without asking again. Match public venue name and coordinates
conservatively, label images as IndiaRestros listing photos, retain source links, reject unsafe
URLs/representative placeholders, cache/bound requests and honor upstream limits. No API keys,
account creation, billing or autopay. Existing UI and credentials remain the reference.

Implemented a keyless IndiaRestros adapter and India-first/Commons-miss coordinator. Restricts
categories/region, matches normalized names within 120m with a 50m ambiguity margin, validates
same-listing image URLs and human source links, skips labelled representative images and retains
Cache-Control/backoff in a bounded cache. At most four nearby name groups per batch. Captions
identify listing photos via IndiaRestros without fabricating author/license fields; only its
image origin was added to CSP. Real Photon/IndiaRestros check matched photos for 9 of 12 Delhi
Starbucks results. All 302 unit tests, TypeScript and full lint passed. Local browser photo load
passed; exact saved OSM ID N6957678134/28.6022338,77.1861298 confirmed in the isolated database.
Corrected the browser test to account for provider IDs being absent from portable export;
saved-detail/picker/Commons fallback checks are ongoing. Production accounts/data untouched.

All seven isolated Chromium checks now pass: real Delhi IndiaRestros photos/CSP/credits,
selection/save/reload, saved details with no invented CC license, real Commons fallback for
Le Grand Véfour Paris, 320px picker layout, broken IndiaRestros image placeholder and no browser
errors. Reviewed Explore/detail/picker screenshots. Direct local SQL again confirms the selected
OSM venue identity/coordinates. Local test DB, private password/SQL and test servers cleaned up;
no production fixtures were created. Final production build, TypeScript and full/targeted lint
passed. Publishing the tested integration to the existing MONO production project; no new
environment variables, migrations, API keys, accounts or billing configuration are required.

Published implementation 83ffbc1a41685e34368e1c0a7a729018c1e7c4e6 to origin main. Vercel
deployment dpl_7d7eUddDedK77tUucqQLgbBndnJm is READY on the public production alias. Health
returns 200/database up and the image CSP permits IndiaRestros. Additional real restaurant
check matched Karim's locations in Delhi/Nehru Place/Laxmi Nagar to listing photos. A Bukhara
query returned no relevant Photon venue; it was not assigned an unrelated IndiaRestros image.
No production fixture, account/billing setup or credentials were introduced. The earlier source
audit remains historical context; this explicit user instruction authorizes the chosen provider.

### 2026-11-13 — Broader free India photo source

**DONE (source audit; no verified new provider enabled).** User asks for another source with broader restaurant/cafe photo coverage in
India without billing/autopay. Researching primary docs rather than promising universal free
coverage. Found IndiaRestros' free keyless API claim and photo/provenance fields; checking real
search responses and source-specific photo rights before any integration. No paid account,
payment mandate, new credentials or production data changes are authorized or needed for research.

Primary docs confirm Foursquare photos are paid Premium, TomTom Photos are unavailable in free
evaluation/PAYG, and Flickr only lets Pro accounts request new API keys. Mapillary and KartaView
offer free street imagery, but this does not establish actual venue/indoor gallery coverage.
IndiaRestros' keyless search returned 200 with three Delhi Starbucks branches and photos; exact
detail IRR-8SPCQG2J88 matched 28.602234,77.18613. Its photo provenance is Swiggy/Magicpin/Zomato,
including Zomato chain photos reused across branch results. No reusable license/photographer
fields appear. Published /sources says external-platform photos are not republished, creating an
unresolved discrepancy with the actual API. /terms permits personal/commercial API use but does
not explicitly resolve those third-party photo rights. Do not claim unlawful conduct or universal
absence of a free provider; state that a qualified source was not verified. No provider enabled,
account created, payment approved, app code changed or redeployment made for this audit. Existing
Commons integration remains available. User/restaurant-supplied photos are a practical additional
source; street imagery would need to be clearly labelled rather than presented as venue photos.

### 2026-11-13 — Free restaurant/cafe photos

**DONE.** User asks for a free photo option without billing/autopay. Commons offers
reusable licensed images with attribution; Wikidata exposes exact OSM node/way/relation links.
One bounded real read-only query returned three restaurant photos with OSM node IDs. Implement
exact-ID matching, safe Commons thumbnails/credits, bounded cache/timeouts and graceful fallback.
Public services are best effort and photo coverage is limited, especially ordinary local venues.

Implemented exact OSM backlink batches with Wikidata P11693/P10689/P402 and Commons metadata.
Only validated Wikimedia thumbnails with complete supported license/author metadata are shown;
credit/source/license/cropping accompany photos. No private couple data is sent or photo metadata
persisted; caches are bounded and errors/backoff are respected. Actual Le Grand Véfour Paris
lookup returned its specific restaurant photo by Zairon, CC BY-SA 4.0. Accommodated Wikimedia's
current thumb.wikimedia.org host and license URLs without trailing slash (verified primary docs).
Added React image fallback; browser caught and fixed pre-hydration errors via a mounted-image
completion check. All 284 unit tests and six isolated Chromium checks pass, including actual
photo loading, exact selection/details, license/source links, 320px credits/picker and failed
image replacement. Reviewed screenshots. Local test DB/private password+SQL removed; production
data untouched in this task. Final full lint, TypeScript and production build passed. Publishing
the tested source to the existing MONO Vercel production project; no environment changes needed.

Published 8c58769992f0c81a5d801750c0bb05f39a83fcf6 to origin main. Vercel deployment
dpl_4MZLtXrVnbKA87YoCYyEg6Way5KC is READY on mono-kappa-beryl.vercel.app. Production health
returns 200/database up, and its CSP permits the current Commons thumbnail host. Authenticated
photo rendering was verified on isolated local data with actual upstream photos; production
fixtures were not recreated. Photo coverage remains partial, with honest placeholder fallback.

### 2026-11-13 — Authorized live venue-selection test

**DONE.** User approved the pending create-and-remove production fixture request. The
current production deployment is READY at 0dde5b1. Prepare fresh random fixture identities and
credentials, execute the real restaurant/cafe browser selection flow and inspect exact persistence.
Cleanup is explicitly authorized for these temporary records; no existing user data is in scope.

Generated fixture 33e5aff0ba62 with two example.invalid users, one active couple and one draft.
All seven live Chromium checks passed, including real Starbucks selection, persisted date reload,
restaurant/city API search, OSM attribution, saved details and Maps link. Browser had no errors.
Production read confirms exact selected node N14046155168 with coordinates 28.5410984, 77.1550259;
mobile venue details screenshot reviewed. Revoked the fixture session, checked two memberships,
one date/one place with no outside memberships, then deleted the exact couple and users in a
transaction. Final counts for fixture users/couple/memberships/dates/places/sessions/notifications
are all zero. Removed private generated password and SQL files; retained only nonsecret audit
identity/results/screenshots in ignored artifacts. No existing user data or code/config changes.

### 2026-11-11 — Free venue-search alternative

**DONE.** User asks to use a real restaurant/cafe search provider without billing or
autopay. Official Geoapify pricing/docs confirm Free supports production with 3,000 credits/day,
5 requests/second, required attribution and no credit card. Its Places API uses OpenStreetMap;
coverage differs and Google ratings/reviews/photos are unavailable. Preparing the adapter and
existing selection flow with attribution, while asking user to add GEOAPIFY_API_KEY directly
to Vercel as a Production Secret. No Google billing mandate or paid subscription is authorized.
User then explicitly said "You can do it all yourself", authorizing the free Geoapify account,
project and key setup as well. Use the browser's existing sign-in context where possible, keep
the key secret and configure only the Free plan; do not enroll in paid billing/autopay.

Browser access failed twice with "failed to write kernel assets ... path specified (os error 3)"
even after reset; native node_repl has the same initialization failure. Read the computer-use
skill/guidance/confirmation docs before attempted access; no UI input occurred. A read-only
TinyFish browser inspection confirmed Geoapify registration has email/password, ToS and
reCAPTCHA; no account was created and email verification after signup remains unknown.
No Geoapify sign-in is recorded in available browser profiles. Rather than requiring user
registration, checked the documented keyless Photon service: official policy permits reasonable
project use but provides no availability guarantees. Actual calls returned Starbucks cafes in
Delhi and reverse lookup returned the exact selected OSM node. Switching the implementation
plan to Photon avoids both signup and billing. Public Overpass policy discourages app backends,
so do not use it; public Nominatim autocomplete is prohibited. No new account or paid service
was created and the Google key remains unused in production.

Implemented keyless Photon provider with named venue searches, category+city reverse queries,
exact OSM object validation on selection, bounded public-result cache and one-second warm-
instance request pacing. No distributed quota guarantee is claimed. Added OSM/Photon attribution
to results, picker and saved details in the existing style, and 500ms search debounce. Google
photo requests are disabled when Photon is selected. Existing saved/custom fallback and Maps
coordinate links remain. Actual provider calls returned Starbucks Delhi, selected its exact
OSM node, and returned Cafe Museo/Cafe Coffee Day for cafes in New Delhi. Corrected category
OR semantics based on Photon docs (comma separated, not repeated include parameters). Sixteen
provider tests plus five photo-route cases pass; preparing complete checks and deployment.

All 270 unit tests and full lint pass. Actual keyless restaurant search returned Mysore Cafe,
Sorento and Baba Ka Dhaba in New Delhi, and exact selection lookup matched the chosen OSM
object. Added a keyless diagnostic and switched the generic Places check to it when Photon is
selected, preventing accidental Google checks. Local .env now changes only PLACE_PROVIDER to
photon; existing credentials are retained but unused. Production PLACE_PROVIDER was updated
from google to photon for the upcoming deployment. No secret, paid service or account is needed.
Added place-selection error feedback using the existing FormFeedback component. Preparing an
isolated live test couple/draft to verify real selection/persistence; actual user data is untouched.

Fresh final production build and TypeScript passed. Implementation c85c51b was pushed to main;
Vercel deployment dpl_5aSrQLGDagg9qb6WVZb5XHjmaVyw is READY with the public production alias
mono-kappa-beryl.vercel.app and PLACE_PROVIDER=photon. The optional production-fixture INSERT
was rejected by automatic approval review because synthetic production data needs explicit
permission when isolated local testing is available. No production test rows were created.
Requested permission to create and remove two generated example.invalid users, one couple and
one draft, while proceeding with the same browser selection flow against isolated local Postgres.

Completed seven authenticated local Chromium checks using actual public Photon results:
fixture login, real Starbucks results at 390px with attribution, choose/save/reload, New Delhi
restaurant search, no Google photo access, saved details with attribution/coordinate Maps link,
and revoked fixture sessions. No browser errors; reviewed both mobile screenshots. Explicit
local database read confirms provider=photon, selected OSM node N14046155168, Starbucks/New Delhi,
latitude 28.5410984 and longitude 77.1550259. The dedicated loopback test database and private
fixture password/SQL files were removed, and Next/test PostgreSQL servers stopped. Production
test records were never inserted. Full live authenticated persistence was not run without the
optional fixture permission; the deployed code/config and public service are verified separately.

### 2026-11-11 — Activate Google Places

**SUPERSEDED by the free Photon activation above.** User requests activation and live deployment, superseding the earlier
credential deferral for this integration. Vercel environment metadata confirms production
has no GOOGLE_PLACES_API_KEY. Reviewing official Google setup/restriction guidance and
preparing the nonsecret production provider flag. The user needs a billing-enabled Google
Cloud project, Places API (New) enabled, and a dedicated server key restricted to that API.
Ask them to enter the secret directly in MONO's Vercel production environment; do not expose,
copy from another project, or request it in chat. No Google billing/resource purchase is made.

Production PLACE_PROVIDER=google was added as a nonsecret flag. Checking MONO's own local .env
with Node's env-file parser revealed an existing nonempty, Google-key-shaped Places key and
PLACE_PROVIDER=google. No key value was printed. Test that existing MONO key before asking the
user for a new one. Removed partial key logging and redacted echoed key values from the Places
diagnostic script before calling the Google endpoint.

The existing MONO key was sent only to Google's intended Places endpoint; Google returned
HTTP 403 PERMISSION_DENIED, "The caller does not have permission." Do not infer a specific
billing/API/restriction cause from that generic response. Production provider flag is prepared,
but no secret has been copied to Vercel and live Google search is not yet activated. User
selected "I need setup help" rather than confirming a working key was added. Provide the exact
Google Cloud billing → Places API (New) → dedicated API-restricted server key → Vercel Production
Secret steps, and continue deployment/verification when the user confirms setup. Updated
DEPLOY.md and the diagnostic (hidden key, redaction, bounded request, structured error reasons).
Seven focused provider/photo tests and diagnostic syntax validation pass. No source release
or redeployment has been made while a working production key is missing. User-facing setup
help covers choosing/creating the Cloud project, linking billing, enabling Places API (New),
creating a dedicated API-restricted server key and saving it as the MONO Production Secret.
Activation remains in progress pending user confirmation; never claim live Google search works
from the prepared provider flag or mocked tests alone.

User reports Google billing setup requests an INR 15,000 autopay mandate. Consulted official
Google Pay India/Cloud Billing guidance: an e-mandate authorizes automatic usage-based charges
up to a limit/frequency; it is not itself a fixed INR 15,000 monthly subscription. Do not assume
the user's unseen screen is not an immediate debit. Asked whether it says maximum/up to versus
pay now, requesting only the non-sensitive label. No mandate, payment, billing upgrade or new
Google request was approved/performed. Google Places activation remains pending user setup;
budget alerts, if discussed, are notifications rather than hard spending caps.

User clarified the UPI app says an automatic payment request "up to 15000", deductions
"anytime", and start/end dates. This identifies a recurring UPI mandate limit/validity window,
not evidence of an immediate INR 15,000 debit or fixed monthly plan. Explain that accepting
permits future automatic usage-related deductions under the mandate and is not a monthly/total
spending cap. User has not authorized the agent to approve the mandate or a payment. Keep
Places activation pending their decision and a working production key; do not treat this
clarification as billing approval.

### 2026-11-11 — Google Maps/Places status audit

**DONE.** User asks whether real restaurant/location selection from Google Maps is integrated.
Reviewed Google Places provider, search service/API, picker and Maps-link UI. The implementation
supports Google listing searches and selection but only instantiates the external provider with
PLACE_PROVIDER=google and a nonempty GOOGLE_PLACES_API_KEY. Authenticated Vercel production
environment metadata (decrypt=false; values not exposed) confirms both keys are absent, so live
search currently uses MONO's saved/custom places. Answer distinguishes implementation from live
activation; no external Google requests, key configuration or production changes were made.

### 2026-11-11 — Complete live authentication flow

**DONE.** Tested the deployed registration → welcome/verification inbox delivery →
explicit confirmation → login/logout → recovery email → password reset → new-password login
story, including one-use links and session invalidation. The previous task verified provider
acceptance but did not open actual inbox links. Preparing an isolated mailbox and fixture;
existing real accounts and credentials must remain unchanged. Use Vercel verification guidance
and read-only Neon evidence; any code fixes will preserve the existing UI.

Read-only live reproduction confirmed first service-worker activation reloads both registration
and verification: an entered name became empty; a scrubbed fragment token vanished from the
confirmation form. Fix captures whether a controller existed when the effect mounted, skips
reload for initial claims and removes its controllerchange listener on cleanup. Added real
browser checks for registration draft/token preservation and exactly one reload on an actual
replacement controller; these run against a production build without database writes.

The isolated Mail.tm inbox received both real welcome and verification emails. A signed-in
production browser requesting `/forgot-password` was redirected to `/onboarding/profile`,
confirming the shared auth guard also blocks the Settings reset link. Recovery now has a public
route group with the unchanged shared AuthShell; login/registration retain their inverse guard.
Successful reset clears the current cookie only after the service succeeds. Expanded browser
account coverage for signed-in recovery and added action success/failure cookie checks.
First-visit checks passed all three cases against a local production build; full live flow
will resume with the isolated fixture after release. Real user credentials remain untouched.

All 253 unit tests and full lint passed. The expanded account browser suite passed 12 checks
including signed-in recovery, actual cookie clearing, other-device invalidation and new-password
login; four local fixture accounts/three spaces were cleaned. Results are in ignored
`.postgres-test/e2e/7e6c4a86191e25f4`. A build initially encountered stale generated dev route types
after moving recovery pages; starting the current local app regenerated the correct route paths.
The fresh final production build and TypeScript checks pass (41 static outputs); the three
first-visit browser checks also pass against this final build, including an update on the same
page after its initial worker claim. The local PostgreSQL server and production test servers
are stopped. Publishing the fixes before resuming the real mailbox flow. No schema migration
or credential change is needed for these fixes.

Published `fc0ea279782c4ffd892f6d387ad51c7e18cd56e8` to `origin main`.
Production deployment `dpl_Bsrig1sNRGLAYJo86TPE8FSSKBHq` is READY; canonical live health returns
HTTP 200 / database up. All three first-visit checks pass against the public production origin.
Using the actual inbox email link in a fresh browser confirmed the address, scrubbed the
fragment, left the visitor signed out and removed the notice for the existing fixture session.
Reusing the verification link failed. Real UI logout, duplicate registration rejection,
incorrect-password feedback, persistent secure/HttpOnly/SameSite cookies and remember-me-off
cookies passed. Signed-in recovery produced a real reset email; an unknown address got the same
generic response. Opening the real reset link signed out changed no sessions, mismatch validation
preserved access, and signed-in submission cleared its cookie and revoked both devices. A
previously opened copy of the consumed reset link was rejected.

The first long browser run timed out at its final onboarding redirect. Independent fresh-browser
login completed the redirect without reload; a focused repeat using a second received recovery
email also completed immediate same-browser new-password login, reload and sign-out. The repeat
first encountered a transient Mail.tm API read failure, then resumed the already-sent email
with bounded retry/token-refresh handling. No additional application defect was reproduced.
Keep the initial failure artifact for an honest audit; do not describe that first runner as
fully green. Final follow-up evidence is in ignored `.postgres-test/live-auth-final-reset-results.json`,
with `passed: true`; first-visit artifacts are in `.postgres-test/first-visit/2026-11-10T19-34-03-866Z`.

Production POST `/forgot-password` SMTP acceptance is logged at 2026-11-10 19:36:11.908 UTC
and 19:43:55.687 UTC; both emails actually arrived in the isolated inbox and were consumed.
Read-only database proof after final sign-out: verified=true, consumed_reset_links=2,
active_test_sessions=0, couple_memberships=0. No real user password, email verification status,
session or data was changed. Requested explicit approval before permanently removing this exact
task-owned test account and its temporary inbox; no destructive SQL was attempted without it.

User approved deletion of the exact isolated test account/inbox. A constrained DELETE matched
its ID, unique test email/name, creation within one hour, no couple and no active sessions and
returned only its fixture ID. Follow-up counts for that ID are zero users, sessions, verification
tokens and reset tokens. Mail.tm accepted removal of the matching inbox, and the ignored private
state file (random passwords, bearer token and email links) was unlinked. Nonsecret identity,
cleanup receipt and test evidence remain under `.postgres-test`; none are committed. No real
account or unrelated resource was removed. Publishing final verification notes.

### 2026-11-10 — Registration welcome and verification emails

**DONE.** Added welcome plus verification email delivery to credential registration,
hashed expiring verification tokens, safe confirmation and resend UI, and regression coverage.
Existing SMTP configuration is live on Vercel; user authorizes this feature's migration and
release. Existing users and onboarding access will remain compatible.

Implemented two MONO HTML/text templates on the shared layout, after-response registration
dispatch, one-minute database resend cooldown, five-outstanding-link bound, replay/expiry/
deleted-user/mailbox-change checks, user-serialized token consumption and account-closure
cleanup. Verification never logs in a user or gates existing account access. `/verify-email`
removes capability fragments from the URL and requires an explicit POST, so scans/prefetches
do not consume a link. Resend feedback is generic. Onboarding and Settings expose the new flow.

Added append-only migration `20261110000000_email_verification`: one token table (current
schema: 27 models, 326 scalar/enum columns, 51 FKs, 17 enums), with no user-row rewrite.
Seven migrations apply from scratch locally. All 251 unit tests, 92 real PostgreSQL cases,
TypeScript and full lint pass. Chromium 157.0.8103.40 passed seven registration checks and ten
existing journey checks; fixtures cleaned. Results/screenshots are in ignored
`.postgres-test/e2e/9d75a3b73a340e90`. Welcome/verification previews fit desktop and 320px.
The local PostgreSQL test server was stopped after verification.

Also tested the exact checked-in migration SQL on an isolated Neon child branch of production:
`br-fancy-shape-b3ox2t8v` / `codex-registration-email-20261110`, with four indexes verified.
Local TCP access to that endpoint failed, so the authenticated Neon connection ran the same
checked-in statements transactionally on the child only. No production rows were queried or
modified in this preflight. The child compute is suspended and the branch expires automatically
at 2026-11-10 14:45 UTC. The Vercel build now uses a migration-only direct Neon connection
(or explicit DIRECT_DATABASE_URL) while preserving the app's runtime URL and credentials;
the existing pooled advisory-lock issue is not bypassed by disabling locks. The final production
build passed (41 static outputs including the dynamic verification route).

Published implementation `75961369cfd75bea10178df9fe247a94043f5acf` to `origin main`.
Vercel production deployment `dpl_2qLDfkfqwVsHs15Fbq6c9M2S5mjq` is READY at
`https://mono-kappa-beryl.vercel.app`; build logs confirm the seventh migration applied.
Live health returned HTTP 200 / database up. The live browser test needed to wait for the
first-visit service worker reload before filling the form; earlier attempts did not register.
A successful new registration redirected to onboarding, sent both messages and had its
temporary session revoked. Production logs show POST `/register` welcome accepted by SMTP
at 2026-11-10 14:21:41.572 UTC, verification at 14:21:45.855 UTC. POST `/verify-email`
accepted verification for the existing user-requested mailbox at 14:22:27.046 UTC. No password
was changed and no real address was automatically verified. Inbox placement is unobserved.

Automatic approval review rejected permanent removal of the task-owned synthetic fixture
because deletion was not explicitly authorized, despite exact ID/plus-alias/name/time,
no-couple and revoked-session predicates. No deletion occurred and no workaround was used.
The user then explicitly approved deletion of that synthetic account. The same constrained
statement returned its exact fixture ID, confirming removal; tokens/session cascade. The real
user's account was not targeted. The nonsecret fixture identity remains in ignored
`.postgres-test/live-registration-fixture.json` for the audit. SMTP secrets and unrelated
integrations remain unchanged.

### 2026-11-10 — Live branded email on Vercel

**DONE.** User authorizes activating email and deploying it, superseding the earlier
deferral of integration keys for this email work. QuestMart and Travel Agent use Nodemailer
SMTP; Travel Agent has a Brevo relay configuration available locally. MONO production currently
has no email or APP_URL configuration. Preparing a MONO template and scoped production email
configuration without exposing credentials or changing the other applications.

Prepared a MONO-specific warm HTML/text password-reset email, escaped all dynamic HTML and
refused unsafe/non-local HTTP links. Kept the existing recovery workflow and added a generic
SMTP acceptance marker without addresses or tokens. All 240 unit tests, TypeScript and email
lint pass. Desktop and 320px previews render without overflow. Verified Brevo STARTTLS and
authentication without sending mail. Configured production-only EMAIL_DRIVER/FROM, SMTP host,
port, TLS mode and sensitive user/password plus APP_URL on the existing MONO Vercel project;
other projects, local .env files, other integrations and database settings are unchanged.
Waiting for the release build before committing/deploying, followed by a real public-origin
password-recovery request to the verified sender mailbox and a production SMTP acceptance check.

Release build passed and `a7407ea` was committed/pushed to `origin main`. Vercel deployment
`dpl_7WxD8YLEHcc81tPECkDbxQB6S8n6` is READY and serves the canonical public origin
`https://mono-kappa-beryl.vercel.app`. Live health returns 200/database up. A real Chrome
password-reset request to the verified sender mailbox returned 200 with no browser errors;
neither an SMTP acceptance nor delivery-failure marker appeared in production logs, so this
does not establish a send for that mailbox (the anti-enumeration response is intentionally
generic). Requested a registered MONO email for the live delivery test. No password was changed.

The user then explicitly requested registration of their supplied Gmail mailbox. Created that
account through the production registration UI as Tushar with a random temporary password
held only in process memory, then revoked its temporary session via the existing sessions API.
Did not choose a lasting user password or complete profile/couple onboarding. The subsequent
live recovery request returned 200 with no browser errors, and Vercel's production logs show
`[email] Password reset accepted by SMTP.` on POST `/forgot-password` at
2026-11-10 13:15:21.605 UTC, deployment `dpl_7WxD8YLEHcc81tPECkDbxQB6S8n6`.
This proves the actual Vercel app/template/provider send path; mailbox placement is not observed.
The account is retained as requested and the temporary browser session is revoked. No test
password, reset token or SMTP credential was printed, written to project files or committed.
The recovery link lets the user select their password within 30 minutes. Local SMTP checks
and template previews passed, as did all 240 unit tests, TypeScript, email lint and release build.
No schema change, other integration activation, or change to QuestMart/Travel Agent was made.

### 2026-11-10 — Publish settings screens

**DONE.** User requested publication of the completed password, session and archive settings
screens. Updated this log and ran a fresh `npm run build` successfully, including TypeScript
and all 40 static outputs. Confirmed local `main` matched `origin/main` at `3fce5ad`, staged
the requested changes, committed `6c026f7` with the required co-author trailer and successfully
pushed to `origin main`. Git confirmed `3fce5ad..6c026f7 main -> main`. Integration keys remain
unchanged. This notes-only follow-up records the successful push. Hosted CI and automatic
deployment completion were not verified during publication.

### 2026-11-10 — Remaining settings screens

**DONE.** Added three protected settings pages using the existing PageHeader, cards, fields,
buttons, alerts, badges and confirmation dialogs. Password changes validate the same strength
rules in client/server and reload sign-in after revoking every device. Google-only accounts
receive recovery guidance. Device management shows only the caller's sessions, identifies this
device, formats timestamps in the couple timezone, refreshes and confirms revocations.

Archive settings downloads the actual portable file with media, blocks unavailable destinations,
previews files locally, obtains independent session-bound approvals and supports copy/paste of
the partner's short-lived code. Changing files clears local consent/codes; expiry allows renewal.
Only the exporter can confirm restore. Server checks, atomic writes, privacy and one-restore/
empty-space restrictions are preserved. Passwords, archives and codes never use draft storage.
Updated account/archive/security/architecture/testing docs and README.

Validation: 237 unit tests (including three archive-preview cases), all 82 real PostgreSQL
cases, TypeScript, full ESLint and final `npm run build` passed. The new `settings` browser
suite passed 13 checks in Chrome/156.0.8078.80; final results and screenshots are in ignored
`.postgres-test/e2e/6ea17f0eba2b2074`. Coverage includes invalid credentials, real device
revocation, download bytes, invalid/tampered files, missing partner consent, cancellation,
restored content/media, repeated restore, offline retry and 320/768/1280px layouts, plus 200%
root text in archive approval. Visually reviewed new screens. The five existing browser suites
were not rerun; they remain registered alongside the new suite. Initial fixture/automation
issues were corrected (completed onboarding, scoped dialog clicks, incognito download policy).
The isolated test database used all six migrations; fixture accounts/spaces/media were cleaned.
The previously stopped local PostgreSQL test server was started for verification and stopped
afterward. No integration keys, application database, live deployment, commit or push changed.

### 2026-11-10 — Codebase completion assessment

**DONE.** Reviewed routes, services, schema, deployment/testing docs, CI, integration
adapters, private-review rules, write conflict protection and offline behavior. Confirmed 26
models, 38 services and six migrations. All 234 unit tests pass on this checkout. Archive restore,
device management and password changes have backend APIs without dedicated settings UI.
Local configuration uses console email and local storage, with no SMTP, Google sign-in or
reminder cron secret configured; Places/push key presence does not verify delivery. No secrets
were printed, providers contacted, or application behavior changed. TypeScript, lint and production
build also passed. Recorded prior evidence covers 82 PostgreSQL cases, 51 Chromium checks and
11 Firefox checks; these and the live deployment were not reverified during this assessment.
The completion estimate is qualitative against the current scope, not a measured acceptance
percentage. Older PWA unchecked entries include already-completed work and should be reconciled
before being used as a current tracker. Existing local memory edits are preserved.

### 2026-11-06 — Email sending status audit

- **DONE.** User asks whether the email sending service works. Inspected the actual transport
  code, local environment presence and Vercel configuration metadata without displaying secrets.
- Local effective environment loads `.env` with `EMAIL_DRIVER=console`; SMTP host/user/password
  are absent. Vercel project metadata lists only DATABASE_URL and AUTH_SECRET, with no EMAIL_*
  or SMTP_* variables and zero hidden production variables. The deployed code therefore uses
  the console default, which writes messages to logs and does not deliver to an inbox.
- SMTP implementation supports authenticated TLS and rejects incomplete configuration or a
  rejected recipient. Password recovery calls the reset template/driver. Targeted Vitest run
  passed 8 tests across SMTP transport and auth service; these mock mail and do not establish
  provider delivery. Configure EMAIL_DRIVER=smtp, a verified EMAIL_FROM, SMTP_HOST, SMTP_USER,
  SMTP_PASSWORD, and provider port/TLS settings, then verify connectivity and actual receipt.
- No test message was sent, no credentials/settings or app/UI code changed, and no deployment
  was triggered for this read-only status inquiry.

### 2026-11-06 — Remaining browser verification and fixes

- **DONE.** User explicitly requests the remaining browser checks and functionality fixes,
  with the existing UI preserved, credentials deferred, continued GitHub pushes and Vercel on.
  Working tree starts clean at `7e8b55a`. Existing baseline: 234 unit / 82 PostgreSQL / 40 Chromium
  browser checks. Firefox is installed locally, so actual second-engine verification is feasible
  without adding a runtime application dependency or using personal browser profiles.
- Added a native Firefox/Chromium compatibility suite and browser selection to the existing
  Puppeteer runner. Firefox 159.0.1 completed 11 checks, including keyboard preferences/planning/
  rating/reveal, streamed redirects, multipart media, private reads, calendar links and PWA caches.
  The new suite uses foreground tabs and native BiDi operations; CDP-only offline/timezone suites
  remain Chromium-specific. CI now runs both engines independently on Ubuntu 24.04.
- Reproduced and fixed six unnamed notification checkboxes by linking existing label/hint text
  with ARIA. Found the previous push's browser failure in GitHub run `42184150869`: photo-wall
  dismissal raced asynchronous history Back with the next navigation. Viewers now finish their
  history close before unmounting, with a regression assertion. The code/database CI job passed.
- Strengthened route checks to reject HTTP 4xx. Both old `/expenses` test visits were nonexistent
  routes; replaced them with the actual date spending section and notification settings.
- Enlarged-text screenshots exposed clipped header/nav targets and a submit button despite no
  document-width overflow. Added bounds/overlap assertions and responsive constraints that retain
  normal token dimensions. Existing colors, copy and screens preserved. Compared original and
  updated workflow screenshots: normal phone differs only in hover/dev-tool pixels, and the
  landscape screenshot is pixel-identical. Strong enlarged-text bounds/overlap assertions pass.
- Local evidence: Chromium `ed2a8ca367deaf31` passed compatibility (11) and workflows (12),
  including 16 routes at seven sizes. Earlier Chromium `9eaba8e2d60c52f0` passed journey (10),
  account (12) and pagination (6) after the history fix. Native Firefox `0cb1d74fa95ba090`
  passed all 11 compatibility checks after the final app changes. Guarded test polling against a
  temporarily absent document body during streamed redirects. All 234 unit and 82 PostgreSQL
  cases, lint and TypeScript passed. Required `npm run build` passed (Next.js 16.3.4, all routes
  generated). The isolated PostgreSQL test server was stopped.
- Published implementation `9386ae619527b64662a07ec57633dade5b22cfb5` to `origin main`.
  [GitHub run 42191624217](https://github.com/Tus-GitHub/MONO/actions/runs/42191624217) passed all
  three jobs: code/database (234 unit, 82 PostgreSQL, lint, TypeScript, build), Chromium 51 checks
  (Chrome 156.0.8078.79) and Firefox 11 checks (Firefox 159.0). Artifacts are separated by engine.
- Vercel deployment `dpl_69rwpTTeov3KgMx2QqWmkF3LzGqC` for the same SHA is READY, production
  target. Authenticated connector checks of the production alias return HTTP 200 for `/login`
  (real app email/password form) and `/api/health` (database up). A fresh unauthenticated browser
  reaches Vercel's sign-in gate, so that optional production browser smoke is not counted as an
  app test. No protection settings, provider keys or deployment configuration were changed.
  Remaining Safari/physical-device/native-zoom/provider acceptance is documented in testing.md.
- Verification notes published as `59f0d6b`; [GitHub run 42193211135](https://github.com/Tus-GitHub/MONO/actions/runs/42193211135)
  again passed all three jobs. Its production deployment `dpl_7F3ybjMsfwtgLWD6zawnvFzDHSrm` is READY;
  the latest health read returns 200/database up and scoped error/fatal log query returned no logs.
- Vercel deployment details also list the canonical public production hostname
  `https://mono-kappa-beryl.vercel.app`. Unlike the team alias, it permits a new unsigned browser.
  Read-only Chrome 156.0.8078.80 smoke passed `/login`, `/register`, `/forgot-password` and the
  `/home` → `/login` redirect, each with normal/200% root text at 320px. Anonymous session API
  access correctly returns 401; no browser errors occurred. No forms were submitted and no
  production records were created. Result artifact: `.postgres-test/production-browser-smoke-results.json`.

### 2026-11-06 — Detailed project and database Word report

- **DONE.** Created `docs/reports/MONO_Project_Architecture_and_Database_Report_2026-11-06.docx`:
  60 pages with numbered contents, completed feature catalogue, layered architecture, all 38 page
  components, 15 HTTP route handlers, 15 action modules / 67 exports, and 38 service source files.
- Verified Prisma metadata against source definitions. Documented all 26 application tables,
  319 physical columns, 50 foreign keys, 17 enums, model indexes/uniqueness, six migrations,
  14 named plus two inline SQL CHECK constraints, and all 494 tracked source files in the audited
  `1177d7c` snapshot. Explained `_prisma_migrations` bookkeeping, timestamp semantics,
  private reviews, shared revisit decisions, archive limits and remaining activation/device work.
- Used bundled Python/OOXML tooling and the canonical renderer. A temporary official signed,
  checksum-verified LibreOffice package was extracted only inside ignored report-build files
  because no native renderer was installed. No system installation or cloud document upload.
  Visually inspected all 60 pages, repaired the title rule/blank page/orphaned catalogue rows,
  and rechecked all changed pages. Automated content and full source-tree reconstruction passed.
- Corrected stale 21-model and Google-placeholder descriptions in `docs/architecture.md`.
  Latest audited main GitHub run `42088529463` passed for `1177d7c`; its Vercel deployment
  `dpl_H5NzGtNS3vMwbriCkq27ZPoiWnit` is READY. These are timestamped report evidence,
  not claims that unconfigured providers or physical-device checks are complete.
- Existing UI, application behaviour, dependencies, keys and production data were unchanged.
  Vercel Git deployments remain enabled. The required `npm run build` passed before
  documentation publication; only this report, architecture notes and task memory are included.

### 2026-11-05 — Remaining functionality and responsive checks

- **DONE (completed 2026-11-06).** Continuing the user's existing scope after 36 browser checks and GitHub CI
  passed. Remaining release work includes broader responsive/keyboard checks, real-device QA,
  configured-provider delivery and operational verification. Keys remain deferred. Investigate
  expense timestamps because datetime-local values currently depend on the server timezone.
- Implemented explicit `spentAtLocal` input interpreted in the authenticated couple timezone;
  explicit Date/offset-bearing ISO instants remain supported. Editors show the space's clock,
  amount-only/omitted-time edits preserve the existing instant, and unchanged visible minutes
  retain stored seconds/milliseconds. DST gaps are rejected; new repeated clock times choose
  the earlier occurrence while unchanged values preserve the existing occurrence. No stored
  timestamps or database schema were rewritten.
- Fixed initial dialog focus targeting hidden fields. Modal/sheet focus now selects visible,
  tabbable controls, wraps keyboard navigation and restores focus. Both photo viewers use it.
  Reproduced nested scroll teardown leaving `overflow:hidden` in isolated real Chrome; reference-
  counted locks now restore original styles only after the final overlay exits. The shipped
  two-user journey verifies nested Escape restores page scrolling.
- Verified **234 unit tests (36 files)** and **82 real PostgreSQL cases (8 files)**. The expanded
  browser suite has **40 named checks**: full-suite local run passed before the final scroll fix,
  followed by a passing real journey and workflow run against the final code. Workflows exercise
  16 app routes across seven viewports (112 route/viewport combinations), timestamp editing,
  DST correction and keyboard focus. Inspected 320px and landscape screenshots. Full lint passed;
  all five changed TSX files retain their className expressions and the global CSS is unchanged.
- Reconciled release docs so old unchecked September items are distinguished from current
  evidence. Actual-device/browser-engine checks, provider keys/delivery, scheduler activation,
  production-data migration/backup verification and performance/zoom checks remain open.
  Vercel deployments remain enabled. Required production build and publication are next.
- Required production build passed. Final local verification found zero fixture users, spaces,
  sessions and cleanup jobs; stopped the isolated PostgreSQL instance. Publishing this milestone
  for the full GitHub checks and Vercel deployment verification.
- Published implementation commit `5ececd8` successfully to `origin main`. GitHub run
  `https://github.com/Tus-GitHub/MONO/actions/runs/42086621709` passed both jobs, including all
  40 browser checks against the final shared-dialog code and expanded responsive matrix.
- Vercel run `dpl_4sdgKf4LdTDdPMHTJ1dDVuCRGKqA` remains QUEUED with no build logs at verification;
  automatic deployment is still enabled. Read-only checks of the currently served production
  alias returned `/login` 200 with the sign-in form and `/api/health` 200 with `database: up`.
  These confirm basic serving/reachability, not provider delivery or full schema/migration readiness.
  Used the authenticated Vercel connector per its access-testing guidance; no key values or
  authentication/share tokens were printed or committed, and no protection setting was changed.

### 2026-11-05 — Continued delivery and Vercel deployment authorization

- **DONE.** User accepted the existing Vercel deployment and authorized continued work
  and pushes because the deadline is tight. Re-enabling `git.deploymentEnabled`, keeping the
  current UI and all integration keys unchanged. Focus this pass on release automation and
  uncovered existing-feature workflows; no speculative feature expansion or live database write.
- Confirmed the prior GitHub push checks succeeded and Vercel reports implementation commit
  `f371333` READY in production. Added a separate CI browser job with disposable PostgreSQL,
  installed Chromium and fixture-only screenshot/result artifacts. Production build passed
  before publishing this milestone. Local storage, keys and server logs remain excluded.
- Milestone `b18f877` pushed successfully: GitHub's browser and code/database jobs both passed,
  and Vercel reports the corresponding deployment READY. Automatic deployments are enabled.
- Added eight real-browser workflow checks for plan editing, stale partner drafts, duplication,
  draft deletion/cancel confirmation, cancellation redirects, expense validation, payer changes
  and removal. All eight pass locally. The new test reproduced lost expense descriptions/notes
  after validation errors; controlled fields now retain edits, and collapsing optional details
  preserves their submitted values. Existing className expressions and UI styling are unchanged.
  Browser coverage is now 36 named checks. Full lint passed; the next push runs all four suites.
- Required production build also passed for the expense-field fix and expanded workflow suite.
- Published the functional fix and coverage as `5883d55`. GitHub run
  `https://github.com/Tus-GitHub/MONO/actions/runs/42049480389` completed successfully: journey
  10, account 12, pagination 6 and workflows 8, plus the code/database job (212 unit tests,
  75 PostgreSQL cases, lint, TypeScript and production build). Vercel deployment
  `dpl_CyC2hGg6Dy83XVzidHLF1B7yoq6J` for that exact commit reports READY.
- Browser CI cleaned 11 fixture accounts and six fixture spaces. Local verification found
  zero remaining users/spaces/sessions/cleanup jobs, and the isolated PostgreSQL server was
  stopped. No new dependency, UI redesign, key change or manual live database write.

### 2026-11-05 — Publish verified functionality changes

- **DONE.** User requested publishing all completed changes to GitHub while keeping keys
  and deployment for later. Scope includes the audit fixes, archive/restore, account/session
  controls, browser regressions, PostgreSQL migrations, tests and documentation from the prior
  local passes. Follow the repository's build-before-commit/push sequence; preserve the UI and
  exclude environment secrets, local databases, test artifacts and generated output.
- Required production build passed before staging. The prior verified baseline remains
  212 unit tests, 75 PostgreSQL cases and 28 browser checks. Publication excludes `.env`, local
  storage/test databases, browser artifacts and generated files. No manual deployment or live
  migration command was run; the existing integration's automatic deployment is recorded below.
  The configured destination is `Tus-GitHub/MONO`, branch `main`.
- Committed 148 files as `f371333` ("Complete reliability, archive recovery, and account controls")
  with the repository-required co-author trailer; `git push origin main` succeeded. Environment
  secrets and local artifacts were excluded.
- **Automatic deployment exception:** after the push, GitHub reported an existing Vercel check
  pending, then successful, linking to
  `https://vercel.com/tus-githubs-projects/mono/F5svdKawBtfZopk9quzN1mc1ftpk`.
  No manual deployment was requested or invoked. The automatic run completed before cancellation
  was possible. Its runtime health and any migration side effects were not verified; no live
  rollback was attempted. Do not interpret the successful build/status as full launch readiness.
- Added Vercel's documented `git.deploymentEnabled: false` setting to prevent additional automatic
  Git deployments, matching the user's request to defer deployment. Re-enable only when the user
  proceeds with activation; see `DEPLOY.md`. This follow-up records the confirmed publication and
  deployment exception without changing `.env` or integration keys.

### 2026-11-05 — Browser E2E and two-day completion target

- **DONE.** User requested browser E2E testing and fixes with unchanged UI, keys and
  deployment deferred, then asked what could delay a two-day finish. Explained that local code
  completion and live readiness differ: external configuration and real-device/provider checks
  remain prerequisites for live readiness. Prioritized existing-feature failures and regression
  checks over additional features.
- Added `npm run test:e2e` using existing Puppeteer/Chromium, a dedicated loopback-only
  `mono_test_e2e_*` database, ephemeral auth configuration, disabled external providers and
  temporary local media/browser contexts. Each suite runs against a fresh Next development
  server with real rate limits. The runner preserves generated configuration, supports fresh
  checkouts without next-env.d.ts, captures failure evidence and cleans only its exact fixtures.
- Fixed empty-string date-picker initialization and the action cursor limit that prevented the
  photo wall loading beyond 48 items. Offline upload retry now keeps side effects outside React
  state updaters and deduplicates queued work. Photo controls await action results, show existing
  toast feedback on errors, and preserve controlled caption drafts after rejected submissions.
- Fixed overlay history for StrictMode replay, nested Back and simultaneous Escape. Accepted
  confirmations now wait for their own history entry to be removed before starting actions;
  a real browser trace reproduced the old race that undid memory-removal redirects.
- Revoked sessions now reach login through page guards. Memory draft keys include the user ID,
  legacy unscoped drafts are ignored, deleted memory text is excluded from editors, and an
  explicit replacement save has current authorship. Wrapped programmatic action dispatches in
  transitions. Successfully converted HEIC/HEIF JPEGs are retained even when larger than the
  unsupported original; five simulated-browser adapter tests cover conversion/failure paths.
- Final verification: **212/212 unit tests (35 files), 75/75 real PostgreSQL cases (7 files),
  and 28/28 browser checks** (journey 10, account/archive 12, pagination/memory 6). Combined
  browser evidence is under ignored `.postgres-test/e2e/070dfba0d01e9522`. TypeScript, full lint,
  production build and whitespace checks passed. The reliability test fixture now makes queued
  work explicitly due, avoiding PostgreSQL/Windows clock-precision flakiness; production queue
  behavior is unchanged. All 26 changed TSX files retain their className expressions and the
  global stylesheet is unchanged. Inspected desktop and phone-viewport screenshots.
- Verified zero fixture users, spaces, sessions and cleanup jobs after browser cleanup; stopped
  the isolated PostgreSQL server. No new package, .env change, live database migration, publish
  or deployment. Updated testing, architecture, account/archive guides and audit status.
- Remaining launch work: actual iOS/Android keyboard/camera/installed-PWA checks, real provider
  delivery, production configuration and existing-data migration preflight. Browser E2E uses
  development mode and viewport emulation; the production build is verified separately. These
  checks do not claim actual-device HEIC decoding or configured-provider delivery.

### 2026-11-05 — Archive/restore and account/session controls

- **DONE.** User requested archive/restore and account/session controls, preserving the UI and
  leaving keys/deployment for later. Independent archive/session implementation and a read-only
  security review complemented the account-closure work. No new dependency or visible screen.
- Added `GET/POST /api/archive` with `mono.archive.v1`, embedded owned photo/cover variants,
  SHA-256 integrity, strict graph/enum/image validation, 64 MiB JSON / 32 MiB media / 10,000-row
  limits, an eight-request per-user limiter, and bounded IO/DB work. Own draft/revealed-review
  visibility is preserved. Deleted content, unseen partner reviews, personal avatars, auth/device
  credentials and notification jobs are deliberately excluded; this is an active-content archive,
  not operator disaster recovery. Existing `/api/export` and settings UI remain compatible.
- Restore maps the same people and OWNER/PARTNER roles to fresh IDs/storage keys in an empty
  current space. Each active member approves the exact digest/target for 15 minutes; approval
  validity includes the live browser session and token version. It rechecks account/membership,
  approvals and destination emptiness after media staging. All rows and a unique receipt commit
  atomically; failures/concurrent losers retain durable orphan cleanup tasks. Restored personal
  reminders are dismissed so historic snapshots cannot replay deliveries. Fixed AVIF media MIME.
- Added AuthSession and session-bound push subscriptions. JWT cookies carry a session ID and
  protected requests validate owner/version/expiry/revocation. Current, individual, other-device
  and all-device revocation are supported by protected API endpoints. Remember-me behavior is
  retained, 20 devices are bounded, and only coarse device labels are stored. Old cookies need
  sign-in after migration; old unbound push capabilities are retired and settings re-register.
- Password changes verify current credentials and revoke all sessions/reset tokens/push devices
  atomically. Reset/link issuance and OAuth linkage lock/recheck living users; conditional login
  rehash cannot overwrite concurrent password changes. Register/reset/change all enforce bcrypt's
  72 UTF-8-byte bound. Same-origin JSON APIs stream-limit request bytes. Revoked-cookie login
  routing avoids redirect loops. Logout still clears cookies when DB revocation is unavailable;
  docs explicitly explain that server revocation cannot be guaranteed during an outage.
- Account closure now self-authorizes and locks the user before atomically archiving the active
  space, retiring memberships, dismissing reminders, revoking invitations/sessions/deliveries and
  removing password/OAuth/reset/push credentials. Shared authored history and profile identity
  remain retained; this is soft closure, not physical erasure. Couple creation/join, invitation
  creation/acceptance and push registration use the same living-user lock. Addressed invites
  enforce intended email. Failure at the final user update rolls back every prior change.
- Verification: full unit suite **203/203** (33 files), real PostgreSQL **73/73** (6 files),
  including 12 archive, 10 account and 9 session cases. Tested both an existing isolated DB upgrade
  and all six migrations from scratch in `mono_test_archive_sessions_fresh`; latest archive query
  bound was covered by the fresh run and type check. Lint has zero errors/warnings; production
  build passes. Compared className expressions in 18 existing TSX files and unchanged global CSS.
  Fresh test DB fixture counts are zero for users/couples/sessions/receipts/cleanup tasks; local
  PostgreSQL server stopped. Existing application DB, keys, deployment and GitHub untouched.
- Added `docs/archive-restore.md`, `docs/account-sessions.md`; updated testing/architecture/security,
  README, report implementation status and aggregate-only SQL diagnostics. Full browser E2E,
  live provider delivery and real-device verification remain pending.

### 2026-11-05

- **Audit remediation pass two — DONE.** User asked to continue and reiterated continuation
  during the active work. Preserved the original objective/UI and existing local changes.
  Added PushSubscription, NotificationDelivery and StorageCleanup plus atomic migration
  20261105010000_durable_delivery_and_cleanup. Legacy subscriptions migrate to their most recent
  owner and the deprecated JSON field is cleared; an isolated-schema migration regression verifies it.
  Notification rows, reminder claims and per-browser push tasks persist atomically. Leased workers
  retry six times with backoff, recover crashed attempts, retain terminal errors, and cancel stale
  work after membership/preferences/date/reminder changes. No provider HTTP runs inside a DB
  transaction. Expired endpoints clear only the matching browser; conditional deletion compares
  both keys and timestamp so same-millisecond rotations survive stale failures. Supported provider
  HTTPS origins and encryption key shape are validated; transport rejects redirects.
  Browser enable/disable preserves other devices. Device cookie identifies the current browser;
  logout unlinks only that user/device or their migrated legacy subscription, still clearing auth
  during DB outages. Polling and the scheduler retry previously queued deliveries even with no
  newly due reminders; scheduler failures and cleanup counts appear in secret-free worker logs.
  History scans bounded batches before display filters/cap and counts all matches. Year filters
  use actual date with scheduled fallback. Photo cursors include time and ID to preserve ties.
  Photo/avatar/cover uploads reserve orphan cleanup before IO, publish references transactionally,
  and retain deleted/replaced objects seven days. Date deletion also enqueues its photo keys.
  Cleanup uses leases, bounded retries, reference rechecks and terminal failure metadata. Partial
  uploads wait for all writes to settle; losing a concurrent deletion leaves only cleanup work.
  Private media checks live references before 200/304, returns 404 for removed references, and
  requires cache revalidation. Existing downloaded files cannot be recalled. S3 operations have
  bounded abort signals. Full portable archive/import and a restore UI are still not implemented.
  Added queue status SQL, migration/provider/retention documentation, generated-output lint ignores,
  and regression cases. Verification: 183 unit cases passed across 28 files (final added legacy
  logout case verified with its 3-case action suite); all 42 real PostgreSQL integration cases
  passed across 3 files, with mocked push HTTP and real local storage. Production build, TypeScript,
  full lint, worker CLI authorization/failure/logging checks and git whitespace checks passed.
  Confirmed unchanged className expressions in 18 existing TSX files and unchanged globals.css.
  Local PostgreSQL stopped after fixture cleanup. Migration applied only to isolated local test DB;
  existing application DB and credentials untouched. All changes remain local; no publish/deploy.

- **Audit remediation in depth, pass one — DONE.** Implemented the priority fixes from the
  research report while retaining the earlier local changes and existing design. Shared review
  helpers exclude partner drafts/unrevealed reviews and former members from exports/place
  averages/recommendations; the generic date-detail read is filtered too. Exports include active
  standalone memories/expenses and more plan fields, and omit deleted nested memories.
  Added withDateWrite: parent-date locking, membership/state recheck, serializable transaction,
  per-date version increment. Plan basics/budget forms submit versions and reject stale saves;
  all plan/activity/place writes enforce editability. Review submit/reopen/delete and lifecycle
  changes now check and write under the same lock. Real concurrent tests exposed PostgreSQL
  40001 errors wrapped by Prisma P2010; bounded retries now handle those and deadlocks as well
  as P2034. Competing activity additions receive distinct positions.
  Existing wall-time storage remains compatible; reminders/countdowns explicitly convert to
  instants using the couple zone. Fixed upcoming countdown target mismatch, local-day calendar
  and date-picker defaults, timezone-aware validation/day mode, and missing start times. New
  spaces capture the browser timezone in a hidden field; existing couple timezones are unchanged.
  Date expense writes require the date currency; totals group/filter by original currency so
  profile currency edits never relabel unlike amounts. Added atomic migration
  20261105000000_integrity_and_plan_versions (version, score/money/budget/coordinate checks,
  partial unique membership indexes). Regenerated Prisma client. Migration applied only to two
  isolated local databases created for testing, never to the existing remote application DB.
  Added safe explicit-loopback test launcher, 23 real PostgreSQL service integration cases,
  CI workflow with disposable PostgreSQL 17, testing guide, and updated architecture/security/
  audit report. Tests simulate authenticated identities per async context; real cookies/browser
  end-to-end and live provider delivery remain unverified. No keys or UI styling changed.
  Verification: 155 unit tests passed; 23 PostgreSQL tests passed, including a fresh application
  of the finalized atomic migration; production build and TypeScript passed. Initial Turbopack
  build hit resource limits and cached that failure; cleared generated .next cache and rebuilt
  successfully outside the sandbox. Changed-component and final full lint passed without warnings;
  removed the temporary formatting helper from ignored QA output before final lint. Checked
  unchanged className expressions in 17 existing TSX
  files and unchanged globals.css. Local test server stopped after fixtures cleaned up.
  Changes remain local; no commit, push or deployment in this turn.

- **Deep project / PostgreSQL report — DONE.** User requested deep research on gaps, additional
  features, and PostgreSQL. Audited current services/schema/baseline migration and consulted
  official PostgreSQL, Prisma 6, Neon, ISO currency, iCalendar and Between sources. Wrote a
  4,884-word report in docs with fourteen findings, twelve feature proposals, schema inventory
  (21 models, 16 enums, 43 foreign keys, 38 ordinary and 14 explicit unique indexes; no CHECKs
  in the checked-in migration), recommended transactions/constraints/indexing/recovery, test
  acceptance criteria and phased priorities. Added read-only metadata/integrity SQL for later
  manual use; not executed. Verified all 36 local report references resolve. No application
  behavior, environment values, live database, deployment, or GitHub changes in this research turn.
  Key open defects: export leaks unrevealed partner reviews; place aggregates bypass reveal;
  plan mutations lack lifecycle editability checks; wall-time/instant calculations differ;
  unlike currencies are summed. Concurrency issues are source-level risks, not live reproductions.

- **Codebase completion follow-up — DONE.** User deferred deployment and requested code work.
  Removed broad 18-hour reminder suppression so distinct kinds and snoozed occurrences deliver;
  atomic claims still prevent duplicate concurrent delivery. Retirement now matches the read
  schedule to avoid dismissing a concurrently rescheduled reminder. Invalid plan IDs/steps/targets
  return feedback before mutations. Draft scope resets safely even when browser storage throws.
  Unsaved guards remain armed through submission/errors and clear on confirmed success; custom
  review/date controls are tracked. Review draft/submit share one action state, preventing an old
  submission error from masking a later draft-save result. No styling, keys or database changes.
  Verification: 144 unit tests across 25 files passed; lint and production build (including
  TypeScript) passed. Headless Chrome checks passed for draft reload/empty strings/user scope/
  changed server baseline/save clearing/blocked storage and unsaved guard failure/success/custom
  controls. Existing styles checked against HEAD. Real provider delivery and authenticated
  end-to-end device checks remain unverified; deployment stays deferred. Changes are local.

- **Existing env inventory — DONE.** Inspected presence/configuration only, without printing
  secrets. Existing: pooled Neon DATABASE_URL with SSL, complete R2 variables, Google Places
  key/provider, and matching public VAPID variables. AUTH_SECRET is a development placeholder;
  APP_URL is local; storage/email currently local/console. SMTP credentials, Google OAuth
  credentials and CRON_SECRET are absent. Preparing step-by-step Vercel setup; no env values
  changed and no cloud resources created.

- **Vercel setup guidance — DONE.** User requested exact keys/settings before deployment.
  Reviewed current env schema, Prisma datasource and build scripts. Recommended explicit
  `npm run vercel-build`, Node 22, production-scoped variables, separate production database,
  private R2 storage, SMTP, optional OAuth/Places/VAPID and CRON_SECRET. No credentials
  read or changed, no deployment started; user will enter values in Vercel.
  Corrected DEPLOY.md to recommend a direct Neon URL for the current single-URL
  migration/runtime schema; pooled runtime should use a separate migration connection.

- **Publish — DONE.** User explicitly requested publishing these changes to GitHub.
  Target: origin/main (Tus-GitHub/MONO). Includes implementation, tests, documentation,
  and existing storage/Places diagnostic scripts; credentials remain git-ignored.
  Required production build passed. Commit `ad4ab82` pushed successfully to origin/main.

- **Functionality completion — DONE (application implementation; keys/live QA deferred).**
  User requested completing functionality while leaving keys alone and preserving the UI.
  Recorded that standing preference in CLAUDE.md and docs/design-system.md.
  Implemented Nodemailer SMTP (TLS, timeouts, accepted-recipient checks), typed SMTP config,
  check:email (verify only; no sending), and single-use transactional password-reset claims.
  Reset-delivery failures retain the generic response. OAuth now validates verified profiles,
  handles outages/malformed responses, rejects deleted accounts, honors the disable flag,
  preserves invite links, and uses existing form feedback for errors. Google Places photo
  URLs no longer expose keys; authenticated server resolution handles expired photo refs.
  Corrected missing location params being interpreted as 0,0 and added provider timeouts.
  Plan basics/budget and private reviews have validated, versioned, user-scoped device drafts;
  cleared fields survive reload, drafts expire after 7 days, and stale server versions win.
  Couple create/join and invitation acceptance use serializable transactions with retries.
  Added reminders:worker and reminders:dispatch for a configurable external Node worker.
  Updated README, architecture, checklist, deployment instructions and env placeholders.
  Verification: 138 tests / 24 files pass; lint and production build pass. Chrome draft
  harness passed restore/empty/user-isolation/server-change/clear/re-edit checks; local
  worker harness passed auth/counts/error-status/no-secret-log checks. Verified unchanged
  className expressions in all 10 changed TSX files, with globals.css/tokens untouched.
  No real emails/push sent, no credentials changed, no live DB migration, no deployment,
  commit or GitHub push. Provider activation and real-device QA remain explicitly deferred.

- **Scheduled reminder code — DONE; deployment pending.** Added `/api/cron/reminders`,
  fail-closed bearer authentication via optional 32+ character `CRON_SECRET`, aggregate
  dispatch results, and per-recipient failure isolation. In-app notification + sent marker
  now commit atomically to prevent overlapping cron/tab duplicates; push follows commit
  best-effort. Eligibility excludes deleted users and inactive/foreign couple membership;
  due disabled-category reminders are retired. Added 12 tests: all 110 tests pass after
  sandbox EPERM retry; TypeScript, lint, and production build pass. No new dependencies or schema
  migration. DEPLOY.md documents five-minute scheduling and Vercel Hobby limitations.
  Hosting activation/live verification, SMTP, and device QA remain. No push performed;
  pre-existing edits preserved.

### 2026-11-04

- **Completion and GitHub status review — DONE.** Compared implemented features with
  deployment docs and backlog. Core app and PWA are implemented; SMTP and scheduled reminder
  dispatch remain unfinished, and production configuration/device QA need verification.
  Older checklist stub entries for S3 and Web Push are stale. Git origin is
  `https://github.com/Tus-GitHub/MONO.git`, current branch `main`. Push credentials were not
  tested and no commit/push was performed; user asked whether pushing is possible.

- **Project instructions — DONE.** User confirmed using the existing `CLAUDE.md` as the
  project guide for subsequent work, including architecture invariants and memory updates.

- **Codebase orientation — DONE.** Read project rules, route structure, schema,
  auth/authz, actions/services, lifecycle/review rules, provider configuration, and PWA code.
  README status/model counts lag the implementation (21 models). SMTP remains a placeholder;
  reminders dispatch through an open-tab poller. Existing working-tree changes preserved.
  Initial Vitest run blocked by sandbox EPERM while resolving dependencies; approved retry
  passed all 98 tests across 14 files. TypeScript check passed. No build or browser E2E run.

### 2026-09-03

- **Production image storage provisioned (Cloudflare R2).** Private bucket **`mono-photos`**,
  Account API token scoped to it (Object Read & Write). S3-compat endpoint
  `https://fabe5fa12691c2884b6f98554320fdc6.r2.cloudflarestorage.com`, `S3_REGION=auto`,
  path-style auto-on. Values live in local `.env` (git-ignored) with `STORAGE_DRIVER=local`
  still selected for dev; **production sets `STORAGE_DRIVER=s3`** + the same six `S3_*` vars in
  the host env. New tool **`scripts/check-storage.mjs`** / `npm run check:storage` — real
  PUT→GET→HEAD→DELETE round-trip against the bucket; passed. Still to do for a live deploy:
  real `AUTH_SECRET`, a host (Vercel) with all prod env vars, `APP_URL` = the https origin.
  (`scripts/check-storage.mjs` + the `check:storage` package.json line are uncommitted — no
  secrets in them.)
- **External place provider — Google Places API (New) — chosen; key not yet provisioned.**
  MONO calls `places.googleapis.com/v1/` (`places:searchText`, `places/{id}`, photo `/media`).
  Enable **"Places API (New)"** (not legacy), key with **API restriction = Places API (New)**,
  **Application restriction = None** (server calls from Vercel have rotating IPs; browser
  fetches the photo URLs). Env: `PLACE_PROVIDER=google` + `GOOGLE_PLACES_API_KEY` (local `.env`
  + host). New tool `scripts/check-places.mjs` / `npm run check:places` — direct `searchText`
  call that surfaces Google's real error (the app provider swallows errors → falls back to
  saved places, so a bad key is otherwise invisible). Also uncommitted, no secrets.

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

### 2026-11-15 — Encrypted chat and privacy controls — DONE (local implementation)
User approved a private recovery code shared out of band. Synced latest main 31f5c95, preserving photo cropping/upload fixes and task notes. Existing chat stored plaintext; designing encrypted writes, safe migration and atomic limited views. Earlier live audio QA remains unverified; no new call test claimed.

Implemented AES-256-GCM content encryption with a random recovery code, couple-scoped HKDF
key derivation, nonextractable IndexedDB keys and fingerprint-only registration. Text/sticker
and photo APIs reject plaintext. Added atomic recipient view-once/twice consumption, no-store
media access, close/background URL cleanup, author-only encrypted edit, per-user deletion and
author-only delete-for-everyone. Version-aware merges and revision pagination propagate old
message changes without stale polling resurrection. Chat does not mark messages read while
locked. Game system events store no new plaintext message body; game metadata remains visible.
Existing history conversion verifies ciphertext locally and replaces body/photo bytes atomically;
original image bytes and formats are preserved. Old database backups cannot be retroactively
erased. No paid dependencies/services added. New additive SQL migration applied only to a fresh
local mono_test_chat_security database on port55459.
Validation: all529 unit checks and all188 integration checks passed, TypeScript and full ESLint
passed; first build passed (82 routes; largest26.82MiB). Final build and focused46 integration
checks are running after the final review removed plaintext game-result descriptions. No browser
or actual phone UI testing performed for these changes. Do not describe this as independently
audited, Signal protocol, forward-secret, screenshot-proof, or already live.

Final production build passed:82 routes; largest26.82MiB; summed519.11MiB; unique29.18MiB. Focused46 integration checks also passed after final code review. Changes remain local and uncommitted. Live history remains unchanged and requires recovery-code setup plus Secure existing history after a future deployment.

### 2026-11-15 — Publish encrypted chat and test production — IN PROGRESS
User explicitly requests deployment and live verification. Synced main58136c4 preserving completed photo-audit notes. Release adds one additive migration; the configured Vercel build applies it before assigning production. Existing529 unit/188 integration tests passed; production build repeated for this publish. Tests target retained synthetic d8e38499 space, not real partner content.
