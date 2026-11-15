# Chat typing and sending verification — 2026-11-15–16

User story: both partners type and send encrypted messages with the composer focused,
the newest message visible, and the Chat shell anchored in phone browser and standalone layouts.

## Findings and implementation

- The live baseline recorded one composer blur, a disabled textarea and lost focus after
  one Send tap. Keep the textarea editable and prevent pointer focus transfer from Send,
  including repeated taps on its disabled/loading area.
  Do not try to reopen the keyboard with delayed `focus()` calls.
- Clear the submitted draft immediately while retaining edits made during the request.
  On failure, restore an untouched draft; otherwise preserve the previous message for
  retry alongside the newer draft. A synchronous request guard and the original client
  nonce prevent duplicate sends, including an acknowledgement lost after the server saved it.
- Pin own sends before paint. Observe the message content as well as the scrollport so
  asynchronous decryption and image expansion cannot leave the newest bubble below the view.
  Preserve the reading position when a partner replies while the user reads older messages.
- Chromium exposed a queued-scroll/decryption race with a longer existing history: new
  bubble height was being mistaken for scrolling away. Track upward movement separately
  and turn off native scroll anchoring inside the message list.
- Reserve visible space for the newest bubble, including short landscape and safe-area
  insets. Constrain large drafts/errors to the composer's own scroll area.
- WebKit exposed an additional long-draft issue: resizing reset the textarea to its first
  lines. Preserve its scroll position for earlier edits and reveal the end caret after sizing.
  Reveal focused fields locally when error/retry controls grow above them.
- Live retry checks revealed a transient textarea-measurement clamp: changing its height
  to `auto` briefly enlarged the message viewport, moving its scroll position despite
  unchanged final dimensions. An isolated Chromium reproduction showed a 42 px bottom
  gap. Hold the composer's height during measurement; the same reproduction then stayed at 0 px.

## Verification

- ESLint and 16 focused viewport/message-merge tests passed on the final implementation.
- Production build passed after incorporating the concurrent `b698dac` release: 89 route
  traces, largest 3.70 MiB. Shared local dependencies were upgraded to Next 16.4.6 during
  verification; the final deployment's own locked build and live checks also passed.
- Final local Chromium: 46 checks passed, including five ambiguous-send retry cycles;
  real service worker active, no page errors,
  both synthetic sessions revoked.
- Final local WebKit: 30 checks passed, no page errors, both synthetic sessions revoked.
- Final live Chromium: 46 checks passed, five retry cycles, real service worker active,
  zero page errors and both QA sessions revoked.
- Final live WebKit: 30 checks passed, zero page errors and both QA sessions revoked.
- Both runs retained composer focus with zero blurs and zero disabled-input mutations.
  Chat/document scroll remained zero; the newest-message gap stayed within 2 px when pinned.
  Checks include initial history decryption, multiline caret/earlier edits, repeated touch
  Send, typing a new draft during a slow response, partner replies, intentional older-history
  reading, landscape, safe areas, failed sends and idempotent lost-acknowledgement retries.

Normal messages use real authenticated APIs and encrypted persistence. Slow-response and
lost-acknowledgement cases hold real server responses; one explicit 503 case exercises a
failure before persistence. Test records are retained as requested, and each test session is
revoked after its run. No real user accounts or history are used.

Keyboard viewport geometry, standalone mode and safe-area values are simulated. Chromium
standalone checks use the real service worker. WebKit uses a transport relay (production
headers preserved; localhost alone omits HTTPS upgrading for the HTTP QA server) with service
workers blocked. This does not certify a physical iPhone keyboard or native installed-PWA behavior.

Initial production release `11f8dde` is READY. Live Chromium and WebKit each completed
30 checks, but the intermittent retry clamp prompted the final sizing fix above. A separate
stress run hit an external connection reset; its two QA sessions and the two cleanup
sessions were explicitly revoked. The final sizing fix passed 76 local checks after merging
the latest Chat UI, followed by all 76 live checks on the final deployment.

## Production release

- URL: https://mono-kappa-beryl.vercel.app
- Commit: `86f8d676e415227e4160e6db84d7e4c48b3bc74c` (initial focus/scroll changes: `11f8dde`).
- Deployment: `dpl_3dEYHnmxnDyrDKgbEoxkjuDjtLrF`, production, READY.
- The scoped 15-minute error/fatal runtime-log count query returned no groups during final QA.
- All four final live QA sessions were revoked; test messages/accounts remain as requested.
- Local QA server and Postgres were stopped; fixture data and the isolated local key were retained.
