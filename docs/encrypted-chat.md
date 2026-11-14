# Encrypted chat

MONO encrypts text, stickers and chat-photo bytes on the sending device using Web Crypto
AES-256-GCM. The API accepts ciphertext envelopes; the database stores ciphertext, IVs and
delivery metadata. The receiving device decrypts after authenticated retrieval. No new paid
service or dependency is required. This is a shared-key design, not the Signal protocol.

## Set up and recover

1. One partner opens Chat, generates a random recovery code, saves it privately and confirms.
2. Share that code with the other partner outside MONO through a trusted channel.
3. The other partner enters the same code. A different code cannot replace the registered key.
4. On another device or after clearing site storage, enter the original code again.

The 256-bit code is generated with `crypto.getRandomValues`. HKDF-SHA-256 derives separate
content and public-fingerprint values with couple-specific salt. Only the fingerprint is
registered on the server. AES keys are nonextractable `CryptoKey` objects stored in IndexedDB,
scoped by user and couple. The recovery code is never sent to the API or saved by MONO.
Losing both the code and the devices loses access to encrypted history. There is deliberately
no server recovery, silent key replacement or password-based weak-key fallback.

Every encryption generates a fresh 96-bit IV. Authenticated additional data binds content
to the protocol version, couple, sender, client nonce and message kind. Image AAD also binds
the selected view limit. Authenticated API ownership checks govern who can edit or delete.

## Existing history

The schema migration is additive and does not pretend to encrypt existing plaintext on the
server. After unlocking, **Secure existing history** fetches legacy rows in small batches,
encrypts and locally decrypts/verifies them, then replaces the original body and image bytes
in one transaction. Image bytes and their original format are preserved, not recompressed.
Either partner may do this. Failed or interrupted migrations retain unconverted originals;
retry skips already encrypted rows. Version checks reject stale changes. Deleted messages
contain no body or image; game event labels are derived from game metadata rather than
stored as new plaintext chat content.

Until that step completes, remaining legacy rows are still plaintext and the UI says so.
Historical database backups, point-in-time recovery and previously downloaded copies may
retain old plaintext. Client migration cannot erase those external copies.

## Photo views and message controls

- Keep in chat, View once and View twice are explicit choices before upload.
- Limited photos have no preview byte URL in chat polling. GET refuses limited access.
  Explicit same-origin POST serializes consumption with deletion and current membership.
  Concurrent requests cannot exceed the recipient's one/two view allowance. Sender previews
  do not consume the recipient's allowance. The responses use `private, no-store`.
- A released response counts even if the network fails or the recipient closes before display.
  There is no automatic retry of a consuming request. Closing/backgrounding the viewer
  releases its object URL; leaving the chat unmounts it.
- Websites/PWAs cannot reliably prevent or detect OS screenshots or recording. MONO does not
  send invented screenshot alerts. A recipient who has received bytes and a decryption key
  can retain them, including with developer tools or another camera. View limits control
  subsequent MONO access, not the recipient's device.
- Delete for me is a server-persisted user-specific tombstone. Delete for everyone is
  author-only, removes the body and stored photo and returns a deletion marker. Already
  received plaintext or independently saved copies cannot be recalled.
- Edit is author-only encrypted text with optimistic versions and an Edited marker.
  Version-aware merge prevents an older poll from resurrecting deleted/edited content.
  A revision stream carries changes to messages older than the new-message cursor.

## Security boundaries

This protects content against passive database/server-storage disclosure. It does not hide
sender IDs, timing, message types, lengths, delivery/read state, photo dimensions/view counts,
game state or call metadata. It does not add forward secrecy, a per-message ratchet, device
revocation/key rotation, or protection from a compromised device, malicious browser extension,
XSS, or a compromised application server delivering malicious JavaScript. Both partners hold
the shared content key. Do not describe this as independently audited or equivalent to WhatsApp.

Chat APIs and media are excluded from service-worker caches. Push notifications do not include
message plaintext. General date/memory photos are outside the chat-encryption feature.

## Verification and release

Apply `20261115140000_encrypted_chat` before running this build. Update both clients: old
clients sending plaintext are rejected, never silently accepted. Do not roll back to a
plaintext-writing build after enabling encrypted chat without a separate migration plan.

Automated checks cover real crypto round trips/tampering/context separation; real PostgreSQL
ownership, key immutability, atomic views, deletion, optimistic edits, history conversion,
revision pagination and stale-client merging. Run:

```powershell
npm test
$env:MONO_TEST_DATABASE_URL = 'postgresql://mono_test@127.0.0.1:55459/mono_test_chat_security'
node scripts/test-integration.mjs test/integration/chat-security.test.ts test/integration/together.test.ts
npm run lint
npm run build
```

Physical iPhone/Samsung PWA behavior, cross-device recovery and the full interactive viewer
flow still need device testing. No live key has been generated and no production history
has been migrated as part of the local implementation.

Local validation on 2026-11-15:529 unit tests,188 PostgreSQL integration tests,
TypeScript, full ESLint and production build passed. The final focused chat/security run
passed46 tests. Build traces:82 routes; largest26.82MiB. No browser/phone UI pass is claimed.
