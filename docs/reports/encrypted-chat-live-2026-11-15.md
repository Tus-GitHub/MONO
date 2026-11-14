# Encrypted chat production verification — 15 November 2026

Published `6810807eac6128be96b1a59f11cd812260c30c32` to `origin/main`.
Production deployment `dpl_AthShWpFLnhxwWLnDpVDDazjm94o` is READY on
https://mono-kappa-beryl.vercel.app. The configured deployment build runs the additive
encrypted-chat migration before assigning the canonical domain. Health returned HTTP 200
with the database up; the new live endpoints and encrypted-chat fields were exercised.

Pre-release checks: 529 unit tests, 188 isolated PostgreSQL integration tests, TypeScript,
full ESLint and production build passed. The final focused chat/security run passed 46 tests.
The publication build passed again before commit/push. Vercel's production build completed;
its largest runtime trace was 44.53 MiB, below the repository limit.

## Live browser results

Used two retained, disposable QA partners in isolated headless Chrome 157 contexts, with
desktop and 390px phone viewports. Authentication used the normal live login action; no
session was forged and no real couple's messages or keys were accessed. The synthetic QA
recovery code remains in ignored local fixture storage, never in this report or the API.

All nine flow checkpoints passed:

1. Both partners unlocked chat with the same private recovery code.
2. A new text message arrived and decrypted in the partner's UI. Its outbound request and
   subsequent API readback contained ciphertext rather than the plaintext test sentence.
3. An author edit reached the partner, carried Edited metadata and survived reload using
   the persisted device key. The partner had no Edit or Delete-for-everyone control.
4. Delete for me hid the message after reload, including the server's user-specific hidden
   marker; the sender's copy remained visible.
5. Delete for everyone removed the text from both views and persisted a deletion marker.
6. A synthetic View-once photo was uploaded through the crop/confirmation UI, decrypted and
   displayed once. GET preview was denied; additional POST access was denied after viewing
   and after reload. The stored view count remained 1.
7. A View-twice photo displayed twice, then further access was denied, including after reload.
   The stored view count remained 2. Sender access did not consume a recipient view.
8. Deleting a regular encrypted photo for everyone made its protected media endpoint return 404.
9. Chat had no horizontal document overflow at 320, 390 and 844px widths. The final run recorded
   no application JavaScript errors.

A separate follow-up passed two more checkpoints: after the entrance animation settled,
the phone photo viewer and Close photo button fit in the viewport; a fresh authenticated
page still reported the deleted photo as deleted with no media. The decrypted synthetic
photos had the expected 360×240 dimensions and were rendered from client-created blob URLs.

Final flow evidence is in ignored `.postgres-test/chat-security-live/cbd4ca1495/`.
Settled-viewer evidence is in `.postgres-test/chat-security-live/4e005b4ea0/`.
Both successful runs revoked their temporary sessions through the authenticated session API.
Existing QA accounts/history and the explicitly tested remaining photo/message records were
retained. No real user history was migrated or deleted.

## Earlier attempts and limits

Earlier runner attempts are retained as failures, not included in the passing count:
network-idle navigation did not settle; an immediate reload raced a closing menu's synthetic
Back-history entry; one attempt stalled at login readiness; and one had a transient fetch
failure with the existing recoverable live-update warning. The runner was changed to wait
for actual controls/API results, wait for overlay history cleanup before reload, use normal
HTTP sign-in for fixture authentication, and retry only a failed read-only login-page GET.
No application-code change was necessary to obtain the passing run. Screenshots taken
during entrance animation are not treated as settled layout evidence.

These are actual live Chromium browser flows with emulated phone widths, not physical
iPhone/Samsung installations or native-keyboard testing. No independent cryptographic audit,
forward secrecy or screenshot/recording prevention is claimed. PWA screenshot attempts
cannot be reliably detected, so no fabricated secret alerts are sent.

Existing real-user history requires recovery-code setup and **Secure existing history**;
deploying the schema alone does not encrypt historical plaintext or erase old backups.
