# Deploying MONO

MONO is a standard **Next.js 16 (App Router) + Prisma + PostgreSQL** app. It runs on any host
that can build a Next.js server and reach a Postgres database and an S3-compatible bucket. The
reference target below is **Vercel + Neon + Cloudflare R2**, all with a free tier; every piece
is swappable.

Nothing here needs a secret in the repo. `.env*` is git-ignored (`.env.example` is the only
tracked env file) — every secret lives in the host's environment settings.

---

## 1. Environments

| | Database | Storage | `NODE_ENV` | Notes |
|---|---|---|---|---|
| **Development** | local Postgres or a Neon *dev* branch | `local` (writes `./.storage`) | `development` | `.env` on your machine. Dev secrets are fine. |
| **Test** | same dev DB, or a throwaway one | `local` or `s3` | `test` | `npm test` is pure-unit (no DB). E2E uses the dev DB. |
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
| `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...`), ending `?sslmode=require&pgbouncer=true&connect_timeout=15` |
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
| `EMAIL_DRIVER` | `console` (password-reset links go to server logs) — set up SMTP later |
| `EMAIL_FROM` | `MONO <no-reply@your-domain>` |
| `PLACE_PROVIDER` | `none` |

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
2. In *Connect*, enable **Connection pooling** and copy the **pooled** string (host contains
   `-pooler`). That's `DATABASE_URL`.
3. First deploy runs the migration automatically (below). To do it by hand:
   `DATABASE_URL=<prod pooled> npx prisma migrate deploy`.
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
   prisma generate && prisma migrate deploy && next build
   ```
   (Local `npm run build` is just `next build` — no DB needed, so `publish` and CI stay fast.)
3. **Install command:** default (`npm install`; `postinstall` runs `prisma generate`).
4. **Output directory:** default.
5. Add the environment variables from §2 (Production scope).
6. **Production Branch:** `main` (Settings → Git).
7. **Deploy.** The build applies migrations to the prod DB, then builds. If a migration fails
   the build fails and the previous deployment keeps serving.

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
