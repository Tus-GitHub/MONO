# Slow network and call handoff recovery

The user requested slow-internet and Wi-Fi/mobile-data handoff testing for normal chat, game chat and active calls.

## Repair

Call signaling previously rejected any second offer/answer, and the client ended disconnected calls after 15 seconds. The client now performs bounded ICE renegotiation on the existing peer after network-change/online events or a disconnected/failed transport. The caller remains the sole offerer; the authenticated receiver can request recovery. Duplicate SDP retries return the existing result, overlapping offers are rejected, and recovery requests/offers are rate-bounded. No new call, notification, permission request, microphone capture or database migration is created.

The transport gets up to 60 seconds to recover. Repeated polls and failed-state events do not extend that deadline. Hang-up cancels recovery. Early new-network ICE candidates wait for their corresponding SDP; stale candidates are ignored. Existing microphone, camera and shared-screen senders remain attached. Transient candidate-post failures no longer immediately hang up a working call.

## Local verification

- 13 focused unit tests passed for deadline/recovery scheduling, offline waits, cancellation, retry bounds, early ICE candidates and track negotiation.
- All 38 together-service integration tests passed, including participant isolation, duplicate signaling, accepted-call renegotiation, overlap rejection, notification behavior and ended-call rejection.
- ESLint, TypeScript and the production build passed (99 routes, largest local runtime trace 4.09 MiB).
- Six browser groups passed in `.postgres-test/reconnect-fix/.postgres-test/e2e/ba04e8223b1e3689/results.json`. Normal encrypted messages delivered both ways at 400 ms latency, 512 kbps down/128 kbps up. After an offline gap, received messages caught up and the failed outgoing draft remained available for one explicit resend, with no duplicate database message.
- Standalone game chat delivered its pending message exactly once after a 20-second interruption; no game-text database record was created.
- Caller-side and receiver-side call interruptions each used 100% WebRTC packet loss and offline HTTP. Received audio packet counts were checked to confirm the interruption was real within the emulation. On restoration, ICE credentials changed, the original peer/call ID and microphone track IDs remained, and received audio energy increased on both sides. Queued in-call game text arrived. No uncaught browser errors; disposable local accounts/space removed.

## Limits and references

These tests use Chrome network/packet-loss emulation and generated microphone audio. They do not change an actual phone's Wi-Fi/cellular interface or test carrier NAT, OS suspension or physical earpiece routing. Audio necessarily pauses while every packet is dropped. Calls cannot remain connected indefinitely without network access. Normal messages attempted while fully offline retain an explicit retry draft; this is not a new automatic offline outbox.

[Chrome DevTools Network protocol](https://chromedevtools.github.io/devtools-protocol/tot/Network/) documents bandwidth/latency/packet-loss emulation. [MDN ICE restart](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce) describes renegotiating ICE for network recovery.

Production publication and live verification are pending.
