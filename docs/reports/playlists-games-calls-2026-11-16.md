# Personal soundtrack, game chat and movable calls

This follow-up supersedes the text-based return-to-call control from 40c823e.

- A minimized video is its own return control. Drag it with touch or a mouse, or move it with arrow keys; tap to expand. Voice calls retain a compact header icon. The same media elements and connection remain mounted.
- Supported browsers offer native video picture-in-picture, with a guarded WebKit fallback and Chromium's optional automatic PiP media-session handler. Unsupported/denied requests leave the call intact. This cannot keep a web call alive after the app/browser process is terminated or guarantee OS-level background calling on every Android/iOS device.
- Winners see a trophy and confetti, losers a sad rain-cloud animation, and both players in a draw see a playful result. Reduced-motion settings show static artwork. Existing scores/rematch handling remain authoritative.
- Game chat shows a direct message feed/composer. It retries failed signaling automatically, reconnects on network/foreground recovery, and resends unacknowledged transient messages with ID deduplication. Text remains in browser memory and the encrypted peer data channel; no stored-chat fallback was added.
- Background volume uses a `volume^2.4` gain curve: 2% maps to approximately 0.000084 gain and 20% to approximately 0.021. Gain is set before playback to avoid an initial loud burst. Ringtones and call audio use their existing volume paths.
- Admin uploads add multiple songs, up to 10 MB each, retaining existing songs. Each user has a persisted volume, playback preference, all/selected playlist, order and repeat-one setting. Deleted tracks are filtered out without silently enabling other songs in selected mode.
- The additive `20261117000000_personal_music_playlists` migration adds only personal preference columns; existing audio rows and encrypted song titles/bytes are preserved. Music metadata queries omit audio bytes. Admin authorization is rechecked in write transactions.
- Help copy uses Android/iOS rather than a particular phone brand. Availability still follows exposed browser APIs; text changes do not unlock screen capture or earpiece routing.

## Verification record

- 26 focused unit checks passed for the gain curve, playlist ordering/filtering, drag bounds, PiP fallback/denial, call controls and notification recovery.
- Six local PostgreSQL audio tests passed, including independent account preferences, encrypted titles/bytes, admin-only publishing/removal, a full 10 MB chunked upload, idempotent retry and ranged playback.
- The first 10 MB test exceeded its former 60-second suite budget during host resource pressure. After disposing of generated QA video files, the full test passed in approximately 50 seconds with a 120-second harness allowance. Production request limits were not increased.
- The earlier live call attempt on 40c823e timed out before connection. A second run was interrupted by host memory pressure. All four disposable accounts and two spaces from those attempts have been removed. Neither attempt is claimed as a live pass.
- Final production build passed after merging the separately published admin ratings update (99 routes, largest trace 27.37 MiB). Focused ESLint and TypeScript passed.
- Local browser checks: six music-library groups passed in `.postgres-test/e2e/4e5d4aa1e1865425`; nine game groups and seven call groups passed in `.postgres-test/e2e/debf5bbb9c3801f3`. These cover persisted independent preferences, multi-upload/removal, auto-next, forced signaling failure/recovery, two-way transient messages, real rematch/draw, result artwork/reduced motion, touch/keyboard dragging, stable media elements, audio energy/video frames in both directions, Back/navigation and hang-up. No uncaught browser errors. Local test accounts/spaces were removed.
- A first game run reached the drawn rematch but held an obsolete board element while a move rerendered it. The test now waits for the current enabled square; the complete rerun passed.
- Publication and live verification are pending at this checkpoint.

## Browser references

[Chrome automatic PiP for video calls](https://developer.chrome.com/blog/automatic-picture-in-picture) requires browser support, an active capture session and allowed browser settings. [MDN's Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API) documents limited availability. These references do not establish physical-phone compatibility for MONO.
