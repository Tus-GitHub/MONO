# Mobile calling: controls and platform limits

The call UI uses a full-viewport stage, a floating self-preview, labelled circular controls,
and green pickup / red decline and hang-up actions. The remote view defaults to **Fit** so
screen content is not cropped; **Fill screen** deliberately crops to fill the available view.
Audio remains on a separate persistent player when the call view is minimized.

**Audio** lists actual outputs returned by the browser and uses `setSinkId`. Where supported,
**Choose audio device** invokes the browser's `selectAudioOutput` picker from a user gesture.
No invented speaker or earpiece identifiers are used. A phone can keep those routes under OS
control even if the browser supports external devices. A successful API response alone does
not prove the physical output changed; listen on the actual device.

**Share** invokes `getDisplayMedia` directly from the click. Missing support is explained in
the call UI, rather than presenting an ineffective permission switch. Capture denial, absent
sources, unreadable sources, paused tracks and ended tracks have distinct feedback. An ended
screen track restores the prior camera sender without ending the voice call. Sharing does not
capture system audio. The app's Permissions-Policy already allows same-origin display capture.

The browser/OS chooses the permitted capture surface. If it supplies only a tab/window,
MONO cannot widen that to other apps. Phones may suspend capture when changing apps or locking.
Whole-device background capture is not guaranteed by an installed PWA. Native support would
be a separate Android/iOS implementation and release, not a permission setting in this web app.

## Release verification (2026-11-14)

User explicitly prohibited browser testing; no browser automation, camera/microphone capture,
or live test calls were performed for this release. Node unit tests cover media lifetimes,
screen capture errors, actual audio-output routing, and iPhone visual-viewport focus behavior.
Physical iPhone/Samsung audibility, keyboard behavior and UI appearance remain user testing.

On phones, reload the update, type and rotate, then test voice in both directions, available
audio outputs, video upgrade, Fit/Fill and screen capture. If capture stops when leaving MONO,
record OS/browser version and the source offered by the system picker.

## References consulted

- [WhatsApp calling UI and features](https://www.whatsapp.com/calling)
- [Screen capture API and user activation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [Browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/MediaDevices.json)
- [Audio output selection](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput)
- [Audio device routing](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId)
- [WebKit single-track audio routing report](https://bugs.webkit.org/show_bug.cgi?id=320087)

Compatibility data is advisory. Runtime capability detection remains authoritative for
offering capture; a real capture attempt can still fail due to OS support or policy.
