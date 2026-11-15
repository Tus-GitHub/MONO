# Chat typing and sending verification — 2026-11-15

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

## Verification

- ESLint and 16 focused viewport/message-merge tests passed on the final implementation.
- Production build passed: 83 route traces, largest 3.68 MiB.
- Final local Chromium: 30 checks passed, real service worker active, no page errors,
  both synthetic sessions revoked.
- Final local WebKit: 30 checks passed, no page errors, both synthetic sessions revoked.
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

Production deployment and final results will be recorded after release.
