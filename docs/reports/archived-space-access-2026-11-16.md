# Account closure and archived-space access

Account closure preserves the user ID and saved content. It retires the login mailbox to an unpredictable placeholder, releases the original email, removes the password and OAuth credentials, revokes sessions, and disables reset/verification/push capabilities. Personal avatar and music rows remain. Self-deletion and admin deletion use the same transaction. Re-registering, including through Google, creates a new identity with no old memberships or archive grants.

The former couple remains archived with inactive memberships. Only its verified, living original member can request access after the other account is deleted. The admin's **Archive access** panel supports approval, denial and revocation, with an append-only decision list and internal notifications. Admins see request/account/couple identifiers; approval does not give the admin permission to read the couple's content.

The approved partner's separate viewer exposes saved dates and events, previously revealed reviews and venue scores, memories, date photos, expenses, places, encrypted chat attachments, game results and call history. It is read-only and never reactivates the couple. All existing write guards still require an active couple. Hidden messages, deleted items, unrevealed partner reviews and exhausted photo-view allowances remain inaccessible.

Chat is still end-to-end encrypted. The original member needs their existing device key or recovery code; neither the admin nor a replacement account can recover it. Grants are checked on each read and media request, after external file reads, when returning to an open viewer, and periodically while it is visible. The viewer locks on failed authorization/network validation. Already downloaded copies cannot be recalled. The PWA service worker continues to exclude private HTML, API and media responses from its cache.

Retention here applies to closing an account. Existing explicit content-deletion actions and routine expired-transient-data cleanup keep their existing behavior.

The active app also checks membership on every screen, including Chat and games. A definitive loss of access unmounts private content and calls and replaces the page with the archive request screen (or login for an expired session), even while typing. Temporary network/server failures do not interrupt the app.

## Verification

- Isolated local PostgreSQL: 61 focused checks across account controls, name/email policy, moderation, archive permissions and existing encrypted chat/video flows passed. The expanded archive suite then passed 11 checks, including alias release, token retirement and revocation during video storage reads.
- 33 focused unit checks passed, including existing blind-review policy and database transaction behavior.
- A real concurrent-signup test exposed an unwrapped `TransactionWriteConflict` from Prisma's pg adapter at COMMIT. Retry now recognizes that specific adapter error; a failed commit releases its connection exactly once. The real concurrent-signup regression passes and disconnect no longer hangs.
- Right-panel localhost browser: surviving partner requests; independent admin approves; dates with cafe/movie, both revealed reviews, Memories, date photo, retained avatar/cover, encrypted chat text/photo and remembered device key open; admin revokes; the open chat locks without reloading; replacement account has no eligible old space.
- Final right-panel check: an active Chat containing decrypted messages and a focused unsent draft automatically unmounted and navigated to the locked archive request screen when the isolated fixture transitioned to account-closed/archived. No manual reload was used. The final build and focused guard lint pass; the merged archive/Together suite passes all 49 checks, retaining the latest call-recovery changes.
- Layout inspected at 320, 390 and 1440 CSS pixels; no horizontal overflow. No physical iPhone/installed-PWA claim is made by these checks.
- Proof images: `.screenshots/archive-admin-mobile-2026-11-16.jpg`, `.screenshots/archive-chat-mobile-2026-11-16.jpg`, `.screenshots/archive-chat-desktop-2026-11-16.jpg`, `.screenshots/archive-revoked-mobile-2026-11-16.jpg`.
- Neon migration preflight: `br-lively-math-b329pbdl`, migration `be48591d-f678-4837-9892-72646428c88e`; 6 existing users retained, 4 request indexes, 3 restrictive foreign keys and both email uniqueness protections. Cleanup requires the separately requested explicit approval.

Production deployment verification is recorded in `memory.md` after release. No existing production user was deleted to test this feature.
