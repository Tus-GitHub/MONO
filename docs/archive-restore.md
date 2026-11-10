# Portable archive and restore

The existing `/api/export` JSON download remains available. **Settings → Archive & restore**
(`/settings/archive`) adds portable active-content download and restore using the authenticated
`/api/archive` API and configured database/storage drivers. No integration keys are added.

## What the archive contains

`GET /api/archive` downloads `mono-archive-YYYY-MM-DD.json` with format `mono.archive.v1`.
It contains couple profile fields, active saved places and categories, active dates and their
plan/actual fields, activities, photos and variants, reviews visible to the exporter, category
ratings, revisit decisions, expenses, memories (including standalone records), date events,
shared recommendation feedback, and the exporter's personal date reminders. Couple cover and
date-photo bytes are embedded as base64 with per-object SHA-256 checksums. Whole-document
integrity uses a canonical schema-ordered SHA-256 digest.

Authorship and relationships use source IDs in the file. Restore maps source members by
normalized email **and the same OWNER/PARTNER role**, then creates fresh record IDs, remaps
relationships, and writes media under a new destination-couple namespace. Money retains its
original currency and owner-share meaning. The destination accounts are existing accounts;
archive metadata never changes their names, passwords, emails, or personal settings.

Blind-review privacy still applies: the exporter gets their own draft/submission and a
partner's submitted review only after both people have submitted. Partner drafts and hidden
submissions are omitted. Deleted dates/photos/places/memories/expenses are omitted, and
references to excluded places/photos are cleared. Only the exporter's reminders are included;
restored reminders are dismissed so old snapshots cannot replay deliveries. Re-enable or
create reminders through the normal app flows after restore.

Account avatars, credentials, sessions, OAuth/provider tokens, reset tokens, invite codes,
notifications, device subscriptions, delivery jobs and storage cleanup jobs are excluded.
Provider-owned place photos/links are metadata references, not downloaded third-party media.
This is an application archive of visible active content, not a complete disaster-recovery
backup of the database or a recovery tool for deleted/unseen partner data. A database dump
plus private-object-storage backup remains necessary for operator disaster recovery.

## Limits and failure behavior

- Maximum 64 MiB serialized archive, 32 MiB decoded owned media, 12 MiB per image, 10,000
  content rows across all tables, and 3,000 media objects. Oversized downloads fail explicitly;
  they never return a silently truncated archive.
- Each image must decode as an accepted raster format and stay within 40 million pixels.
  SVG/HTML and arbitrary media paths are refused. SHA-256 detects damage; it is not an
  authenticity signature. Both members review and approve the exact file before restore.
- Media IO has a 45-second checked operation budget (an in-flight storage operation retains
  the storage driver's own timeout), and the data transaction has a 30-second timeout.
  Larger spaces require an operator database/media backup rather than this bounded API.
- Authenticated API use is limited to eight archive requests per user per ten minutes, per
  process. The lightweight limiter is not a distributed rate-limiting service.
- Export uses a consistent PostgreSQL snapshot, then rechecks the caller's live session,
  membership and member token versions after reading media. A missing/unreadable object
  fails the download. An archive file is private plaintext; store it securely.
- Restore accepts an **empty current couple space**, including no soft-deleted content or
  existing couple cover. Unused seeded review categories are replaced by archive categories.
  It never merges with or overwrites an existing history.
- Both active members independently approve the exact archive digest and destination. Each
  approval expires after 15 minutes and is bound to its member's current account token version
  and live browser session. Revoking that session invalidates its outstanding approvals.
  A solo space needs its one member's approval.
- The exporter must perform the final restore. Each destination can receive an archive only
  once, enforced by a unique durable receipt, even for an empty archive. Repeated/concurrent
  attempts cannot duplicate content. A fresh empty space is needed for a later restore.
- All content and the receipt commit together. Media is staged first with durable one-hour
  orphan-cleanup tasks. Failed storage/authorization/database operations leave no imported
  records; staged bytes are cleaned by the existing worker. Successful commit removes those
  tasks. Account/session/membership revocation and newly added target content are rechecked
  under ordered user/couple locks before committing.

## Settings workflow

1. Open **Settings → Archive & restore → Download archive** in the source space. Store this
   private file safely. The regular data export lacks embedded media and cannot be restored.
2. Prepare a new empty space with the same people in the same owner/partner roles. Populated
   spaces, spaces with a cover, and previously restored spaces explain why restore is blocked.
   Do not disconnect a real space merely to try restore; use test fixtures for experimentation.
3. Each partner chooses the same portable archive on this page, reviews its name, people,
   date and content counts, checks consent, and selects **Approve this archive**. The server
   validates file integrity and destination permissions before issuing an approval.
4. The partner copies their approval code to the person who downloaded the archive. Only
   the downloader can finish. Both must stay signed in; approvals expire after 15 minutes.
   The downloader enters the partner's code, selects **Restore archive**, and confirms.
5. A successful restore shows content counts and a link to the restored dates. Changing the
   selected file clears all local approvals and consent. Expired approvals can be renewed.

File previews are local and are not authoritative validation. The server rechecks every
permission, approval, digest, relationship and destination condition at restore time. Files
and approval codes stay in page memory, not localStorage or draft recovery. Sharing the file
also shares the downloader's own private drafts included in it; review it before sharing.
The archive limits and recovery limitations above still apply.

## Authenticated API workflow

The API also remains available for operator workflows. It can be exercised
from the browser's developer console while signed in. Normal app origin
checks and httpOnly session cookies apply; no cookies or bearer session tokens are copied.

1. In the source space, visit `/api/archive` to download the file. Keep an untouched copy.
2. Establish a **new empty space containing the same people with the same roles** through the
   normal app flows. This may require intentionally disconnecting the old space; the old
   history remains archived. Do not disconnect merely to test the endpoint against real data.
   Use isolated fixtures first. Restore also supports independently provisioned accounts with
   those same emails/roles in another installation; account IDs do not have to match.
3. Each person chooses that exact file in their own authenticated browser. The following
   console helper prompts for a local JSON file and sends their approval request:

   ```js
   const archive = await new Promise((resolve, reject) => {
     const picker = document.createElement("input");
     picker.type = "file";
     picker.accept = ".json,application/json";
     picker.onchange = async () => {
       try { resolve(JSON.parse(await picker.files[0].text())); }
       catch (error) { reject(error); }
     };
     picker.click();
   });
   const approvalResponse = await fetch("/api/archive", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ action: "approve", archive }),
   });
   const consent = await approvalResponse.json();
   if (!approvalResponse.ok) throw new Error(consent.error);
   console.log({ digest: consent.digest, approval: consent.approval });
   ```

   Share only this short-lived **restore approval**, for the displayed digest, with the
   exporter. It cannot log anyone in. Sharing the archive for approval also shares the
   exporter's own private review drafts present in that file; review it first.
4. In the exporter's signed-in browser, with `archive` still loaded, restore using the two
   approval strings (one string for a solo space):

   ```js
   const approvals = ["own approval", "partner approval"];
   const restoreResponse = await fetch("/api/archive", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ action: "restore", archive, approvals }),
   });
   const result = await restoreResponse.json();
   if (!restoreResponse.ok) throw new Error(result.error);
   console.log(result);
   // Reload the existing app to view the restored history.
   ```

Never paste passwords, cookies, account session tokens, or integration keys into the console.
Archive/approval values are not logged by the server. The manual examples log the specific
restore approval locally because the second person must share it; clear the console afterward.

## Verification

`src/app/api/archive/route.test.ts` covers cookie-authentication boundaries, same-origin
requirements, no-store attachments, body shape/size checks, per-user limiting and generic
errors. `test/integration/archive-restore.test.ts` uses the isolated loopback PostgreSQL
database and real local storage. It covers graph/media round-trip, fresh IDs, `/media`
authorization, blind-review privacy, missing/duplicate/expired/revoked approvals, digest and
reference/type tampering, replay/concurrent restore, media failure, membership/content races,
missing media, and full database rollback after a forced final metadata update failure.

`test/e2e/account.mjs` also verifies the complete HTTP workflow in Chromium: a real multipart
photo upload, private JSON and portable archive downloads, each member's approval, restore into
a seeded empty space, restored content rendered by the existing date screen, protected media
reads and replay rejection. Accounts and source history use isolated PostgreSQL fixtures; login,
cookies, requests and local media storage are real. The development-mode server uses no live
provider keys. The same suite explicitly activates the shipped service worker in a separate
temporary browser context to check offline fallback and exclusion of private HTML/API/media
from CacheStorage. See [browser E2E testing](testing.md#browser-e2e) for exact scope and commands.

`test/e2e/settings.mjs` additionally exercises portable download, file validation, integrity
rejection, two independent approvals, rejection of repeated self-approval, confirmation
cancellation, restored media access, replay blocking and responsive settings screens through
the new UI. The existing integration suite retains revoked/expired approval and race coverage.
