# Chat expression picker and custom stickers — 2026-11-16

The user requested a clearer chat plus menu, comparison with other chat apps, custom stickers,
completion of browser testing and publication. This release retains upstream through f55ee1c.

## Behavior

- Plus opens focused Photo/Document attachment cards. A separate smiley opens searchable Emoji/Stickers tabs.
- Emoji insert at the saved cursor and can be added repeatedly without closing the picker.
- Create accepts PNG/JPEG/WebP, prepares a transparent square PNG locally, previews it and requires a name before Send & save sticker. Existing transparency is preserved; backgrounds are not removed automatically.
- Both partners can reuse recent custom stickers. Names, stable identities and pixels are encrypted; reuse gets fresh message encryption and retries retain their nonce.
- Existing couple isolation, attachment quota, hidden/deleted message rules and media authorization apply. No dependency or migration was added for stickers.
- The library is recent accessible history (32 distinct creations from 120 messages), not a separate permanent sticker pack.

References: [Telegram sticker maker](https://telegram.org/blog/sticker-maker/) and [Signal stickers](https://support.signal.org/hc/en-us/articles/360031836512-Stickers).

## Local validation

- 579 unit tests, 55 focused PostgreSQL tests, full ESLint and TypeScript passed.
- Production build passed: 95 routes; largest function trace 27.34 MiB.
- Clean Chromium run `.postgres-test/e2e/61725817e85211a4/results.json`: 7 sticker and 8 custom-control groups passed, no page errors. Screenshots reviewed.
- Verified both-partner unlock, attachments, cursor insertion/search, keyboard tabs, 320/390/1440 widths, cancel without storage, empty-name guard, failed send/retry, ciphertext-only storage, inline display, reload and partner reuse without duplicate library entries. Controls additionally cover 768px, form values/reset, keyboard navigation, dark mode and nested Escape.
- A broader run passed encrypted editing/deletion, documents and normal/limited photo behavior, then local disk exhaustion interrupted audio/profile testing. Generated Next caches were cleared and the focused suites/build rerun successfully. This report does not claim a complete audio/planner regression or physical-phone pass.
- Initial harness failures were an emulation reload closing the picker and early demo-form interaction before hydration. The tests now synchronize those transitions.

## Production

Published commit **7fac26a**; push to origin/main succeeded. Vercel deployment
`dpl_BVPGg4Vk1aNLTMyoGXuFh7UwwhTx` is READY on https://mono-kappa-beryl.vercel.app.
Vercel build completed; largest traced function was 44.79 MiB.

Live health returned HTTP 200 with database up. Anonymous sticker-library GET returned 401
and private/no-store; cross-origin POST returned 403.

All **7 production two-partner sticker browser groups passed** with no uncaught browser
errors. The same suite verified encrypted unlock, document sending, cursor-aware emoji,
keyboard tabs, responsive bounds, custom preview/cancel, empty-name protection, failed-send
retry, ciphertext-only storage, inline display on both devices, reload and partner reuse
without duplicate library tiles. Mobile and fully decoded desktop screenshots reviewed.
Artifacts: `.postgres-test/sticker-live/stickers-0ef314b684f114/results.json`.
Both disposable accounts and their test space were removed. No real-user chat or credentials
were changed. Physical-device keyboard behavior remains outside this Chromium evidence.

Initial live attempts failed before fixture creation because this machine's DNS could not
resolve the configured database endpoint. Automatic review first rejected a public DNS
lookup as unapproved metadata disclosure. The user explicitly approved hostname-only
Cloudflare DNS diagnosis; it succeeded. A temporary lookup override inside the test process
used those results while preserving the original database hostname and TLS certificate
verification. App configuration and OS DNS settings were unchanged. The subsequent live
browser run passed. Local test PostgreSQL was stopped after local verification.
