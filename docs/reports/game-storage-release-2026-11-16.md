# Game chat, rematches and admin-managed storage

Status: local verification complete; deployment/live checks pending.

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
