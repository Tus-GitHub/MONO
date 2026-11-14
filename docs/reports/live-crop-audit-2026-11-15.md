# Live crop and upload audit

## Scope

Profile, couple, date and chat uploads for both retained synthetic partners on
https://mono-kappa-beryl.vercel.app. Chromium and WebKit mobile viewports, each partner in
browser and standalone-display PWA modes. Existing production accounts outside the synthetic
couple are not touched. Test records are retained, as requested.

## Confirmed live defects and fixes

1. **Saved framing changed in cards.** A real portrait crop uploaded and persisted as 600x800.
   The finished-date hero applied `object-cover` in a roughly 1.93:1 box, cutting away the
   selected area. Private photos now default to `contain`. Fixed-size cards use explicit
   fill positioning instead of conflicting relative/absolute classes. Hover scaling no
   longer clips saved edges, and memory-cover selectors preserve the full selection.
   Loading placeholders disappear when the real photo loads.
2. **Partner avatars returned 404.** Profile upload succeeded, but the partner could not read
   the protected file because all user-scoped media was owner-only. Only a user's current
   avatar is now also available to an active member of the same active couple. Unrelated
   users, former members, deleted/archived couples, deleted accounts and retired keys stay
   blocked. Authorization precedes conditional ETag responses.
3. **Avatar changes did not affect the live revision.** Profile saves updated the user row,
   while couple synchronization watched the couple/date timestamps. Avatar save/removal now
   touches only that user's active couple so partner views refresh without reloading.
4. **Chat could report failure after saving a photo.** The live upload exceeded the generic
   15-second chat deadline: the photo appeared in the conversation while the send sheet
   still reported a timeout. Multipart photo uploads now use the same 120-second deadline
   as the other photo uploaders. Normal chat/call deadlines remain unchanged, cancellation
   still works, and retries keep their existing idempotency nonce.

## Verification before release

- 14 crop, resize and upload-queue unit tests passed.
- Four chat-client regression tests passed: a photo saving after 15 seconds, ordinary
  request timeout, stalled-upload timeout and caller cancellation.
- Four real-PostgreSQL integration tests passed for avatar owner/partner/stranger access,
  personal-file isolation, revoked/deleted membership, ETag invalidation, replacement and
  couple-revision isolation. Test data lives only in a dedicated loopback database.
- Targeted ESLint, whitespace checks and the final production build passed. Runtime-size
  checks passed for 80 traces (largest 3.29 MiB, summed 209.27 MiB, unique 5.40 MiB).
- Baseline evidence is in the ignored `.postgres-test/live-crop-results/` directory:
  `baseline-report.json`, `baseline-date.png`, `baseline-memories.png` and
  `avatar-baseline-report.json`. `chat-timeout-baseline.png` captures the false failure
  sheet over an already delivered message.

## Full production verification

Published framing/access/synchronization fixes in `ef70e69` and the chat timeout fix in
`31f5c95`. Vercel production deployment `dpl_rUthfQB2D9RDyq5aF4K6ceqHQnKh` is READY and
serves the canonical MONO URL. No paid service or database migration was added.

| Engine | Owner profile | Partner profile | Completed uploads | Flow checkpoints |
| --- | --- | --- | --- | --- |
| Chromium | Phone browser | Standalone PWA | 8 | 10/10 |
| Chromium | Standalone PWA | Phone browser | 8 | 10/10 |
| WebKit | Phone browser | Standalone PWA | 8 | 10/10 |
| WebKit | Standalone PWA | Phone browser | 8 | 10/10 |

Each partner uploaded profile, couple, date and chat photos in each engine/mode. These
32 verified uploads used the actual UI pickers and APIs. Checks covered canceling without
uploading, dragging/zooming, square/portrait/landscape crops, couple Fill frame/Full photo,
the camera-picker entry point and chat's separate Send image confirmation. PWA profiles
had the production service worker activated.

Saved dimensions and sampled pixels were compared with the crop preview. Both partners
received identical protected bytes. Profile/chat persistence was checked after navigation
or reload; date persistence was checked through the partner's authenticated export.
Partner avatars, covers, gallery photos and chat images updated without a manual reload.

Framing checks covered Home, couple/settings/onboarding, finished date, history grid/list/
timeline, review, Memories, memory detail/editor/timeline and photo wall. Couple images
were checked at 320x568, 844x390 and 1440x900; the complete route sweep used 390x844.
Explicit Memory cover choices remain independent of the date's best photo.

An additional **eight-profile viewer pass** checked date/photo-wall lightboxes at 390x844
and 844x390, original-image zoom/reset, full chat images in a new tab, and rotating the
crop dialog without losing the selection or hiding confirmation controls. All eight
passed with zero browser errors. Representative Chromium and WebKit screenshots were
also inspected.

### Browser diagnostics and test limitations

Three matrix runs passed the strict zero-page-error gate. The last WebKit pairing completed
all ten flow checkpoints but logged ten access-control messages for background status,
presence and revision requests during navigation; the raw matrix report retains those
messages and its strict failure flag. Canceled same-origin requests were recorded alongside
them. A focused instrumented follow-up returned 19 successful API responses, zero page or
application JavaScript errors and an expected aborted revision fetch. The separate viewer/
rotation pass then completed in all eight profiles without browser errors. No reproducible
photo upload, framing or partner-update failure remained.

The harness was corrected to wait for visible active route content, scroll lazy-rendered
gallery items into view and respect the photo wall's best-photo-only behavior. These were
test-readiness/selection issues, not application changes. One interrupted authenticated
image GET used a single read-only connection-reset retry.

Evidence remains in the ignored local `live-crop-results` directory: four `matrix-*.json`
reports, `viewers.json`, `webkit-navigation-diagnostic.json`, baseline reports and screenshots.
Temporary synthetic sessions were revoked and signed out. Accounts, couple, dates, messages
and test photos were retained as requested. The dedicated local PostgreSQL test instance
was stopped.

These are automated browser and standalone-display profiles. No physical iPhone, native
camera hardware or installed-device behavior is claimed.
