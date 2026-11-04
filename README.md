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
  schema.prisma           21 models + enums
  seed.ts                 Backfills default review categories
```

**Business rules never live only in components.** They live in `src/server/services/**` and
`src/lib/**`. See [docs/architecture.md](docs/architecture.md).

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
Run `npm run check:email` to verify SMTP without sending mail, and configure either an HTTP
scheduler or `npm run reminders:worker` for closed-app reminders. Real-provider delivery,
production deployment, and real-device checks must still be verified after configuration.

The existing UI is the reference for future work; preserve its layouts, styling and primitives
unless the user explicitly requests a design change (see `CLAUDE.md`).
