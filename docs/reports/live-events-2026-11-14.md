# Live multiple-event partner audit — 2026-11-14

Tested https://mono-kappa-beryl.vercel.app on READY production deployment
`dpl_HWqDkXPMokf7YNcfR5SQdk32o6W2`, commit `28cdeb039a085738f53eab44e291d043efbce2ba`.

Two newly provisioned synthetic verified users belong exclusively to `LIVE QA Events 7a9b30f6e0`.
All login, planning, start and upload operations used the live browser UI. Venue selection used
clearly labeled custom QA café/cinema venues; this audit does not revalidate external search coverage.
The user explicitly chose **Keep test records**. No existing account/date/photo was modified or deleted.

## Successful checks

- Chromium: owner phone browser, partner simulated standalone PWA.
- WebKit: owner simulated standalone PWA, partner iPhone browser profile.
- Both partners sign in; missing title and reversed end time prevent Continue.
- Evening defaults to 19:00–21:00; user can extend the parent date to 23:00.
- One saved date contains café 19:00–20:00 and movie 21:00–23:00, with distinct venues.
- Editor stays within viewport at 320×700, 390×844 and 844×390 landscape.
- Partner sees the start transition automatically without a document reload.
- Each partner uploads a real PNG from ongoing Memories. The other sees it without reload.
- Both photos survive navigation; the photo lightbox opens.
- Production SQL confirms two events, two photos, and two different uploaders for each successful run.
- Normal visible in-app WebKit PWA navigation across Home, Memories and Dates produced no page errors.
- Production error/fatal runtime-log query returned no entries during testing.

Successful dates: Chromium `cmwgcl4oq000djj08e1pooed4`; WebKit `cmwgcwhun0005l208s900afjk`.
The retained QA couple also has the first attempt with no photos and the desktop-update-interrupted
WebKit attempt with one photo. Four QA dates total, all IN_PROGRESS, five photos total.

## Test limitations and runner corrections

The first upload automation ran before the file handler hydrated; waiting for the actual React
onChange handler resolved that test race. The desktop update interrupted the first WebKit run.
The subsequent WebKit run completed all seven functional checks but its blanket zero-page-error
assertion flagged four background fetch access-control messages during forced document navigation.
A separate normal client-link navigation check had zero errors; a forced navigation immediately
afterward was interrupted by an outstanding navigation. These are runner navigation observations,
not evidence of a broken upload or partner flow. No application patch was justified by this audit.

Mobile and PWA checks are automated browser profiles, not physical iPhone/home-screen testing.
No new application deployment was needed; the verified production release remains live.

Local evidence: `.screenshots/live-events-7a9b30f6e0/` (Chromium/WebKit result JSON and
events/photo screenshots). Private fixture credentials remain in the ignored test directory.
