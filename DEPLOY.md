# Deploying MONO

MONO is a standard **Next.js 16 (App Router) + Prisma + PostgreSQL** app. It runs on any host
that can build a Next.js server and reach a Postgres database and an S3-compatible bucket. The
reference target below is **Vercel + Neon + Cloudflare R2**, all with a free tier; every piece
is swappable.

Nothing here needs a secret in the repo. `.env*` is git-ignored (`.env.example` is the only
tracked env file) — every secret lives in the host's environment settings.

## Automatic deployment is enabled

`vercel.json` sets `git.deploymentEnabled` to `true`, so authorized GitHub pushes can deploy this
project through the existing Vercel integration. The user approved continued deployments while
leaving keys for later; see
[Vercel's Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
Successful deployment does not verify configured-provider delivery or database readiness.
Complete the environment and migration preflight below before relying on the live app. Do not
add, rotate or expose keys as part of ordinary publication.

---

## 1. Environments

| | Database | Storage | `NODE_ENV` | Notes |
|---|---|---|---|---|
| **Development** | local Postgres or a Neon *dev* branch | `local` (writes `./.storage`) | `development` | `.env` on your machine. Dev secrets are fine. |
| **Test** | isolated loopback `mono_test_*` database | `local` | `test` | `npm test` needs no DB. Browser E2E uses a separate `mono_test_e2e_*` database and development server. |
| **Production** | a **dedicated** Neon project/branch | `s3` (private bucket) | `production` | Host env only. Real secrets. |

Keep production data on its own database — never point prod at the dev branch. `prisma/seed.ts`
refuses to run when `NODE_ENV=production` (override with `-- --force`).

On boot, a **production** server fails fast if `AUTH_SECRET` looks like a placeholder,
`DATABASE_URL` is localhost, `APP_URL` isn't `https://`, or `STORAGE_DRIVER=s3` without S3
credentials (see `src/config/env.ts`).

---

## 2. Environment variables

Set these in the host (Vercel → Settings → Environment Variables), **Production** scope. Values
in the local `.env` are for development only.

### Required

| Name | Example / how to get it |
|---|---|
| `DATABASE_URL` | Neon **direct/unpooled** production connection string with `sslmode=require&connect_timeout=15&connection_limit=5` (current code uses the same URL for migrations and runtime) |
| `AUTH_SECRET` | 48 random bytes — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `APP_URL` | `https://your-domain` (or the `*.vercel.app` URL). Used for invite links, password-reset links, OAuth redirects. |
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET` | your private bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | an access key scoped to that bucket |
| `S3_REGION` | AWS: the real region. Cloudflare R2: `auto`. |
| `S3_ENDPOINT` | R2: `https://<accountid>.r2.cloudflarestorage.com`. **Blank for AWS S3.** |

### Recommended

| Name | Value |
|---|---|
| `SESSION_COOKIE_NAME` | `mono_session` |
| `SESSION_MAX_AGE_DAYS` | `30` |
| `IMAGE_PROCESSOR` | `sharp` |
| `EMAIL_DRIVER` | `smtp` for real delivery; `console` for development only |
| `EMAIL_FROM` | `MONO <no-reply@your-domain>` |
| `PLACE_PROVIDER` | `none` |

### SMTP email (implemented; configure when ready)

MONO uses its own warm, clay-accented HTML password-recovery template with a plain-text
alternative. Production email is configured on Brevo's SMTP relay, using the existing
verified sender address with the display name `MONO`. The credentials are production-scoped
Vercel secrets; they are not stored in this repository. Set `APP_URL` to the public production
origin so reset links point to the deployed app. The existing local console driver remains
available for development. Successful sends log only a generic SMTP acceptance marker, never
recipient details or reset links. SMTP acceptance does not establish inbox placement.

Verified on 2026-11-10: release `a7407ea` is READY on Vercel, public health reports database up,
and a registered-account recovery request through the live form produced the generic SMTP
acceptance marker in production logs. The 30-minute single-use email lets the account owner
choose their password; no lasting password is supplied by deployment scripts.

Set `EMAIL_DRIVER=smtp`, `EMAIL_FROM` to your verified sender, and `SMTP_HOST`, `SMTP_USER`,
`SMTP_PASSWORD`. Use `SMTP_PORT=587` with `SMTP_SECURE=false` for mandatory STARTTLS, or
`SMTP_PORT=465` with `SMTP_SECURE=true` for implicit TLS. Certificate verification stays enabled.
Development can keep `EMAIL_DRIVER=console` with SMTP fields blank.

`npm run check:email` verifies connection, TLS, and authentication without sending mail.
Then test Forgot Password with your own account after deployment. Reset links expire after
30 minutes, are single-use even with concurrent requests, and invalidate existing sessions.
Mail failures keep the generic recovery response and log a generic configuration error.
See [Nodemailer SMTP options](https://nodemailer.com/smtp).

### Google integrations (implemented; optional)

For sign-in, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and the authorized callback
`<APP_URL>/api/auth/google/callback`. `GOOGLE_OAUTH_ENABLED=false` explicitly disables it.
For Places, set `PLACE_PROVIDER=google` and `GOOGLE_PLACES_API_KEY`; enable Places API (New).
The key stays server-side, including photo resolution. Saved/custom place flows work without
it. Do not put these secrets in client-prefixed environment variables.

### Free venue search (no account, key or billing)

Set `PLACE_PROVIDER=photon` in Vercel Production and redeploy. Photon uses OpenStreetMap data;
no API key, Google billing account, card or autopay mandate is needed. Search for a venue name
with its city (for example, `Starbucks Delhi`) or a category and area (`cafes in New Delhi`,
`restaurants in Mumbai`). Results include mapped names, addresses and coordinates; Google
ratings, reviews and photos are not supplied. Existing Maps links still open by coordinates
without a paid Maps API.

The [public Photon service](https://github.com/komoot/photon#demo-server) permits reasonable
project usage and provides no availability guarantee. This is suitable for MONO's small private
workload, not an unlimited public search service. Requests are user-triggered, debounced,
deduplicated, cached briefly and paced conservatively per warm instance. This in-process pacing
is not a global distributed quota. Failures fall back to saved/custom places without switching
to a paid provider. Attribution is shown beside results and saved venue details. Do not replace
it with public Nominatim autocomplete or public Overpass as an app backend.

Selected venues are fetched server-side through Photon reverse lookup and must match the
selected OSM object type, ID and category; a different nearby venue is never silently saved.
Coordinates in the selection identifier are validated. No schema migration is required.
`npm run check:places` uses the configured provider; with `PLACE_PROVIDER=photon`, it checks
real venue search and exact selection lookup and makes no Google request. Standalone:
`node node_modules/tsx/dist/cli.mjs scripts/check-photon.ts "cafes in New Delhi"`.

### Free venue photos (partial coverage)

Photon venues can show Wikimedia Commons photographs without signup, API keys, billing or
autopay. MONO looks up the venue's exact OpenStreetMap node/way/relation backlink in Wikidata,
then retrieves its Commons thumbnail and reusable license metadata. It does not match arbitrary
nearby, chain or stock photos to a venue. Many ordinary restaurants/cafes have no linked photo;
they retain the existing placeholder. Broken or unavailable images also fall back gracefully.

Photographer/custom attribution, the license link and Commons source link accompany each
photo, with cropping disclosed. Only supported CC BY, CC BY-SA and public-domain license URLs
with complete attribution are accepted; restricted or unclear metadata is skipped. Thumbnail
URLs come from the Commons API rather than being hand-built. CSP permits only Wikimedia's
`upload.wikimedia.org` and `thumb.wikimedia.org` image hosts; images send no referrer.

Lookups batch at most 24 public venue IDs, retain a bounded warm-instance cache for hits/misses
(24 hours; one minute for errors), coalesce simultaneous work and honor upstream backoff.
The public services have no availability guarantee; cold photo lookups may add up to two
four-second source timeouts. No couple-private data is sent, no schema migration or new
environment variable is needed, and image/license metadata is resolved rather than permanently
stored in place records. This is intended for MONO's small private workload.

Sources: [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access),
[Commons reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia),
[Commons image metadata](https://www.mediawiki.org/wiki/API:Imageinfo).

### Optional Google Places setup

To activate Google restaurant/cafe search:

1. Select the intended Google Cloud project and link an active billing account.
2. Enable **Places API (New)** (`places.googleapis.com`) for that project.
3. Create a dedicated MONO server API key, restricting its allowed APIs to **Places API (New)**.
   Do not use a Websites/HTTP-referrer application restriction for MONO's server-side calls.
   If an IP restriction is configured, it must match the deployed server's actual outbound IPs.
4. In MONO's Vercel project environment settings, add `GOOGLE_PLACES_API_KEY` to **Production**
   as a **Secret**. Set `PLACE_PROVIDER=google` in Production. Never paste the key in chat or
   commit it; these variables do not use the `NEXT_PUBLIC_` prefix.
5. Redeploy production after saving both variables. Verify real search, selected-place details
   and saving the chosen venue from the live authenticated picker.

For an existing local key, `node --env-file=.env scripts/check-places.mjs "cafes in New Delhi"`
checks Google directly while hiding/redacting the key. A 403 requires checking Google project
billing, API enablement and key restrictions; MONO's saved-place fallback can otherwise conceal
that configuration failure. See Google's
[Places setup guide](https://developers.google.com/maps/documentation/places/web-service/get-api-key).

### Optional — Web Push (browser/PWA reminders)

Generate a pair with `npm run vapid`. Without them, push is off and in-app notifications carry
everything.

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npm run vapid` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **same string as `VAPID_PUBLIC_KEY`** (exposed to the browser) |
| `VAPID_SUBJECT` | `mailto:you@your-domain` |

### Do NOT set

- `NODE_ENV` — the host sets it.
- `SHADOW_DATABASE_URL` — only needed for `prisma migrate dev` on a locked-down local DB, never in prod.
- `STORAGE_LOCAL_ROOT` — local driver only.

---

## 3. Database setup (Neon)

1. Create a Neon project. Use the **production** branch for prod; a separate branch for dev.
2. In *Connect*, disable **Connection pooling** and copy the direct string for
   `DATABASE_URL`. The current Prisma 6 schema uses this URL for both runtime and migrations.
   A future pooled runtime setup should add a separate direct migration URL first.
3. First deploy runs the migration automatically (below). To do it by hand:
   `DATABASE_URL=<prod direct> npx prisma migrate deploy`.
4. Neon free-tier compute auto-suspends when idle; the first request after a pause takes
   ~0.5 s. `connect_timeout=15` in the URL absorbs it.

### Migration procedure

Migrations live in `prisma/migrations/` and are **append-only** — never edit an applied
`.sql`; add a new migration instead.

- **Make a change:** edit `prisma/schema.prisma`, then
  `npm run db:migrate -- --name describe_change`
  (needs a local Postgres, or a Neon dev branch **plus** `SHADOW_DATABASE_URL` pointing at a
  second empty branch, because Neon roles can't `CREATE DATABASE`).
  Commit the new `prisma/migrations/<timestamp>_describe_change/` folder.
- **Deploy:** `prisma migrate deploy` applies every pending migration. It's idempotent, runs
  additively, and never drops data. It's wired into the build (see §5), and available as
  `npm run db:deploy`.
- **Check drift:** `npm run db:status`.
- **Existing dev DB** (this repo's Neon was first built with `db push`): it's already marked
  as having `20260902000000_init` applied (`prisma migrate resolve --applied …`), so `migrate
  deploy` is a no-op there.
- **Rollback:** migrations are forward-only. Roll back the *code* deploy (Vercel → Promote a
  previous build); an additive migration is safe to leave, a destructive one needs a new
  forward migration to undo.

---

## 4. Storage setup (S3-compatible)

Photos must **not** live on the app's filesystem in production — Vercel's is read-only and
wiped each deploy.

1. Create a bucket (Cloudflare R2, AWS S3, Backblaze B2, or self-hosted MinIO).
2. **Keep it private** — block all public access. MONO never generates a public object URL;
   every image is streamed through the authenticated `/media/<key>` route, which re-checks
   couple membership from the key prefix (`couples/<id>/…`, `users/<id>/…`).
3. Create an access key limited to that bucket (Get / Put / Delete / Head).
4. Set `STORAGE_DRIVER=s3` and the `S3_*` vars (§2). No bucket CORS or lifecycle rules are
   required.
5. Deletion, HEAD-based `exists`, and 404 → app 404 are handled by `src/lib/storage/s3.ts`.
   A missing object reads as a 404, a transient S3 error surfaces as a 500 the upload UI shows.

---

## 5. Deployment (Vercel — the exact host is swappable)

1. **Import the repo.** vercel.com → Add New → Project → pick the Git repo. Framework
   auto-detects as **Next.js**. Root directory `./`.
2. **Build command:** leave the default — Vercel runs the repo's **`vercel-build`** script
   automatically:
   ```
   prisma generate && node scripts/migrate-deploy.mjs && next build
   ```
   (Local `npm run build` is just `next build` — no DB needed, so `publish` and CI stay fast.)
3. **Install command:** default (`npm install`; `postinstall` runs `prisma generate`).
4. **Output directory:** default.
5. Add the environment variables from §2 (Production scope).
6. **Production Branch:** `main` (Settings → Git).
7. **Deploy.** The build applies migrations to the prod DB, then builds. If a migration fails
   the build fails and the previous deployment keeps serving.

`scripts/migrate-deploy.mjs` uses `DIRECT_DATABASE_URL` if provided. Otherwise, for a Neon
`-pooler` hostname only, it derives the equivalent direct hostname for the migration child.
The app's runtime `DATABASE_URL`, credentials and other providers are unchanged. This preserves
Prisma advisory locking while avoiding locks through Neon's transaction pool. Migration
`20261110000000_email_verification` adds the verification-token table without rewriting users.

On another host (Fly.io, Render, a container): build with `npm run vercel-build` (or
`prisma migrate deploy` as a release step + `next build`), then `next start`. Provide the same
env vars. The app needs a long-running Node server — it is **not** a static export.

---

## 6. Domain & HTTPS

MONO must run over HTTPS in production — auth cookies are `Secure`, and the camera picker,
notifications, PWA install, and the service worker all require a secure context.

1. Vercel serves every deployment over HTTPS already (`*.vercel.app` or a custom domain).
2. Add a custom domain: Vercel → Settings → Domains → add it, point DNS as instructed. TLS is
   automatic.
3. Set `APP_URL` to the final `https://` origin and redeploy (invite/reset links are built
   from it).
4. `Strict-Transport-Security`, CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, and
   `Permissions-Policy` ship in production via `next.config.ts` — no extra config.
5. If you put a proxy/CDN in front, forward `Host` and `X-Forwarded-Proto` so Next builds
   correct absolute URLs.

---

## Scheduled reminders

`GET /api/cron/reminders` dispatches due reminders without an open browser tab.
Set `CRON_SECRET` to a separate random secret of at least 32 characters in the host.
The scheduler must send `Authorization: Bearer <CRON_SECRET>` over HTTPS. A missing
configuration returns 503; an incorrect token returns 401. Never put the secret in the URL.

Configure an HTTP scheduler to call this endpoint every five minutes. For a Vercel plan
supporting that frequency, add this to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/reminders", "schedule": "*/5 * * * *" }] }
```

Vercel automatically sends the configured `CRON_SECRET`. Its Hobby plan only supports
daily cron jobs, which is insufficient for timed reminders; use an external scheduler
with the same authorization header instead. See
[cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and
[plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
No schedule is enabled by this repository alone; configure the chosen host/service.

Alternatively run `npm run reminders:worker` as a separate always-on Node process with
`APP_URL` and `CRON_SECRET`. It dispatches every five minutes, handles shutdown, and retries
on the next interval after failures. `npm run reminders:dispatch` performs one pass for a
system cron entry. Worker/diagnostic scripts require Node 20.12+ (Node 22 recommended).
They never print the bearer secret.

Responses contain aggregate `users`, `delivered`, and `failedUsers` counts, never user data.
Each user processes at most 25 due reminders per pass; subsequent runs drain any backlog.
In-app notification creation and the reminder claim commit atomically to prevent duplicate
delivery of the same reminder by overlapping cron/tab requests. External push is best-effort
after commit, requires VAPID configuration and browser permission, and is not retried after
an in-app success. Monitor scheduler responses and server logs for delivery failures.
Disabled-category reminders are retired when due rather than delivered later if re-enabled.

Verify unauthorized requests fail, then test a due reminder on the deployed origin with
all tabs closed. Repeating the request must not create another notification for that reminder.

## 7. Post-deploy verification

Do not call it done until this passes against the **live** URL:

1. `GET /api/health` → `{"status":"ok","database":"up"}`.
2. **Signup** a new account → lands in onboarding.
3. **Login / logout** → session persists across a full reload; logout clears it.
4. **Couple connection:** create a space, open the invite link in a second browser, accept →
   both show *Connected*.
5. **Dates:** plan a date through every step, save, change its time, cancel one.
6. **Photos:** upload from the file picker and (on a phone) the camera; a 12 MP / portrait
   photo lands upright; set the best photo → it shows on Home / Memories / the date; delete a
   photo.
7. **Reviews:** both partners submit → the combined score reveals; partner gets a notification.
8. **Memories:** keep a memory, see it on the timeline and the photo wall.
9. **Notifications:** `/settings/notifications` shows the opt-in control; toggling a category
   persists; turning on browser notifications subscribes (needs VAPID + HTTPS).
10. **PWA:** Chrome shows *Install*; installed, it opens standalone into `/home`; go offline
    and navigate → the offline page; ship a change → the "MONO just updated" bar appears.
11. **Database persistence:** everything above is still there after a redeploy and after the
    Neon compute has auto-suspended and woken.
