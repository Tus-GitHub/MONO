# AMOR rebrand and address continuity

AMOR replaces the visible MONO name. Original vector artwork hides Mio in the M/shared dotted i stem/O; the same shapes generate the web wordmark, favicon and installed-app icons. Existing layouts and product behavior are retained.

The verified new address is https://amor-together.vercel.app on existing project `prj_iLIaFg5JAkdUSpWGcIKz3gN2Qvfo`. https://mono-kappa-beryl.vercel.app remains active without a redirect. Only production APP_URL and the EMAIL_FROM display name changed; the sending mailbox, database URL, authentication/encryption/push secrets, storage settings and other environment values/update timestamps are unchanged. No schema migration, data conversion, key rotation, paid service or API endpoint change.

Origin validation recognises exactly the two owned production addresses; unknown/cross-site origins remain refused and local/preview installations do not acquire production-origin access. Internal protocol headers, HKDF/AAD contexts, recovery-code format, IndexedDB names, cookies, draft/audio preference keys and archive format stay unchanged for compatibility. The service-worker cache version refreshes visual assets; it does not touch IndexedDB or local storage.

Checks: 643 unit tests passed across the initial run and corrected branding/cache expectation rerun, including encryption and origin isolation. Changed-file lint, TypeScript and production build passed (106 routes; largest trace 4.11 MiB). A direct comparison with the prior release confirmed the same recovery-code fingerprint/AAD and decryption of old text/image ciphertext. First sandbox build could not resolve Google Fonts; the approved network-access retry passed.

Browser data is origin-scoped. The old URL retains existing sessions and chat keys. On the new address, users sign in with the same account and unlock chat with the existing recovery code; notifications and PWA installation are managed per origin. No automatic key transfer or forced redirection is performed. Google OAuth is not configured in this production project; if enabled later, register the new callback URL with Google.

Live encrypted-history continuity and responsive branding checks are pending publication.
