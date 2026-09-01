# Project Rules — MONO

MONO is a **private two-person relationship / date application**. Only two connected people
ever use it, on their personal devices. It is **not** a public social network, marketplace,
dating app, or review site. Build for real persistence, real auth, real server-side logic,
real validation, real data — never a static prototype.

Rules set by the user for how work on this project is done. Follow them every session.

## Rules

1. **Maintain `memory.md`.** Log every task we work on. When a task is started, add it under
   `## Status` → `### In Progress` and add a dated entry under `## Task Log`. When a task is
   completed, move it to `### Done`, mark its Task Log entry **DONE**, and update the
   `Last updated:` date at the top.

_(More rules to be added as the user sets them.)_

## Architecture invariants (do not violate)

- **Layer separation.** UI, database, auth, business logic, validation, storage, utilities,
  types, and server actions/API each live in their own module. Business rules never live only
  inside React components — they live in `src/server/services/**` and `src/lib/**`.
- **Couple data isolation.** Every protected server operation must resolve the couple from the
  authenticated session and verify membership via `src/lib/authz/**`. Never trust client-supplied
  couple IDs, user IDs, URL params alone, or hidden UI controls.
- **Auth.** No plaintext passwords (bcrypt hashing). Secure httpOnly cookies. Every protected
  operation identifies the authenticated user through `src/lib/auth/**`.
- **No unnecessary dependencies.** Justify every added package.
- **Design tokens.** All colour/spacing/radius/shadow/motion values come from the tokens in
  `src/app/globals.css` (see `docs/design-system.md`). Never hardcode a raw hex or px in a
  component; add a token if one is missing. Reuse `src/components/ui/**` primitives.

## Toolchain notes

- Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript + Prisma + PostgreSQL.
- This Next.js version has breaking changes vs. older training data — consult
  `node_modules/next/dist/docs/` before writing framework code (see `@AGENTS.md`).

@AGENTS.md
