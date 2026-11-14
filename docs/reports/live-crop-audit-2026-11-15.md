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
- Four real-PostgreSQL integration tests passed for avatar owner/partner/stranger access,
  personal-file isolation, revoked/deleted membership, ETag invalidation, replacement and
  couple-revision isolation. Test data lives only in a dedicated loopback database.
- Targeted ESLint, whitespace checks and the final production build passed. Runtime-size
  checks passed for 80 traces (largest 3.29 MiB, summed 209.27 MiB, unique 5.40 MiB).
- Baseline evidence is in the ignored `.postgres-test/live-crop-results/` directory:
  `baseline-report.json`, `baseline-date.png`, `baseline-memories.png` and
  `avatar-baseline-report.json`.

## Full production verification

Pending deployment, followed by actual upload/save/read/render checks for both partners
across the engine/mode matrix. The test compares saved pixels against the crop preview,
checks both partners can read the same private file, checks fresh-page persistence and
partner updates, and inspects framing on Home, couple/settings/onboarding, date result,
history, reviews and Memories/detail/editor/photo-wall views.

These are automated browser and standalone-display profiles. No physical iPhone, native
camera hardware or installed-device behavior is claimed.
