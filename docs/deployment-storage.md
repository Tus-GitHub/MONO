# Keeping MONO's Vercel functions small

MONO stays on the existing free services. No Accelerate subscription, database
migration, paid storage or Vercel upgrade is needed for this optimization.

## Runtime dependencies

Prisma CLI, Client and the official PostgreSQL adapter are pinned to6.19.3.
The generated Client uses `engineType = "client"`, replacing the large native
query engine with Prisma's JavaScript/WASM compiler and `pg` database driver.
The singleton client, PostgreSQL schema and URL connection cap remain in use.
Remote PostgreSQL connections verify TLS certificates. Schema migration commands
still use the existing Prisma CLI and migration history.

`next.config.ts` explicitly traces the small `query_compiler_bg.wasm` asset.
Prisma loads it through a computed directory, so an incomplete trace can otherwise
produce a small but broken deployment. The build gate requires that asset.
Sharp remains installed: real photo processing, thumbnails and archive import
need its native image libraries.

Local and Vercel production builds both explicitly use Next's supported Webpack
builder, matching the production artifacts exercised by the packaged-runtime and
browser checks. There is no temporary cache override in the released configuration.

Adapter errors have a different metadata layout. The existing serialization/
deadlock retries and duplicate-name validation recognize both metadata formats;
their integration tests must pass before release.

## Preventing growth

`npm run check:function-size` checks a completed Next production build. It fails
on a returning native Prisma query engine, private local/test files, a route
trace over45MiB, or summed route traces over2GiB. It writes the full report to
`.next/function-size-report.json`. Both `build` and `vercel-build` run this gate after Next builds.
Shared files are counted once per route for the summed budget, conservatively.
These are source trace budgets, not a claim that Vercel's billed usage equals
their sum; confirm actual packaging on each deployment's Resources page.

The ignored-build script skips only documentation changes compared with the
last successful deployment SHA supplied by Vercel. It does not use `HEAD^`:
that could hide a runtime change in an earlier undeployed commit. Code,
configuration, dependencies and schema changes build normally. Missing history,
the same SHA or `MONO_FORCE_BUILD=1` also builds. Force this variable when an
environment change requires rebuilding unchanged source.

## Validation recorded on 2026-11-14

Local production traces:80 routes; largest26.81MiB; summed529.36MiB;
unique29.53MiB versus47.26MiB in the native-engine baseline, about37.5% smaller.
These figures include the required WASM compiler and Windows Sharp libraries;
Linux/Vercel packaging and billing must be checked separately.

492 unit tests,174 isolated PostgreSQL integration tests, lint, the production
build/size gate and a compiled health-handler query using only171 traced files
pass.11 online browser account checks pass, covering authentication, session
revocation, real image processing, private exports, approved archive restore,
password recovery and account deletion. Full browser coverage is not claimed:
the offline, plan-edit and review-navigation checks also fail against a copy of
the existing native-engine production build. Original assertions remain intact.

## Storage operations

- Inspect Team→Usage→Deployment Storage→Functions Storage→Projects.
- Inspect a deployment's Resources page to compare packaged function sizes.
- Keep the live production deployment and a known-good rollback. Delete only
  older unused, unaliased deployments through the recoverable delete action.
- Project Settings→Build and Deployment→Deployment Retention Policy controls
  automatic cleanup. Current production/branch aliases and Hobby's recent
  deployment exceptions can protect versions beyond the selected duration.
- Do not purge Recently Deleted just to lower storage accounting. Official
  Vercel documentation says a deleted deployment stops contributing immediately,
  while previously recorded daily usage remains in the reporting period.

The allowance is shared with other team projects. This code cannot guarantee
that the whole team always stays below10GB or erase usage already recorded.
Retention, smaller bundles and fewer duplicate documentation deployments reduce
future growth; review the team meter as well as MONO's own build report.

References:
- https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/no-rust-engine
- https://vercel.com/docs/deployment-storage
- https://vercel.com/docs/deployment-retention
- https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
