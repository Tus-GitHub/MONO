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
| Storage        | Driver abstraction (local disk now, S3/R2 later)            |
| Email          | Driver abstraction (console now, SMTP later)                |

Dependencies are kept deliberately small: `@prisma/client`, `prisma`, `bcryptjs`, `jose`,
`zod`, `tsx`, and `sharp` (server-side thumbnail + blur-placeholder generation for the private
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
  schema.prisma           15 models + enums
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

The foundation is complete and verified (typecheck, lint, build, dev server all green).
Detailed feature pages (Dates, Places, Memories, Expenses, Reviews) are intentionally not
implemented yet — the architecture is in place for them to build on.
