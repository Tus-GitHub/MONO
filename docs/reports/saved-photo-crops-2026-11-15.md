# Saved-photo crop verification — 15 November 2026

Feature commit `5d9e7c8f683f05c1e61afdeaf34bad2297e3b5c8` is deployed on
[MONO](https://mono-kappa-beryl.vercel.app). Vercel deployment
`dpl_E7EswCZSdpiRTro25jbjkVT8qgkv` reached READY and owns the canonical domain.
Production health returned 200 with the database up. An unauthenticated crop descriptor
request returned 401. The additive crop migration ran during the deployment.

## Behavior

Existing profile and couple photos have an **Adjust crop** action. Date galleries and
their lightboxes offer the same editor. A chat sender can adjust their own photo.
Saving sends bounded crop coordinates and a revision; it does not upload image bytes.
Original storage keys and bytes, photo/message IDs, captions, favorites, Memory references,
encrypted ciphertext and private-photo view limits remain intact.

See [saved-photo behavior and implementation](../saved-photo-crops.md).

## Verification

- 13 focused unit tests passed: crop bounds and reopening, URL tokens, upright/EXIF pixel
  rendering and existing encryption primitives.
- 30 isolated PostgreSQL integration tests passed across crop metadata, private media,
  encrypted chat and archive restore. These cover access denial, stale/concurrent writes,
  source preservation, partner revisions, replacement reset, view limits and crop-preserving
  archive restoration. An existing archive test was corrected to identify the partner by ID
  instead of assuming member ordering.
- TypeScript, targeted ESLint and production builds passed. No dependency was added.
- The locally built site passed 13 browser checkpoints and eight crop saves for two
  synthetic partners in Chromium phone and standalone-display modes.
- Direct production Chromium passed 14 checkpoints, including eight crop saves: owner in
  phone-browser mode and partner in standalone/PWA mode. The production service worker was
  activated. File-picker and image-upload monitoring recorded neither during crop edits.
- Production WebKit UI checks passed 14 checkpoints: owner in standalone/PWA display mode
  and partner in phone-browser mode. See the transport limitation below.

Both browser runs exercised cancellation, pan/zoom, immediate save, reopening the same
region, preserving original-file hashes, identical protected output for both partners,
date-gallery updates without reload, nested lightbox Back behavior and the selected date
photo in Memories. Authenticated image dimensions matched the selected normalized crop.

Encrypted chat checks used existing sender photos, including already-exhausted private
photos. Cropping preserved their counters and storage usage. The recipient's already-open
regular encrypted photo changed framing without reloading or downloading the photo again.
No production application fix was needed after the feature deployment.

Crop dialogs and their Save controls were checked after layout settled at 320×568,
390×844, 844×390 landscape, 768×1024 and 1440×900. This is automated browser coverage,
not physical iPhone/Samsung, native-keyboard or installed-device testing.

## Test-run qualifications

The native Windows WebKit runner repeatedly failed HTTPS requests with SSL connection and
“Failed sending data to the peer” errors, including ordinary images/status requests. Native
WebKit profile/couple checks passed before these failures. Remaining WebKit checks relayed
actual production HTTP responses through Playwright's APIRequestContext; no application
response was mocked. Service workers were blocked for that relay, so it does not establish
native Safari networking or installed iOS service-worker behavior. Chromium ran directly.

Harness corrections were retained in the evidence: match the rendered display image rather
than its thumbnail URL; scroll lazy gallery figures into view; wait for viewport variables
after rotation and loaded responsive images after source switching; retry read-only reads
after ECONNRESET. The relay excludes local blob URLs. A focused WebKit touch diagnostic
confirmed one Save tap reached the button and produced a successful PATCH after rotation.
Earlier failed attempts are not counted as passing checkpoints. Final recorded runs had
no application JavaScript exceptions.

Only retained synthetic accounts were used. One missing encrypted partner photo was added
as a fixture before testing edits; subsequent crop adjustments uploaded no image bytes.
All four synthetic accounts' test sessions were revoked, and authenticated chat requests
then returned 401. Accounts, dates, messages and photos were retained as requested. Real
accounts/history were untouched. Local test servers were stopped.

Ignored local evidence is under `.postgres-test/live-crop-results/`:
`saved-local-chromium.json`, `saved-live-chromium.json`, `saved-live-webkit.json`,
`saved-webkit-touch-diagnostic.json` and `saved-crop-session-cleanup.json`, with screenshots
and earlier diagnostic runs. Recovery codes, passwords and cookies are not committed.
