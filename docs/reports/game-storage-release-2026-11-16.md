# Game chat, rematches and admin-managed storage

Status: published and live-verified. Feature commit `771e387928efcaf5723d06bd3fa3b57f63102a85`; production deployment `dpl_FxAiAw1uBt869dwoaKAifXxFSr5U` is READY at https://mono-kappa-beryl.vercel.app.

- Removed the former 25 MiB total attachment quota and storage counter from chat. Admin-only
  aggregate storage metrics expose no private message/file content. Hosting capacity and
  per-file technical limits still apply; users are not prompted to delete old attachments.
- Inline match chat uses browser memory and a WebRTC data channel. There is no persisted
  text fallback. Finishing clears both players' chats; negotiation metadata expires.
- Winner/draw popup and consent-based rematches preserve old scores, alternate starters,
  create one new match and avoid another invitation in main chat.
- Custom stickers are reachable from the attachment sheet.
- Admin soundtrack limit is 10 MiB with bounded chunk uploads and streamed/ranged playback.

## Evidence

579 unit tests, 46 database integration checks, focused lint/TypeScript and production build
passed. Seven production-bundle game/admin browser groups and seven sticker browser groups
passed using isolated accounts. Responsive checks covered 320, 390, 768 and 1440 CSS pixels;
these are browser viewport checks, not physical iPhone/Samsung tests. Existing global live
music was not changed. Video messages are deferred by the user's explicit choice.


## Live verification

Six two-user browser groups passed on production: private peer text in both directions,
no message-text API/DB writes, responsive match controls, winner popup and transcript
clearance at finish, accepted rematch opening for both players with a fresh chat and no
main-chat invitation, and zero browser JavaScript errors. Artifacts:
`.postgres-test/release-live/live-07456e13d6f6/results.json`.
The suite deleted both disposable accounts and their test space. The outer cleanup found
no remaining fixture space. Scoped Vercel error/fatal runtime logs returned no entries.
The live global song was not replaced; 10 MiB publication/playback was verified locally.
