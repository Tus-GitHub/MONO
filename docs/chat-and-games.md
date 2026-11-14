# Private chat and arcade

`/chat` belongs to the current connected, verified two-person space. It includes text,
emoji, eight original sticker cards, image sharing, voice/video calling, game invitations,
and a persistent scoreboard. This is partner messaging, not an AI assistant.

## Playable games

The 24 games are Tic-tac-toe, Connect Four, four-token Ludo, Gomoku, Reversi,
Dots & Boxes, Nim, Race to 21, Pig Dice, Rock Paper Scissors, Memory Match,
Mini Battleship, Chess, Checkers, Snakes & Ladders, Mancala, SOS, Order & Chaos,
Hex, Domineering, Chomp, Breakthrough, Pentago and Higher or Lower.

Each invitation needs the other partner's acceptance. The server enforces legal moves,
turns, version conflicts and results. Dice, deck, fleet and secret-number randomness come
from Node's cryptographic RNG. Private choices/cards/ships/numbers are redacted before
responses. Completed matches count exactly once as a win/loss or draw; a resignation awards
the partner a win. Cancelled/declined invitations do not count. A space can have five
unfinished matches, and the latest 15 closed matches appear alongside them. Earlier games
remain accessible from their chat messages. Aggregate scores include all completed matches.

Rules are available in every match. Some use compact variants: Reversi is 4×4, Gomoku is
9×9, Battleship is 5×5 with two automatically placed ships, and Hex is 5×5. Ludo has four
tokens per partner, six to enter, exact rolls to finish, safe squares and capture/finish/six
extra turns; it has no blockades or three-sixes penalty. These variants are stated in the UI.
Chess legality uses the BSD-2-Clause licensed `chess.js` 1.4.0 package.

## Persistence, privacy and limits

Migration `20261114130000_couple_chat_arcade` adds messages, separate image blobs, presence,
game matches and call signaling to the existing PostgreSQL database. No additional paid
service or provider account is required. Existing hosting/database/network quotas apply.

Images are checked by byte signature and re-encoded by the existing Sharp pipeline, with
a maximum stored size of 512 KiB per image and 25 MiB per couple. The browser previews the
chosen image and sends only after an explicit Send image click. Images are served through
an authenticated, couple-scoped endpoint with private no-store headers. Polling never selects
blob bytes. Messages are paged in batches of 60 and use sender-scoped retry nonces. Message
sends are limited to 90/minute per sender; image uploads also use the existing upload guard.

Incremental HTTP polling pauses in hidden tabs and backs off when idle. It is not a
WebSocket/push service: both partners must have MONO open for live conversation and incoming
calls. The header supplies an unread badge throughout the authenticated app. Chat data is
access controlled but is not end-to-end encrypted. Existing planner portable archives (v1)
do not include chat/game history or chat image blobs; use a complete database backup to
back up these records. Restoring a planner archive into a space containing new chat/game/call
history is blocked to avoid overwriting an occupied space.

## Calls

Calls use browser WebRTC with authenticated, bounded database signaling. Device access is
requested only after Start/Answer. Cancellation, denied/ignored permission, connection failure,
hang-up and unmount clean up media tracks and peer connections. A permission request has a
30-second deadline; peer connection setup has a 40-second deadline. Abandoned ringing calls
expire after 60 seconds; accepted calls expire if either heartbeat becomes stale. Old
signaling is removed on subsequent call/status requests, and hang-up removes it immediately.
Audio/video is sent peer to peer and is not recorded by MONO.

The supplied `Anywhere With You` MP3 loops on outgoing and incoming ringing at 45% volume.
It stops when answered, declined, ended or the component unmounts. If autoplay is blocked,
the call dialog offers **Play ringtone**. The audio is fetched only while ringing.

Either partner can switch an accepted voice call to video without hanging up. Voice calls
reserve an empty video transceiver; the answering partner reuses the offered transceivers.
Switch to video requests only the local camera and never opens the partner's camera.
Camera off stops that camera track. Share screen opens the browser's explicit display chooser
and replaces the outgoing video with the selected tab, window or screen. Screen audio is off;
microphone audio still follows Mute. Stop sharing, browser Stop sharing, hang-up and unmount
stop the captured screen tracks; stopping sharing restores the previous camera when present.
Media changes are serialized, cancellable and bounded; permission rejection leaves voice intact.
Screen sharing requires browser support and is generally a desktop feature; unsupported browsers
show an explanation and keep the call running. Real-device media verification remains pending.

The default ICE server is public STUN. Some mobile, enterprise or restrictive networks need
a TURN relay; universal connectivity without one cannot be guaranteed. Optional server-only
`COUPLE_ICE_SERVERS` accepts an RTCIceServer JSON array, for example:

```json
[{"urls":"stun:stun.example.org:3478"},{"urls":"turn:relay.example.org:3478","username":"configured-user","credential":"configured-secret"}]
```

Use your relay's real configuration and pricing/quotas. Credentials are returned only to
authenticated connected partners. HTTPS and microphone/camera permission are required;
loopback is a browser secure-context exception for local development. Permissions-Policy
allows microphone, camera and display capture on this origin. Cross-device audio/video and restrictive-network
TURN connectivity still need a real-device check before claiming universal calling support.

## Verification

The isolated database suite covers all 24 invitation/move paths, message retry races,
pagination catch-up, hidden state, read receipts, image scope/quota, revoked membership,
concurrent results, score integrity and call signaling/expiry. Unit tests play all 24 games
to terminal outcomes and cover media permission deadline/cancellation/late-stream cleanup.
See `docs/testing.md` for the dated browser and build evidence.
