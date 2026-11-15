# MONO admin

`/admin` shows account IDs, total signups (including deleted/blocked accounts), current accessible accounts and submitted reports. Account rows never return names, emails, profile fields, chat messages, photo URLs or encryption keys. Review text is intentionally shared by the reporting user, not extracted from encrypted chats.

The admin area has its own `/admin/login` page, direct dashboard sign-in and sign-out. It is outside the couple-app layout and does not require a partner, personal profile, onboarding or a space. Ordinary users cannot sign in through the admin form.

## Access and provisioning

Access requires a real, current database-backed session, a verified mailbox, a living/unblocked account and a row in `admin_access`. Public signup, profiles and server actions cannot grant this role. Services independently check the grant; hiding a page is not the permission boundary.

Apply `20261115180000_admin_moderation` and `20261115200000_private_identity_lookup` before deploying the application. Follow [private-data rollout](private-data-encryption.md) to configure the separate encryption key first. The operator script `scripts/provision-admin.ts` uses explicitly supplied `DATABASE_URL` and `DATA_ENCRYPTION_KEY`, plus JSON from stdin with `email`, `alias`, `name` and, for a new account, `password`. Run through `node --import tsx scripts/provision-admin.ts`. Never place passwords in command-line arguments, source files or shell history. No production URL is assumed by the script.

For this installation, use the operator's verified receiving mailbox, with `admin@mono.com` as the requested special sign-in alias. They identify **one account**, sharing a password. The alias is not a mailbox or a claim of ownership of mono.com. An alias cannot collide with an existing account mailbox, and public credential/OAuth signup cannot claim a provisioned alias. Do not commit the receiving mailbox or credentials to the repository.

Existing accounts keep their password. New accounts are unverified: sign in with either address and request verification through MONO's verification page. Messages go only to the real mailbox. The grant becomes usable after verification; no verification bypass is provided. Password recovery entered with the alias is resolved to the same real mailbox. Verified admins land on `/admin` after sign-in without needing a couple space. There is no public admin bootstrap endpoint.

## Reports and decisions

Settings links to `/report-account`, which also works after disconnecting a space. Users can report only people they have shared a space with. Server-side checks enforce this relation, verified status, one open report per pair and five reports per account in a rolling 24 hours. The reported partner receives no notification or report details.

Reports never automatically delete/block accounts. An admin must choose an action, record a reason and type the exact target account ID. Admin accounts cannot be moderated through this panel. Reports can be dismissed or marked actioned; the latter requires an account deletion/block after the report was submitted. Every decision is recorded in `moderation_audit`.

Deleting an account uses MONO's existing soft-deletion teardown: revoke credentials/sessions/push, cancel deliveries/invitations, archive its shared space and release memberships. It does not delete the partner or permanently erase shared history. Admin deletion replaces the mailbox with a tombstone so deletion alone permits a fresh signup. The old account remains as an ID in the audit/history. Normal self-deletion behavior is unchanged.

Blocking records a keyed HMAC-SHA-256 fingerprint of the lowercase/trimmed email, disables related existing accounts and revokes sessions. It prevents credential and Google signup with that same normalized address, even after deletion. A shared PostgreSQL transaction lock and serializable transactions coordinate signup, blocking and deletion. It does not claim to block different addresses, plus aliases or every account belonging to the same person. Fingerprints are lookup identifiers, not reversible encryption, and never leave the server. Email addresses themselves are stored as authenticated ciphertext.

Unblocking allows fresh sign-in/signup where otherwise eligible. It never restores a deleted account or reactivates revoked sessions. Audit entries retain account IDs and submitted decision text.

## Local verification

`node scripts/test-integration.mjs` with an explicit loopback `MONO_TEST_DATABASE_URL` runs the real database authorization/transaction tests. `node scripts/test-e2e.mjs moderation` additionally requires a `mono_test_e2e_*` database and runs the browser-to-server-to-database review flow with disposable accounts. E2E disables persistent compiler caches; `MONO_DISABLE_BUILD_CACHE=1` can also be used for a local production build when disk space is limited. Normal deployment caching is unchanged.
