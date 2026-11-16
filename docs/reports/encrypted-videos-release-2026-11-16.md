# Encrypted videos and couple storage — 2026-11-16

## Change

Chat accepts video files, prepares larger files locally with WebCodecs/Mediabunny 1.66.0,
and encrypts them with the existing private chat key before uploading. The added MPL-2.0
dependency supplies container parsing, encoding and muxing; no paid compression service
receives plaintext. Audio tracks must survive conversion, otherwise the original is kept.
The preview shows the original/prepared size, progress, cancel and retry controls.

Uploads use 1 MiB plaintext chunks with separate AES-GCM IVs and authenticated context
binding the couple, sender, nonce, chunk index and total count. Retries reuse the exact
pending ciphertext. Finalization is atomic and idempotent. Videos use the existing private
Neon object bucket; only encrypted metadata and chunk references enter PostgreSQL.
The storage driver adds its existing server-managed encryption envelope around ciphertext.
Downloads check membership, deletion and per-user hiding, then decrypt only in the browser.
Normal videos support playback and saving/sharing. No screenshot-prevention claim.

The per-transfer safety bound is 512 MiB after preparation, not a total couple quota.
Unsupported compression keeps the original when it fits, with clear feedback. Large files
remain subject to device resources, supported codecs and provider capacity. Browser closure
does not resume an unfinished upload; retry in the same open composer does. Staging expires
after 24 hours. Persisted cleanup jobs reclaim cancelled, deleted and orphaned objects through
the existing cleanup worker, retaining jobs for active videos so a later cascade cannot
orphan their files. General `/media` access cannot bypass the video authorization endpoint.

Admin now has Couples and Accounts tabs. Couple cards group current member account IDs and
known chat attachment, video and date-photo-original byte counts. Names, emails, filenames,
chat text and media keys are not selected for these cards. The UI explicitly excludes photo
variants, avatars, backups and database overhead from couple totals.

## Verification before deployment

- Preserved upstream planner/Memories release `0701007`.
- 591 unit checks passed after merging upstream.
- 38 focused PostgreSQL checks passed: six new video tests, four existing game/storage tests,
  thirteen encrypted-chat tests and fifteen moderation tests.
- Focused ESLint and TypeScript passed.
- Production build passed: 99 routes; largest local trace 27.35 MiB.
- Seven production-bundle browser groups passed in Chrome 157, artifact directory
  `.postgres-test/e2e/75f828ddb278bd96`.
- Genuine moving-video/audio fixture compressed from 32,773,295 to 3,202,228 bytes.
  Three synthetic failed chunk requests led to a visible retry and exactly one message.
  Both users decrypted and played moving frames with measurable audio; reload, deletion,
  ID-only admin grouping and 320/390/768/1440 layouts passed. Disposable fixtures removed.
- Initial checks caught and corrected an admin-source encoding error and CSP rejection of
  Mediabunny's local blob worker. Final browser checks used the actual corrected CSP;
  the earlier policy-bypass diagnostic is not counted as end-to-end verification.
- Physical Samsung/iPhone behavior has not been tested in this run.

## Capacity verified before the live test

Production uses Neon S3-compatible private storage, not the older local Cloudflare settings.
Project `lively-dawn-48315757` reports `free_v3` and a database limit of 1,073,741,824 bytes.
The production private bucket is `mono-private-media`; its 64 listed objects total 4,152,086
bytes. PostgreSQL physical database size is 13,631,488 bytes, which includes overhead and is
not identical to Neon logical-storage accounting. There were 14 non-deleted accounts and
six active couples at this read-only snapshot.

Current [Neon Free plan documentation](https://neon.com/docs/introduction/plans) includes
1 GB PostgreSQL and a separate 5 GB object-storage allowance per project, 100 CU-hours/month,
and 5 GB/month public network transfer shared across the project's products. Usage depends
on media and traffic, not a fixed number of couples. Vercel has separate hosting limits;
its billing plan was not established by the connected team metadata, so no unverified
Vercel allowance is asserted here. No plan, billing setting or encryption key was changed.

## Live deployment

Published feature commit `2290c87ec10ab09306bf9c82d1c327be117cb8e3` and follow-up
`ccfb1edd13ca13f5e934341e278660a91b3ead17`. Final deployment
`dpl_HCTzTBHdsx15eNaMwf1kChaDZBTS` is READY on
https://mono-kappa-beryl.vercel.app.

Seven live groups passed in `.postgres-test/release-live/live-339d52223892/results.json`.
The source video was 32,683,735 bytes; the encrypted upload's prepared video was 3,194,456
bytes. Both partners played moving frames with measurable audio. Retry, reload, responsive
layout, ID-only admin grouping and both deletion modes passed. Delete API responses were
200 in 232 ms and 243 ms. No uncaught browser JavaScript errors. Health returned 200,
anonymous video access 401 with private/no-store, and the dependency license notice 200.

The final follow-up also adds safe download extensions, the dependency's MPL-2.0 license
and source notice, and makes deleted chunks immediately eligible for the existing cleanup
worker. Two metadata unit checks and the six video integration checks passed again.

Earlier live attempts encountered a tsx serialization helper error, a Chromium navigation
stall, a timed-out delete request and an async-form readiness race. Missing local dependency
files were restored using the unchanged lockfile. These attempts are not counted as passes.
The successful final run used bounded DOM navigation, explicit form readiness and HTTP/1.1
in headless Chromium to avoid the local transport stalls; TLS validation stayed enabled.
This establishes live browser/API/storage behavior, not physical iPhone/Samsung compatibility.

Every run removed its own disposable accounts and spaces. Eight encrypted objects from the
successful and earlier partial upload runs were queued for immediate cleanup; physical
removal awaits the existing worker. Existing user media and the global soundtrack were
untouched. No paid service, plan change or key rotation was introduced.
