# Permanent Chat reset and security documentation

After both partners' email OTPs approve a reset, AMOR now permanently removes the
couple's previous Chat messages and attachments and starts a fresh encrypted
conversation. Existing production conversations were not reset during this release.

Live application commit: `0a2ccea88c1dbfacc97a0aa18c9a939335a02eb0`.
Vercel deployment: `dpl_5ofEBXtk7FBiyQXGddEtrNjtbMF3`, READY at
[AMOR](https://amor-together.vercel.app). The main push succeeded.

## Scope and safeguards

- The two OTPs, current verified mailboxes, current membership, requesting user,
  pending request, expiry, attempts and generation are checked together.
- Explicit `deleteOldChat: true` is required. Older clients are asked to refresh.
  A new HMAC domain invalidates OTPs issued under the earlier keep-history wording.
- In one locked serializable transaction, deletion covers all earlier Chat
  generations, attachment metadata and unfinished videos, consumes the request and
  switches the key/generation. Failures roll the whole change back.
- Chat images, documents and custom stickers cascade with messages. Video object
  keys are queued durably before their metadata is removed. Immediate bounded
  cleanup and a daily protected Chat-only worker remove queued objects. A late
  upload completing after reset requeues its key.
- Cleanup checks active references and uses leases, backoff and six attempts.
  Terminal `failedAt` jobs require operator investigation/requeue. Queueing is not
  proof that a physical object has already disappeared.
- Accounts, couple membership, profile/couple media, music, dates and their photos,
  Memories, expenses, reviews, saved venues, games, scores and calls remain.
  Other couples' data is outside the deletion scope.
- Both clients lock Chat on the generation update and need the same new recovery
  code. Account sign-in sessions remain active. A new code cannot decrypt the old
  conversation, and finding an old code cannot restore messages deleted by reset.
  Downloaded copies and provider backup/version retention are outside this operation.

## Verification

- 74 focused PostgreSQL integration checks passed across reset, video, Together,
  archive and crop suites. The final video-only cleanup filter was followed by a
  repeated successful 15-test reset suite; those repeated tests are not additional
  distinct coverage.
- 19 focused unit checks passed for email wording, cleanup-route authorization,
  client generation handling and Chat crypto. Focused ESLint, TypeScript and the
  production build passed.
- Database checks include partial/wrong/expired codes, consent, replay, mailbox and
  membership changes, old-policy OTP invalidation, rollback, storage failure and
  retry, late upload, multiple old generations and preservation of other content.
- Right-panel localhost checks with both synthetic partners covered warnings,
  required OTP/consent states, partial-code validation, cancellation and layouts at
  320, 390, 844 landscape and 1440 CSS pixels. Actual destructive scenarios used the
  isolated local integration database, not production. Physical iPhone and native
  installed-PWA behavior were not tested in this release.
- Production build: 110 routes, largest function trace 44.85 MiB within the guard.
  Health returned 200/database up. Anonymous Chat and cleanup requests returned 401
  with private/no-store headers. A stale reset payload without deletion consent
  returned 422. The scoped error/fatal runtime log query returned no entries.
- Read-only production audit retained 6 users, 3 couples and 54 Chat messages, with
  zero completed resets and all Chat generations zero. No real reset email or
  destructive production reset was sent/run for this release.
- `CRON_SECRET` was provisioned as a sensitive production variable. The daily
  `/api/cron/chat-cleanup` fallback is configured; a real scheduled invocation has
  not yet been observed. The separate reminder scheduler was not activated.
- The task-owned preview harness and its two localhost servers were stopped.
  Isolated local fixtures were retained.

## Updated existing documents

The user's existing files were replaced in place in `C:/my/Documentation`, keeping
their filenames:

- `AMOR_Quick_App_Guide.pdf`: five pages, including the security/recovery walkthrough;
  six blank fillable fields, five navigation bookmarks and 36 links preserved.
- `MONO_Complete_Project_Handbook_2026-11-16.docx`: AMOR content, 67 rendered pages,
  62 tables, current schema/API inventories and detailed encryption/reset/operations
  guidance. The original owner-supplied admin details were preserved without
  changing the account's credentials.

All guide pages and handbook pages were visually reviewed. The bundled Windows
LibreOffice executable was unavailable, so the DOCX proof was rendered with the
installed Microsoft Word through the computer-use interface and rasterized with
bundled Poppler. A final two-cell inventory correction was rerendered; only pages
9 and 10 changed, and both were checked. Saved destination files reopened
successfully and matched the reviewed outputs byte-for-byte.

Original copies and rendering evidence remain in the ignored local
`.postgres-test/security-guides` directory. Credentials and documents were not
committed or uploaded to the repository.

## Radius clarification

The current venue cursor preserves the anchor and selected radius on Load more;
server-side measured distance filtering applies to every page. The existing live
release report records a 50 km query reaching 23.7656 km while a 5 km query excludes
farther results. Radius is a straight-line maximum, not a minimum distance or a
promise that every venue in the circle is available from the provider. No new
venue search change was needed for this clarification.
