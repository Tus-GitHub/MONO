# Call header and minimized video

The chat header replaces the voice/video start buttons with **Return to call** during an existing call. The former bottom return banner is removed. Other app pages retain a top-right return control.

Closing X, pressing Escape or using browser/system Back minimizes the active video dialog into an in-app window. Its video elements and persistent remote audio remain mounted, and its peer connection and capture tracks are unchanged. Tapping the mini view restores full screen; its round red phone button ends the call. The window releases modal focus/scroll locks so chat remains usable, and stays above the composer across tested layouts. In-app navigation retains the call.

This follows the minimize-and-continue-chatting pattern in [WhatsApp's call help](https://faq.whatsapp.com/1862285217468140/). It does not add native system picture-in-picture outside MONO or background execution guarantees.

## Validation

- 32 focused call-control, media, track and deadline unit checks passed.
- Focused ESLint and the final production build passed (99 routes, largest function trace 27.36 MiB), including the round hang-up button and audio-menu persistence.
- `npm run test:e2e -- callMinimize` with the production build and local PostgreSQL passed six groups in `.postgres-test/e2e/0daf59e5cad91d1e/results.json`.
- Two isolated users use real signaling and WebRTC, with generated moving frames and audio tones. Inbound audio energy and decoded video frames increase after minimization; both microphones remain enabled/live and peer connection counts do not increase.
- X, header return, Back, mini expansion, in-app navigation, mini hang-up and voice-only return passed. Existing player DOM nodes remain identical after minimize/restore.
- Layout checks cover 320px mobile, 844x390 landscape and 1440px desktop; the mini window remains above the message composer. Typing works while minimized.
- Two disposable local accounts and their space were removed. The first run's about:blank test-helper errors were fixed and its separately prefixed fixtures cleaned; that run is not recorded as a clean pass.

Physical iPhone/Samsung audio output and native OS picture-in-picture have not been tested by this browser suite.
