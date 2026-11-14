# Automatic MONO deployment cleanup

**Active since 15 November 2026.** The release-event run and its automatic-apply
replay passed. The [first apply run](https://github.com/Tus-GitHub/MONO/actions/runs/43628696457)
removed five obsolete deployments and preserved the healthy live app and rollback.

The public `Tus-GitHub/MONO` repository uses standard GitHub-hosted Ubuntu runners,
which are free for public repositories. Cleanup creates no Vercel function, cron
job, paid runner, subscription or billing setting. Existing bundle-size guards
and Vercel retention remain enabled.

## One-time credential setup

Add an Actions repository secret named **`VERCEL_TOKEN`** at:

https://github.com/Tus-GitHub/MONO/settings/secrets/actions

Use a Vercel API token scoped to `tus-github's projects` → `mono`, with permission
to read this project and delete its deployments. Choose the narrowest permissions
Vercel offers. Configure the credential directly in GitHub; do not paste it into chat,
source files or workflow inputs. Never turn on billing or a trial to do this.
If the token expires or is revoked, cleanup fails safely until it is replaced.

On 14 November 2026, the authorized admin setup stored the project-scoped token in
GitHub. Its expiration is **12 February 2027**. Replace the GitHub secret before
that date to keep unattended cleanup running. Token values are never recorded here.

The connected Codex tools are not a credential store for GitHub Actions. A missing
secret produces a clear workflow error and **no deletion**. The activation variable
was enabled only after a real dry-run passed.

## When it runs

`.github/workflows/deployment-cleanup.yml` listens to successful Vercel
`deployment_status` events for MONO's `main` branch and `Production` environment.
The creator of both the deployment and its status must be `vercel[bot]`. Existing
MONO deployment records use those exact values. Vercel reports the deployed SHA as its Git ref; the script verifies that SHA
against the current production deployment and checks its commit branch is `main`.
Keep Vercel's Git setting for `deployment_status` events enabled. Failed, canceled, skipped, preview and fork
deployments cannot trigger destructive cleanup.

The Actions workflow also has a manual **Run workflow** control, defaulting to
`dry-run`. Run it once to inspect the preserved IDs and proposed deletions; choose
`apply` when you need manual cleanup. Automatic runs start as dry-runs. After a
real dry-run succeeds, set repository Actions variable
**`MONO_DEPLOYMENT_CLEANUP_ENABLED`** to **`true`** to enable automatic deletion
after successful releases. Removing the variable returns automatic runs to dry-run.
This is an activation guard, not a billing or approval feature. Concurrency serializes runs;
stale release events are ignored. A missing credential does not stop deployment
or change which app is live.

## What is preserved

The script resolves the live deployment from Vercel's project production target,
checks ownership against fixed MONO project/team IDs, and verifies the canonical
domain still belongs to it. It selects the most recent earlier READY production
deployment as rollback. Both must return HTTP 200 and application JSON containing
`status: ok` and `database: up` before anything is removed.

Health checks use built-in Node HTTPS requests with a fixed deployment host and
`/api/health` path. The owner explicitly approved temporary access on 14 November
2026: only the live and selected rollback deployment receive shareable credentials
with a **60-second TTL**. The script verifies scope/READY state before requesting
access, validates the returned expiration, and revokes its generated credential immediately after each health request. A brief bounded wait handles propagation; DELETE is never retried.
Dry-runs can request this temporary access but never delete deployments.
On Hobby, sharing is limited to one link per account. Checks run sequentially;
creating a link replaces existing shareable access, so do not depend on persistent
share links in the same Hobby account while this cleanup is enabled.
Credentials stay in process memory, are never logged, and use `_vercel_share` only on the
verified keeper URL. The share-link cookie exchange allows one explicitly checked
redirect to the identical host and `/api/health` path without a query; external
redirects are rejected, and cookies stay only in process memory. Application login remains
required. No permanent project bypass credential, protection disablement, extra
GitHub secret, CLI install or billing change is made.

After a release, older unaliased READY deployments before the rollback, and
terminal canceled/errored/blocked records, are eligible for recoverable deletion.
Newer previews, versions with aliases and in-flight deployments are preserved.
In the usual production-only case, two built deployments remain: live and rollback.
Protected extra aliases or ongoing work can leave more; safety wins over a count.

The script rechecks scope, both health endpoints, the live target and candidate
aliases before every deletion. It stops if a deployment begins or the live version
changes. It never retries uncertain DELETE requests, purges Recently Deleted,
touches another project, promotes a deployment, runs a migration or calls billing
APIs. More than 25 candidates or ten inventory pages requires manual review.

## Verification and operation

`npm run test:deployment-cleanup` exercises mocked API/health failures and races
without network access or secrets. The normal CI checks and cleanup job run it.
For a local dry run with VERCEL_TOKEN set in the environment:

```sh
npm run cleanup:deployments
```

Deleting history stops its future storage contribution. It cannot erase the
already recorded daily maxima in the rolling usage report, nor guarantee the
entire shared team's future usage stays under 10 GB. Do not delete the live app or
rollback merely to change the historic meter.

References:
- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/deployments/managing-deployments
- https://vercel.com/docs/cli/curl
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://vercel.com/docs/deployment-storage

- https://github.com/vercel/sdk/blob/main/src/funcs/aliasesPatchUrlProtectionBypass.ts
