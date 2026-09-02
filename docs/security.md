# MONO — security & privacy notes

MONO holds a couple's private history. The threat model that matters: **one authenticated user
reaching another couple's data**, an outsider reaching any of it, and the couple losing control
of their own content. This doc records what was audited and what protects each surface.

## 1. Authorization — couple isolation

Every couple-scoped read or write goes through `src/lib/authz/couple.ts`. There is no code path
that trusts a client-supplied couple id, user id, or URL param on its own.

- `requireCoupleContext()` resolves the couple from the **session** (`getCoupleContext` →
  `requireUser` → active `CoupleMember` row). A user with no couple gets `CoupleRequiredError`.
- `authorizeDate / authorizePlace / authorizeExpense / authorizeMemory / authorizePhoto /
  authorizeReview / authorizeReviewCategory` each load the resource **filtered by the caller's
  `coupleId`** (photos and reviews walk to the owning date first). A miss throws `NotFoundError`
  — existence never leaks.

Audited call paths (action → service → authz):

| Domain | Enforced by |
| --- | --- |
| Users / profile | `requireUser()` in the action; a user only ever mutates their own row |
| Couple | `requireCoupleContext()`; couple id comes from the session |
| Dates | `authorizeDate` in `date-service`, `plan-service`, `actuals-service`, `review-service`, `revisit-service`, `memory-service`, `photo-service`, `expense-service` |
| Places | `authorizePlace` / `requireCoupleContext` in `place-service`, `place-search-service`, `explore-service` |
| Photos | `authorizePhoto` (or `authorizeDate` for upload) in `photo-service`; `/media` re-checks per request |
| Reviews | `authorizeDate` in `review-service`; partner scores are additionally reveal-gated in `date-service` |
| Expenses | `authorizeExpense` (edits/deletes) / `authorizeDate` (add) in `expense-service` |
| Memories | `authorizeMemory` / `authorizeDate` in `memory-service` |
| Notifications | `markNotificationRead` / `listNotifications` / `markAllNotificationsRead` all filter `where: { userId }`; reminders by `where: { userId }` |
| Recommendation feedback | `requireCoupleContext` + place-ownership check in `explore-service.setRecommendationFeedback` |

API routes: `/api/uploads/*` (`requireUser` / `requireCoupleContext`), `/api/export`
(`getCoupleContext`, session-scoped, `no-store` attachment), `/api/places/search`
(`searchPlaces` → `requireCoupleContext`), `/api/auth/session` (returns only the caller's own
data), `/api/health` (public, no data). `/api/auth/google/*` return 501 until configured.

## 2. Input validation

All user input is parsed server-side with zod before it reaches a service — client validation is
never the gate.

- **IDs**: `idSchema` (cuid shape, `[a-z0-9_-]`, ≤64 chars) on every id field.
- **Enums**: `z.nativeEnum(...)` for `DateStatus`, `RevisitChoice`, `ReviewRevisit`,
  `ExpenseCategory`, `ExpensePayer`, `DateActivityKind`, theme, recommendation signal — an
  unexpected value is rejected, not coerced.
- **Sizes**: every text field is capped (`requiredText` / `optionalText`), money is bounded
  (`amountCentsSchema`, `≤ 1_000_000` dollars), arrays are capped (`reorderActivitiesSchema`
  ≤ 50).
- **Files**: `readImageUpload` reads the file's **leading bytes** and only accepts a recognised
  raster image (JPEG / PNG / GIF / WebP / AVIF). The client `Content-Type` is discarded. SVG is
  intentionally unrecognised (inline-SVG XSS). Size ≤ 12 MB is enforced from the actual byte
  length. A cross-origin `Origin` is refused.
- **Injection**: Prisma parameterises every query; the only raw SQL is `SELECT 1` in the health
  check. No `$queryRawUnsafe`, `eval`, or `new Function`. The one `dangerouslySetInnerHTML` is a
  static constant (the theme boot script), no interpolation.
- **Lifecycle**: `transitionDateAction` accepts any `DateStatus` but `assertTransition` rejects
  an illegal state change before any write.

## 3. Authentication

- **Passwords**: bcrypt, cost 12 (`src/lib/auth/password.ts`). `verifyPassword` runs a hash
  even for an unknown / OAuth-only account so timing doesn't reveal existence. Strength rules
  (≥10 chars, mixed case + digit). Login re-hashes if the stored cost is stale. Plaintext is
  never stored or logged.
- **Sessions**: a signed JWT (`jose`, HS256) in an **httpOnly** cookie, `Secure` in production,
  `SameSite=Lax`, `Path=/`. It embeds `tokenVersion`; bumping `User.tokenVersion` (password
  reset, account deletion) invalidates every outstanding session with no server-side store.
  "Remember me" chooses a 30-day cookie vs a browser-session cookie.
- **No enumeration**: login returns one message for bad-email and bad-password; the
  password-reset request always returns the same generic line.
- **CSRF**: Server Actions carry Next's built-in Origin check. The upload route handlers add an
  explicit same-origin check, and `SameSite=Lax` already stops the session cookie riding a
  cross-site POST.
- **Rate limiting** (`src/lib/security/rate-limit.ts`): best-effort in-process sliding window,
  keyed by client IP + tag. Applied to `login` (10 / 15 min), `register` (5 / 15 min),
  `password-reset-request` (4 / 60 min), `password-reset` (10 / 15 min), `couple-join` and
  `invite-accept` (10 / 15 min), and `upload` (40 / 5 min). Per-instance only — a shared store
  would be the next step if abuse is seen.
- **Reset tokens**: 32 random bytes, only the SHA-256 hash stored, single-use (`usedAt`), 30-min
  TTL, prior unused tokens deleted on issue; using one bumps `tokenVersion`.
- **Invitation tokens**: 24 random bytes, only the SHA-256 hash stored, single-use
  (`acceptedAt`), 72 h default / 14 d max TTL, previous outstanding link revoked on reissue;
  can't accept your own or join if already in a couple; the accept is one transaction.
- **Secrets**: `AUTH_SECRET` (≥32 chars) is validated at boot and only read server-side. No
  secret is sent to the browser. Nothing logs a password or a raw token.

## 4. Photo / media security

- **Upload**: `POST /api/uploads/date-photo` → `photo-service.addDatePhoto` → `authorizeDate`;
  `PUT` → `authorizePhoto`. Avatar → `requireUser` + owner-only. Couple cover →
  `requireCoupleContext`. All run `readImageUpload` (byte sniff + size + same-origin + rate
  limit).
- **Delete**: `deleteDatePhoto` → `authorizePhoto`; it also nulls any `Memory.coverPhotoId` /
  `Date.bestPhotoId` and removes all three stored variants.
- **Storage URLs**: object keys are `users/<id>/…` or `couples/<id>/…` with a random token, and
  are never rewritten in place (replace/delete allocate fresh keys). They are not public bucket
  URLs — every request goes through `/media/[...key]`.
- **`/media/[...key]`**: rejects any non-canonical key (`..` / `.` / empty segment, backslash,
  leading slash, control char) **before** parsing the prefix, then re-checks ownership
  (`users/<id>` = that user, `couples/<id>` = an active member) and returns 404 on any failure.
  `LocalStorageDriver.resolveKey` independently refuses a `..` segment. Responses are
  `Cache-Control: private, immutable`, `X-Robots-Tag: noindex,nofollow,noimageindex`,
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Content-Disposition:
  inline`, and the content-type is forced from the key extension (image/PDF only).
- **Indexing**: `src/app/robots.ts` disallows everything, the root layout sets
  `robots: { index: false }`, and media carries its own `noindex` header. There is no public
  gallery or profile route.

## 5. Account & couple controls

Every destructive action re-authorizes server-side, states its consequence in the UI, and is
confirmed:

| Action | Server | Confirmation |
| --- | --- | --- |
| Disconnect partner | `disconnectPartnerAction` → `requireCoupleContext` → archive (members `LEFT`, couple `ARCHIVED`); nothing hard-deleted | `useConfirm`, danger tone, explains it's reversible by support |
| Change profile | `saveProfileAction` / `updateCoupleProfileAction` → `requireUser` / `requireCoupleContext` | inline form, non-destructive |
| Delete a date | `deleteDatePlanAction` → `plan-service` → `authorizeDate` (soft delete) | `useConfirm` |
| Delete photos | `deleteDatePhotoAction` → `authorizePhoto` | `useConfirm` in the lightbox |
| Delete expense / memory | `authorizeExpense` / `authorizeDate` (soft) | `useConfirm` |
| Delete account | `deleteAccountAction` → `requireUser` + typed `"DELETE"` → soft-delete user, bump `tokenVersion`, archive couple, clear cookie | typed confirmation phrase |
| Export data | `GET /api/export` → `getCoupleContext` | n/a (read-only), `no-store` attachment |

## 6. Privacy posture

Stated in-app at `/settings/privacy`:

- The space is private to the two members. No MONO staff feature reads it; it is never shown to
  other users.
- Minimal collection: email + password to sign in, plus optional name / nickname / photo. No
  analytics or ad tracking.
- No public profiles — nothing to follow or search; the whole app is `noindex`.
- Reviews and scores are never published or aggregated across couples.
- Photos are only reachable through the authenticated `/media` route and are `noindex`.
- The couple can export everything, and leave without an irreversible shred (archive first).

## Residual / follow-ups

- Rate limiting is per server instance. A shared store (Redis/Upstash) would make it robust
  across a scaled deployment.
- CSP still allows `'unsafe-inline'` for script/style (Next inline bootstrap + inline styles).
  Nonce-based CSP via middleware is the hardening step.
- OAuth access/refresh tokens are stored plaintext in `Account` (standard, browser never sees
  them); encrypt-at-rest if OAuth is switched on.
- Reminder dispatch is still opportunistic (on Home load) — see `docs/architecture.md`.
