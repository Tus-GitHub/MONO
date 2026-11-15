# Games navigation, recent matches and in-game chat

The Games button opens a dedicated game room. Partners can invite, accept and play a match,
open their encrypted conversation while the board continues updating, and return to the same
board. Play shows matches active in the last 60 minutes; History retains all matches and
Scores keeps the existing aggregate results.

## Implementation

- Direct header and sidebar Games links, separate from Chat. The mobile header uses the
  existing compact MONO mark to retain touch targets with all controls present.
- Recent matches use server-observed time and last activity, with an inclusive one-hour
  boundary. Older open matches remain available from History and have a reminder on Play.
- Authenticated history uses couple-scoped, stable keyset pagination, 30 matches per page.
  Existing game DTO redaction protects hidden opponent state. No schema migration is needed.
- Dedicated match URLs restore older games. A full-screen chat overlay reuses encrypted
  messages, attachments and the existing keyboard/scroll behavior. The game stays mounted
  and polls while the overlay is open. Messages also appear in the ordinary Chat screen.
- Closing chat returns to the board without a reload. Opening another game from a chat card
  waits for the overlay's browser-history entry to close before navigating.

## Validation before release

- Scoped ESLint, type checking and the full production build passed.
- 19 focused unit checks passed: viewport, focus handling, message merging and game lists.
- 37 database integration checks passed on an isolated local PostgreSQL database, including
  the one-hour boundary, history pagination, old open matches and cross-couple cursor rejection.
- Chromium and WebKit each passed 29 two-partner browser checks (58 total). These cover direct
  navigation, old matches absent from Play, invite/accept/moves, board updates behind chat,
  encrypted messages both ways, latest-message visibility, retained focus, portrait/landscape,
  closing chat, completing the match, History, pagination, opening older invitations, Scores,
  shared messages in Chat, and widths 320, 360, 390, 768, 844, 1024 and 1440.
- Chromium's simulated standalone context used an activated service worker. Both engines
  reported zero page errors; each run's two test sessions were revoked. Synthetic records
  remain, as requested. The history test was corrected to wait for pagination rendering
  before attempting another click; no application pagination defect was found.

Viewport/keyboard geometry and standalone mode are simulated. WebKit uses a transport relay
with service workers blocked on Windows. These checks do not certify physical iPhone keyboard
or native installed-PWA behavior.

## Production release

Pending deployment and live checks.
