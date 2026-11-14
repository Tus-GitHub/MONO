# MONO responsive layout audit — 14 November 2026

Initial audit verdict: broadly responsive, with two confirmed narrow-phone clipping defects and a separate photo-viewer contrast issue. The findings below describe the audited pre-fix release.

## Fix verification — 14 November 2026

All three findings are corrected in the implementation and pass 816 focused authenticated
local screen/viewport samples across all 25 configurations, both themes and browser/PWA
emulation. The two captions now contribute to their hero's height, while a ratio floor
preserves the original proportions when the content fits. Photos fill the expanded area;
the original typography, spacing, gradients, corners and controls remain. Both viewers use
a dedicated backdrop color that stays dark in either theme.

Verified the original clipping examples, maximum-length titles and venue/city text,
photo/fallback variants and short-content proportions. No caption clipping, page overflow
or uncaught browser errors occurred. Both photo viewers passed contrast and close-control
visibility checks at every main viewport. The measured minimum viewer-control contrast
was approximately 9.99:1. After syncing the separately published `a95439b` plan-category
update, 144 additional focused samples passed at 320/360/768/1440px in both themes and
browser/PWA modes. The final source also preserves the `7554357` nearby-search release;
none of its files overlap the five photo UI fixes. Full lint and final combined production
build/TypeScript passed. All three fixes are live in production.

| Release check | Result |
| --- | --- |
| URL / target / status | https://mono-kappa-beryl.vercel.app / production / READY |
| Commit | `3a2332b73dc2b0efe468fd74a294813c8615d156` |
| Deployment | `dpl_5n2nZMZvj9ENNMX3Y4dA5ugSothY` |
| Framework / region / build | Next.js 16.3.4 / Singapore `sin1` / about 55 seconds |
| Authenticated local validation | 816 full-matrix + 144 post-sync focused samples passed |
| Published stylesheet validation | 100 samples passed across 25 sizes, both themes, browser/PWA emulation |
| Health | HTTP 200, database up |
| Runtime error scan | No error/fatal logs found for the new deployment |

The live probes verify the actual published stylesheet and health. Authenticated captions
and viewer interactions were verified locally with synthetic data; production accounts
were not modified. Temporary test database/storage/logs have been removed. Native-device
Safari, keyboard and safe-area verification remains distinct from emulation.

Post-fix screenshots and results: `C:/my/projects/k/Date_Calendar/.screenshots/responsive-photo-fixes/`.

Audited source: production commit `5bd1a57cf409eb369639985b59867bee40de5b24`. Public pages were checked on the live Vercel alias; authenticated and onboarding states used this source in an isolated local checkout with synthetic accounts and records. No production accounts were changed and no product changes were deployed by this audit.

## Viewport coverage

25 configurations, specified in CSS pixels:

| Group | Width × height |
| --- | --- |
| Narrow and standard phones | 320×568, 360×640, 375×667, 390×844, 414×896, 430×932 |
| Responsive boundaries and tablets | 639×900, 640×900, 767×1024, 768×1024, 820×1180, 1023×900, 1024×900 |
| Desktop, ultrawide and 4K | 1280×800, 1440×900, 1535×960, 1536×960, 1920×1080, 2560×1440, 3440×1440, 3840×2160 |
| Landscape | 640×360, 844×390, 1024×600, 1180×820 |

Additional short-landscape profile checks: 568×320, 667×375 and 896×414. Selected browser/PWA, desktop pointer and light-theme variants are checked separately.

## Confirmed defects

### 1. Completed-date result caption is cropped on narrow phones

At 320px, a valid long date title and venue line make the photo caption taller than the image area. “The result” is hidden and the top of the title is cut off. At 360px, the small label is still clipped in the tested content.

Reproduction content: “An afternoon of coffee, conversations and little discoveries” at “The Courtyard Café & Contemporary Indian Kitchen”, Bengaluru. Both are realistic, valid values.

Cause: `src/components/dates/date-result.tsx:59` fixes the photo to a 2:1 ratio, while the caption at line 67 is absolutely positioned. The enclosing section at line 50 hides overflow.

Suggested correction: allow the narrow-screen hero to grow with its caption, or keep the caption in normal layout flow while retaining its photo and gradient styling. Verify with long titles and venue/address lines at 320px and 360px.

At 320px, the label starts 32.5px above the card and the title starts 16px above it. At 360px, the label starts 12.5px above the card. The tested caption fits at 375px and above.

Evidence: `C:/my/projects/k/Date_Calendar/.screenshots/responsive-audit-extras/completed-result-320.png` and `completed-result-360.png` in that folder.

### 2. Memory hero clips its date-order caption

At 320px, the small “Our 2nd date” caption is partially cut off above the memory title with a long venue line.

Cause: `src/components/memories/memory-detail-view.tsx:24` fixes a 3:2 hero ratio; the caption is absolutely positioned at line 32, with `DateOrdinal` at line 33, inside an overflow-hidden container at line 16.

Suggested correction: give the caption enough content-driven height on narrow screens and verify the ordinal, title, date and venue remain visible together.

At 320px, the ordinal starts about 5.3px above its card. It fits at the tested 360px and wider sizes.

Evidence: `C:/my/projects/k/Date_Calendar/.screenshots/responsive-audit-extras/memory-hero-320.png`.

### 3. Photo-viewer controls have weak contrast in dark mode

The photo-wall lightbox renders white text and controls over a pale backdrop in dark mode. This makes the counter, close icon and lower action labels difficult to distinguish. It is a theme/readability defect observed during this audit, rather than a width-specific overflow defect.

Cause: `src/components/memories/photo-wall.tsx:207` uses `bg-ink/95`, but the dark theme makes the ink token pale; the controls remain white. The date-gallery lightbox uses the same background pattern in `src/components/dates/photo-lightbox.tsx:237`.

Suggested correction: use a dedicated backdrop token that stays dark for photo viewers, or pair the backdrop with a matching foreground token in both themes. Verify both viewer variants and both themes.

Evidence: `C:/my/projects/k/Date_Calendar/.screenshots/responsive-audit-local/photo-lightbox-320.png`.

## Results and limits

Completed 1,971 screen/viewport samples: 290 on live public screens, 1,593 in the main isolated audit and 88 focused follow-up samples. There were zero page-level horizontal-overflow samples, zero measured clipped control labels, zero unexpected blocked-primary-navigation samples and zero uncaught browser errors. Text clipping inside photo heroes is a separate failure, confirmed by measurement and screenshots as described above.

Covered public auth/recovery/verification/offline/404/style screens; Home; calendar/history/upcoming; Explore and place details; all four planning steps; draft/planned/today/active/completed/cancelled date views; recap and review form/reveal; memory editor, detail, timeline, favorites and photo wall; couple and notifications; every settings page; confirmation modal, place-picker sheet, account menu and photo-wall lightbox; profile/connect/couple/done onboarding and invitation states; unverified-account and fresh-couple empty states; selected standalone/PWA, desktop pointer, light-theme and archive-file-preview variants.

The desktop sidebar/bottom-navigation transition is correct at 1024px. Core page layouts fit the measured widths. The two caption-cropping defects and photo-viewer contrast issue existed in the original `5bd1a57` audit; they are resolved by the verified production release above.

The automated audit uses Chromium touch emulation and emulated standalone display mode. It samples breakpoint boundaries and representative device sizes; it does not test every possible pixel width or certify physical iOS/Safari keyboard, safe-area or browser-zoom behavior. Native phone testing remains separate.

Raw evidence is retained in `C:/my/projects/k/Date_Calendar/.screenshots/responsive-audit-summary.json`, `responsive-audit-local/results-combined.json`, `responsive-audit-live/results.json` and `responsive-audit-extras/results.json`. Test photos were synthetic placeholders; provider-photo quality was outside this layout audit. Archive preview was inspected without sending approvals or restoring records.
