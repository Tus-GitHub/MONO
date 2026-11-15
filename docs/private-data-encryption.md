# Private data at rest

MONO's existing chat encryption remains client-side end-to-end encryption, with the private recovery code and device keys. This additional layer is **server-managed encryption at rest**, not end-to-end encryption for identities or the rest of the app. Authorized application services can decrypt these fields; the database and object store receive ciphertext. The admin UI still exposes only account IDs, counts and deliberately submitted reports/review reasons.

## Scope

- Account emails, names, nicknames, pronouns, admin login aliases and stored OAuth access/refresh/ID tokens.
- Space names/descriptions; date and activity titles/notes; memories; review text; expense descriptions; private place notes; photo captions and blur placeholders.
- Copied notification and activity-event text/JSON, push subscription JSON, game state and call signaling payloads.
- Stored chat message bodies and chat image bytes receive an outer encryption layer. This does not replace or weaken the client E2EE envelope, recovery process or view-once/twice counters.
- Any legacy chat that predates E2EE still needs the existing client-side **Secure existing history** operation. This server backfill cannot turn legacy plaintext into genuine end-to-end encryption.
- Uploaded avatars, space covers and original/display/thumbnail date photos are encrypted before storage. New filenames are random and contain no original upload name. `/media` still authorizes every read before decryption.

The field inventory is `src/lib/privacy/fields.ts`. IDs, relationships, scheduling dates/times, birthdays/anniversaries, statuses, counters, monetary amounts, public venue catalog fields, object routing keys, push endpoint identifiers and token hashes remain operational metadata. Passwords remain bcrypt hashes. This is not a claim that every database column is encrypted. Remote provider-hosted avatars/place photos are outside MONO's uploaded-file store. An email provider necessarily receives the destination address when delivering mail. Reports are intentionally readable by the admin; reporting does not disclose a user's chat history.

## Keys and integrity

`DATA_ENCRYPTION_KEY` is a separate canonical base64-encoded 32-byte random secret. Never use `NEXT_PUBLIC_`, commit it, print it or send it to a browser. Store it in deployment secrets and retain a separate protected backup. Do not reuse `AUTH_SECRET` or chat recovery codes. HKDF-SHA-256 derives independent encryption and lookup keys; AES-256-GCM uses random 96-bit nonces, 128-bit tags and authenticated model/field (or file-key) context. Exact identity lookups use keyed HMAC-SHA-256 indexes, with case-sensitive names and normalized email addresses. These indexes reveal equality, not plaintext. Authentication failures stop reads/migration.

There is no automatic key rotation or recovery for this layer. Changing/deleting the key makes existing protected data and identity indexes unusable. A future rotation needs an explicit old-key/new-key re-encryption and index/blocklist migration. Protect the key alongside backups; a server compromise with that key can decrypt server-managed data. It cannot thereby decrypt the inner chat E2EE payload.

## Deployment and existing data

1. Validate the additive schema and backfill on an isolated database branch before production. Current automated tests use disposable local PostgreSQL databases and synthetic photo objects.
2. Securely configure the same `DATA_ENCRYPTION_KEY` for the application and migration operator. Apply both new additive migrations. Deploy the encryption-aware application before backfilling. Retire or protect older deployment URLs and stop old workers that share this database/storage: they must not remain available for plaintext writes or old signup policies. Never run the backfill while an old application version is serving plaintext writes. Do not roll back to an encryption-unaware build after encrypted writes start.
3. Run the operator-only audit with explicitly selected environment variables: `node --conditions=react-server --import tsx scripts/migrate-private-data.ts`. It logs only aggregate counts. It does not load or choose production credentials automatically.
4. Run the same command with `--apply` to migrate. It preflights existing ciphertext and files, then locks/re-reads individual records, encrypts private fields and fills lookup indexes without changing text or edit timestamps. Photos are staged under opaque encrypted keys, references switch transactionally, and old objects are retired only after a reference check. The process is resumable; keep the same key. Missing active photos or failed authentication stop the run. Investigate rather than guessing a replacement key.
5. Confirm the post-migration audit reports zero remaining plaintext protected fields/files. This only covers current database rows and referenced/cleanup-queued objects. Old database backups, storage object versions, untracked orphan objects and previously downloaded browser caches need their own retention/cleanup review. The migration cannot retroactively erase copies outside the active store.
6. Provision the verified admin account through the operator script, omitting the password to preserve existing credentials; see [admin setup](admin-panel.md). Exercise sign-in, verification, authorized media and admin/report flows after deployment.

During rollout, authorized reads support both old plaintext and new ciphertext. Signup checks both representations under the registration lock. Verification validates the decrypted current mailbox against the token mailbox under an account lock. Plaintext text search for private history runs after authorized, bounded database reads; no search index containing private prose is introduced.

Prisma query extensions do not automatically invoke hooks for nested operations, so the codec explicitly traverses nested writes/results. Raw SQL is restricted to reviewed locking, operational updates and a verification read that explicitly decrypts its two mailbox fields. New code must use the extended application Prisma client and encrypted storage wrapper; raw clients are for operator migration/audit and isolated fixtures only.

## Verification

For the approved one-time production rollout, `MONO_PRIVACY_BACKFILL=1` runs the operator with `--apply` during `vercel-build`, after schema migration. Enable it only once the encryption-aware application is live and older deployments are protected. This uses Vercel's existing storage credentials and encryption key without exporting secrets. After a successful zero-plaintext audit, disable the flag (`0` or remove it). Preview builds never run this backfill. The operator reports stages and aggregate counts only.

Cryptographic tests cover nonce variation, wrong-key/tamper/context rejection, file-key binding and round trips. Database tests inspect raw stored values, nested writes, rollback, mixed-data uniqueness/verification, repeatable migration and retirement of photo variants. The existing integration suite also exercises chat view limits/edit/delete, account/session revocation, moderation, calls, history and authorized photo routes with this layer enabled.

Implementation references: [Node.js crypto](https://nodejs.org/api/crypto.html), [Prisma query extensions](https://www.prisma.io/docs/orm/v6/prisma-client/client-extensions/query).
