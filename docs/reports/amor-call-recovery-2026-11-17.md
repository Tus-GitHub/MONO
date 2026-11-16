# AMOR call recovery and readable branding

The compact logo previously omitted A and R and therefore read as Mio. All app icons and compact placements now retain the full AMOR name, with the dotted right stem of M keeping the hidden Mio detail. Decorative placements use the full wordmark's proportions. On phones below the existing 360px breakpoint, Explore remains accessible in the account menu, leaving room for AMOR and music controls. Service-worker v9 refreshes branding after the user's Refresh action; stored keys and preferences are untouched.

Call signaling previously compared browser descriptions byte-for-byte. A late retry after ICE gathering could insert an already-answered offer again and reject the next restart with HTTP 409. The client now retains the exact offer/answer originally sent and the received description, rather than retrying a browser-mutated SDP. Server duplicate detection ignores candidate-only additions while retaining session version, ICE credentials, media directions/codecs and fingerprints. Authorization, offer ordering, restart throttling and the existing peer/media tracks remain intact. The WebRTC specification describes how [local and remote descriptions acquire candidates](https://w3c.github.io/webrtc-pc/).

## Verification before release

- 652 unit checks pass across the full run and corrected service-worker expectation rerun; eight new SDP identity cases distinguish retries from real renegotiation.
- 38 isolated Together database checks pass, including a late enriched offer/answer retry followed by a new restart.
- Production build passes: 106 routes; largest runtime trace 4.11 MiB. Changed-file lint passes. Full lint has only the pre-existing date-time-input ARIA warning.
- Live AMOR: wrong-password rejection, valid login, space creation, invitation signup, verification gate, real email verification, successful joining/onboarding, used-invite rejection and subsequent partner login passed. Disposable accounts, space and inbox removed.
- Ordinary live voice/video/minimize checks passed seven groups with two isolated browsers and generated audio/video, including measured inbound audio energy and frames. These are real WebRTC tests, not a claim of physical iPhone/Android hardware routing verification.
- Network test initially exposed intermittent signaling conflicts; those failing runs are diagnostic evidence, not passes. The final production-bundle run passed six groups with zero signaling HTTP errors: slow chat at 400ms latency/512kbps down/128kbps up, normal-chat offline recovery, standalone game-chat recovery and 20-second HTTP plus 100% WebRTC packet loss on caller then receiver. Both directions retained the peer and microphone tracks, resumed measured inbound audio and delivered queued messages once. Seven voice/video/minimize groups also passed. Artifacts: local run `5b46dd9a820e9c75`.
- Responsive wordmark checks with music controls visible passed at 320/360/390/768/1440px with no page/header overflow. The 320px screenshot and generated 512px app icon were visually inspected.

## Existing history

Production queries were explicitly read-only. After fixture cleanup, 54 retained message rows existed, including one deleted message. The remaining 53 encrypted records contain 44 valid nonempty encrypted body envelopes and nine empty bodies for game/image payloads stored separately. Every nonempty body passed server-managed encryption authentication. All seven chat-image records passed outer authentication, ciphertext length and IV checks.

All three currently referenced profile/space photos are present in the production Neon private bucket, authenticated with the unchanged key and decoded as images in memory. No decrypted customer content was logged or written to disk. There are currently no DatePhoto rows or published video parts. The bucket inventory contains 12 objects. Initial local S3 settings pointed to a retired bucket; only the corrected Neon-backed audit counts as production evidence.

Private ciphertext digests were saved locally for an exact post-release comparison. Customer end-to-end messages were not decrypted: their private recovery keys remain client-held. Previous new-origin QA established that the original recovery code unlocks pre-release ciphertext and that old/new origins exchange encrypted messages. No database/schema migration, encryption format/key change, storage move or customer record mutation is part of this release.
