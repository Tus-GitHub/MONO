# Mobile calling: controls and platform limits

The call UI uses a full-viewport stage, a floating self-preview, labelled circular controls,
and green pickup / red decline and hang-up actions. The remote view defaults to **Fit** so
screen content is not cropped; **Fill screen** deliberately crops to fill the available view.
Audio remains on a separate persistent player when the call view is minimized.

## Free PWA compatibility playback

The Audio menu detects both media-element and Web Audio output selection at runtime. It does
not whitelist browser versions. Refresh outputs re-enumerates real devices after headphones
or Bluetooth change. Missing built-in speaker/earpiece routes cannot be invented by the app.

**Try compatibility audio** is an opt-in experiment for an exposed route that fails to change
sound. Where available it sends the remote audio through `AudioContext.setSinkId`, keeping
the original player muted so there is only one audible output. Otherwise it re-renders the
remote audio into a local Web Audio MediaStream for the existing audio element to route.
The latter is an inference from WebKit's separate remote/local renderer behavior, not a
verified fix on the user's iPhone. WebKit bug 320087 was fixed upstream in July 2026; that
does not establish which installed Safari builds include the fix.

**Use normal audio** restores the original player. Failed setup rolls back; pending setup is
bounded and cancelled on hangup. Generated tracks/context are released, while incoming peer
tracks and the microphone are never stopped by this playback helper. Compatibility mode lasts
only for the current call and remains owned by the persistent call player when minimized.
Physical audibility, echo cancellation quality and actual speaker/earpiece route still need
testing on each phone. A resolved `setSinkId` promise is only an accepted browser request.

Do not use `navigator.audioSession.type = "playback"` as an in-call speaker toggle: the Audio
Session specification permits ending microphone capture for types other than auto or
play-and-record. No capture/session-mode or permission bypass is used here.

Sources: [Web Audio output routing](https://developer.chrome.com/blog/audiocontext-setsinkid/),
[WebKit routing fix](https://github.com/WebKit/WebKit/commit/bdaffe35a57ea067f07b46dd45ba29a1c0557afd),
[Audio Session microphone integration](https://www.w3.org/TR/audio-session/#microphone-mediastreamtrack).

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
