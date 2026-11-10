# MONO

A **private space for two**. MONO lets exactly two connected people plan dates, capture what
actually happened, review them together, decide what is worth doing again, track spending, and
keep memories. It is not a social network, marketplace, dating app, or review site.

## Stack

| Concern        | Choice                                                        |
| -------------- | ----------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, Turbopack), React 19                 |
| Language       | TypeScript (strict)                                          |
| Styling        | Tailwind CSS v4                                              |
| Database       | PostgreSQL + Prisma ORM                                      |
| Auth           | Hand-rolled sessions — bcrypt hashing, signed JWT cookie (`jose`), Google-ready |
| Validation     | Zod                                                          |
| Storage        | Local disk (dev) and private S3/R2 (production)            |
| Email          | Console (dev) and authenticated TLS SMTP                |

Dependencies are kept deliberately small: `@prisma/client`, `prisma`, `bcryptjs`, `jose`,
`zod`, `tsx`, `nodemailer`, and `sharp` (server-side thumbnail + blur-placeholder generation for the private
photo pipeline — already pulled in transitively by Next, made explicit here). Photo processing
is behind the `ImageProcessor` abstraction, so `sharp` can be swapped or disabled
(`IMAGE_PROCESSOR=noop`).

## Project layout

```
src/
  app/                     Routes only (thin). Route groups:
    (marketing)/           Public landing
    (auth)/                login · register · forgot-password · reset-password
    (app)/                 Protected shell + dashboard + onboarding
    api/                   health · auth/session · auth/google/{start,callback}
    media/[...key]/        Authorized private file streaming
  components/
    ui/                    Primitives (Button, Input, Field, Card, Alert …)
    forms/                 Client forms wired to server actions
    layout/                AppShell, Logo
  lib/
    auth/                  password · session · session-cookie · current-user · guards · oauth/google
    authz/                 Couple isolation — every couple-scoped check lives here
    db/                    Prisma client singleton
    date/                  Date lifecycle rules (pure)
    validation/            Zod schemas
    storage/               StorageDriver + local/s3
    email/                 EmailDriver + console/smtp + templates
    review/                Default review categories (plain data)
    utils/                 cn · crypto · result
    errors.ts             Domain error hierarchy
  server/
    services/             Business logic (auth, couple, date, review categories)
    actions/              "use server" boundaries between forms and services
  config/
    env.ts                Zod-validated environment
  types/                  Shared types (Prisma enums re-exported)
prisma/
  schema.prisma           Application models + enums
  seed.ts                 Backfills default review categories
```

**Business rules never live only in components.** They live in `src/server/services/**` and
`src/lib/**`. See [docs/architecture.md](docs/architecture.md).

Portable media archives and protected restore are documented in [archive/restore](docs/archive-restore.md).
Per-device session revocation and password changes are documented in [account/session controls](docs/account-sessions.md).
Settings includes password changes, device/session management and portable archive restore,
using the existing UI style. Apply pending migrations before running this
version against an existing database; existing cookies will require a fresh login.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Provision a PostgreSQL database + role (do not use the `postgres` superuser):

   ```sql
   CREATE ROLE mono_app WITH LOGIN PASSWORD 'a-strong-password';
   CREATE DATABASE mono_dev OWNER mono_app;
   CREATE DATABASE mono_shadow OWNER mono_app;
   ```

3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and a 32+ char `AUTH_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

4. Run the first migration and generate the client:

   ```bash
   npm run db:migrate -- --name init
   npm run db:seed        # optional
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build (also type-checks)
```

## Status

Core date planning, calendar/history, expenses, photos, independent reviews, memories,
couple insights, Explore, settings, export, notifications, and PWA support are implemented.
SMTP delivery, authenticated scheduled reminders, Google sign-in and Places integrations,
and device draft recovery are implemented with regression tests. Nodemailer handles the
SMTP protocol/TLS and MIME formatting rather than adding a custom mail protocol implementation.

Credentials are intentionally left for deployment: see `.env.example` and `DEPLOY.md`.

Production password-recovery email is configured through Brevo SMTP with MONO's own HTML/text
template and public reset links. The live Vercel send path was verified on 2026-11-10; other
integration activation remains separate. SMTP secrets are stored only in Vercel production.

## Database regression checks

The audit remediation adds private-review filtering, transactional plan/review writes, stale
form detection, timezone-aware scheduling, currency-safe totals, and initial SQL constraints.
The migration `20261105000000_integrity_and_plan_versions` must be applied before starting this
version against an existing database. Preflight existing rows first; no live migration is automatic
when running `npm run dev`.

Run `npm test` for unit checks. For actual PostgreSQL behavior, set an explicit local
`MONO_TEST_DATABASE_URL` pointing at an isolated `mono_test_*` database, then run
`npm run test:integration`. See [testing instructions](docs/testing.md) for setup and scope.
GitHub Actions runs both suites plus lint, TypeScript and a production build using a disposable database.

Run `npm run test:e2e` for real Chrome browser journeys with a separate local
`mono_test_e2e_*` database. The runner starts/stops its own app server and cleans only its test
fixtures. See [browser testing](docs/testing.md#browser-e2e) for setup, coverage and device limits.

The reliability follow-up also adds `20261105010000_durable_delivery_and_cleanup`. Apply all
pending migrations before starting the updated app. It preserves usable legacy subscriptions,
supports multiple browsers, and persists push retries and media cleanup work. The existing
authenticated reminder scheduler/worker processes these queues; no new key is required.

Deleted/replaced media is inaccessible through the media route and retained for seven days before
physical cleanup. The separate portable archive API supports bounded active-content downloads
with embedded media and restore into an empty space with both partners' approvals.
Run `npm run check:email` to verify SMTP without sending mail, and configure either an HTTP
scheduler or `npm run reminders:worker` for closed-app reminders. Real-provider delivery,
production deployment, and real-device checks must still be verified after configuration.

The existing UI is the reference for future work; preserve its layouts, styling and primitives
unless the user explicitly requests a design change (see `CLAUDE.md`).
