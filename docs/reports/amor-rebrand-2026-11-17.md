# AMOR rebrand and address continuity

AMOR replaces the visible MONO name. Original vector artwork hides Mio in the M/shared dotted i stem/O; the same shapes generate the web wordmark, favicon and installed-app icons. Existing layouts and product behavior are retained.

The verified new address is https://amor-together.vercel.app on existing project `prj_iLIaFg5JAkdUSpWGcIKz3gN2Qvfo`. https://mono-kappa-beryl.vercel.app remains active without a redirect. Only production APP_URL and the EMAIL_FROM display name changed; the sending mailbox, database URL, authentication/encryption/push secrets, storage settings and other environment values/update timestamps are unchanged. No schema migration, data conversion, key rotation, paid service or API endpoint change.

Origin validation recognises exactly the two owned production addresses; unknown/cross-site origins remain refused and local/preview installations do not acquire production-origin access. Internal protocol headers, HKDF/AAD contexts, recovery-code format, IndexedDB names, cookies, draft/audio preference keys and archive format stay unchanged for compatibility. The service-worker cache version refreshes visual assets; it does not touch IndexedDB or local storage.

Checks: 643 unit tests passed across the initial run and corrected branding/cache expectation rerun, including encryption and origin isolation. Changed-file lint, TypeScript and production build passed (106 routes; largest trace 4.11 MiB). A direct comparison with the prior release confirmed the same recovery-code fingerprint/AAD and decryption of old text/image ciphertext. First sandbox build could not resolve Google Fonts; the approved network-access retry passed.

Browser data is origin-scoped. The old URL retains existing sessions and chat keys. On the new address, users sign in with the same account and unlock chat with the existing recovery code; notifications and PWA installation are managed per origin. No automatic key transfer or forced redirection is performed. Google OAuth is not configured in this production project; if enabled later, register the new callback URL with Google.

## Published and verified

Initial release `d418a75684b580b220056625addc8848d5c83d3d` and final polish `7e4db3052ace3cc51222c4ff3ac607ada06b700b` were pushed successfully. Production deployment `dpl_AwG7s1bkxyr65z5aVSqWc5fWrMdL` is READY and both public aliases point to it. The final production build/TypeScript and lint passed (106 routes, largest local runtime trace 4.11 MiB). Six focused worker/notification checks passed, including a new regression requiring fresh branding requests during precaching.

Live run `9ac6feb2d123` created a disposable account pair and encrypted message on the old release before deployment. After release it verified: the same account/name/email/password hash on the new address; exact unchanged stored message ciphertext decrypted with the original recovery code; the original address retained its session and nonextractable stored key after reload; and both addresses exchanged encrypted messages in one history with exactly three stored messages. The two accounts and their test space were removed. No existing customer records were changed.

That run stopped at a branding assertion because the old PWA worker correctly still held the old manifest until its update was activated. It is recorded as partial, not a fully passed six-group run. Fresh HTTP manifests were AMOR on both domains. The final patch uses worker v8 and `cache: reload` when precaching, preventing old HTTP-cached branding from being copied into a replacement cache. It also fixes default monogram sizing so placement-specific sizes apply.

A separate live PWA update check seeded a cached MONO manifest, a nonextractable IndexedDB key and a saved preference in an isolated browser. The actual app update banner's Refresh button activated v8: the manifest became AMOR, obsolete cache entries disappeared, the key/preference remained, and the decorative monogram measured 56px. Evidence: `.postgres-test/amor-brand/.postgres-test/amor-pwa-update/results.json` and `desktop-after-refresh.png`.

Final anonymous browser checks passed three groups: mobile390/desktop1440 login/landing branding and no horizontal overflow on each origin, correct manifests, healthy databases, and no JavaScript errors. Evidence: `.postgres-test/amor-brand/.postgres-test/amor-brand-live/results.json` and screenshots. New-address chat screenshots are in `.postgres-test/amor-brand/.postgres-test/amor-live-9ac6feb2d123/`. Final deployment-scoped error/fatal logs were empty. Existing installed apps should use the update banner's Refresh button; phone OS icon-label refresh timing is browser/OS controlled.

Original SVGs: `public/brand/amor-wordmark.svg` and `amor-wordmark-light.svg`. Internal legacy names remain only where they identify encryption formats, stored browser data, cookies, archives or infrastructure that must remain compatible.
