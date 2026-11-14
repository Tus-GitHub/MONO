# Photo adjustment and consistent couple framing

Date: 2026-11-14

## Behavior

- Profile, couple, date gallery, camera and chat photo pickers open a shared adjustment dialog.
- Drag, pinch, the Zoom slider and arrow keys control the selected area; Reset restores it.
- Couple photos use a consistent 5:2 frame in settings, onboarding, Home and couple space.
  Full photo preserves the entire image, with space around it when its proportions differ.
- Date and chat photos support Original, Square, Portrait and Landscape framing.
- Only the confirmed crop is encoded and uploaded. Cancel sends no image. Batches upload
  after every selected image is reviewed. Retry reuses the crop, not the original file.
- Existing private media authorization and upload limits remain. No schema migration or
  new dependency. Crop export strips image metadata and bounds upload size.

## Verification

The final source includes concurrent production changes through `0f23a15`.

- 14 crop, image-resize and upload-queue unit tests passed.
- Targeted ESLint and `git diff --check` passed.
- `npm run build` passed, including TypeScript and the runtime-function size guard.
  80 route traces: largest 3,445,049 bytes; summed 219,271,651; unique 5,642,390.
- Headless browser tests use isolated local users, a dedicated loopback PostgreSQL database,
  real API routes and protected local storage. Generated red/green/blue images allow checks
  of saved pixels and dimensions, not just the upload response.
- Both partners are exercised, with a standalone-display PWA profile for the second partner.
  The crop dialog is checked at 320x568, 390x844, 768x1024, 844x390 and 1440x900.
  Saved couple-photo framing is checked in four screens at 320, 390, 768 and 1440 widths.
- Checks cover cancel, invalid images, saved pixels, partner updates without reload,
  whole-photo preservation, phone EXIF orientation, retry, repositioning, profile zoom,
  batch review, camera capture entry point and chat's separate Send image confirmation.
- Found and fixed an off-screen confirmation footer in short landscape layouts and a
  relative/absolute positioning conflict in onboarding's couple photo.

Local WebKit testing uses an HTTP proxy that removes only the HTTPS-upgrade CSP directive
for loopback traffic. Production CSP is unchanged. Forced test navigations originally
aborted outstanding prefetches and produced WebKit access-control errors; settled navigation
passes the isolated diagnostic. The full test now waits for outstanding requests.

Final local Chromium report `chromium-mwgohf04.json`: all 13 checks passed, zero page errors.
WebKit report `webkit-mwgoggbb.json`: all 13 feature assertions passed; the overall zero-error
assertion retained one background `/couple` prefetch access-control diagnostic on local HTTP.
This is recorded as an unresolved local test diagnostic, not a clean full-suite pass.
The separate settled-navigation diagnostic had zero errors. Production HTTPS verification
remains the release follow-up. Local artifacts are under the ignored
`.postgres-test/framing-results/` directory in the isolated image-framing worktree.

Automated WebKit and PWA profiles do not establish behavior on a physical iPhone or installed
iOS PWA. Browser-native capture, photos and keyboard hardware were not used.

## Release

Pending publication and the non-mutating production crop-preview smoke test.
