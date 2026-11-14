import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// This credential must never be usable by this script against another project.
export const SCOPE = Object.freeze({
  project: "prj_iLIaFg5JAkdUSpWGcIKz3gN2Qvfo",
  team: "team_yj6MDUTRUHlzAiNXsJvaxto2",
  slug: "tus-githubs-projects",
  repository: "Tus-GitHub/MONO",
  domain: "mono-kappa-beryl.vercel.app",
});
const ACTIVE = new Set(["QUEUED", "INITIALIZING", "BUILDING"]);
const FINISHED = new Set(["READY", "ERROR", "CANCELED", "BLOCKED"]);
const idOf = (value) => value?.id ?? value?.uid;
const stateOf = (value) => value?.readyState ?? value?.state;
const createdOf = (value) => value?.createdAt ?? value?.created;
const validId = (id) => typeof id === "string" && /^dpl_[a-zA-Z0-9]+$/.test(id);
const healthy = (value) => value?.status === 200 && value.body?.status === "ok" && value.body?.database === "up";

function checkProject(project) {
  assert(project.id === SCOPE.project && project.accountId === SCOPE.team && project.name === "mono", "Project/team mismatch; no cleanup permitted.");
  const liveId = project.targets?.production?.id;
  assert(validId(liveId), "Cannot determine the current production deployment.");
  return liveId;
}
function checkDeployment(deployment) {
  assert(validId(idOf(deployment)), "Invalid deployment identifier.");
  assert((deployment.projectId ?? deployment.project?.id) === SCOPE.project, "Deployment belongs to another project.");
  assert(Number.isSafeInteger(createdOf(deployment)) && createdOf(deployment) > 0, "Invalid deployment creation time.");
  assert(FINISHED.has(stateOf(deployment)) || ACTIVE.has(stateOf(deployment)), "Unknown deployment state; cleanup stopped.");
  return deployment;
}
function checkProduction(deployment) {
  checkDeployment(deployment);
  assert(deployment.target === "production" && stateOf(deployment) === "READY", "Preserved production deployment is not READY.");
}
function checkInventory(rows) {
  assert(Array.isArray(rows), "Deployment inventory is unavailable.");
  const ids = new Set();
  for (const row of rows) {
    assert(validId(idOf(row)) && !ids.has(idOf(row)), "Invalid or duplicate inventory identifier.");
    assert(Number.isSafeInteger(createdOf(row)) && createdOf(row) > 0, "Incomplete deployment inventory.");
    assert(FINISHED.has(stateOf(row)) || ACTIVE.has(stateOf(row)), "Unknown inventory state.");
    if (row.projectId !== undefined) assert(row.projectId === SCOPE.project, "Foreign deployment in inventory.");
    ids.add(idOf(row));
  }
}

/** Dependencies are injected so destructive behaviour can be tested without credentials. */
export async function cleanupDeployments({ api, health, apply = false, expectedSha, now = Date.now(), log = () => {} }) {
  const liveId = checkProject(await api.project());
  const live = await api.deployment(liveId);
  checkProduction(live);
  assert(live.meta?.githubCommitRef === "main", "Live production is not a verified main-branch release.");
  if (expectedSha && live.meta?.githubCommitSha !== expectedSha) return { skipped: "A newer release is live; ignore this stale event.", deleted: [] };
  const inventory = await api.list();
  checkInventory(inventory);
  if (inventory.some(row => ACTIVE.has(stateOf(row)))) return { skipped: "Another deployment is in progress; leave everything intact.", deleted: [] };
  assert(inventory.some(row => idOf(row) === liveId), "Live deployment missing from inventory.");
  const previous = inventory.filter(row => row.target === "production" && stateOf(row) === "READY"
    && idOf(row) !== liveId && createdOf(row) < createdOf(live)).sort((a, b) => createdOf(b) - createdOf(a))[0];
  assert(previous, "No previous successful production deployment; keep all versions.");
  const rollback = await api.deployment(idOf(previous));
  checkProduction(rollback);
  const rollbackId = idOf(rollback);
  assert(createdOf(rollback) === createdOf(previous), "Rollback changed during inspection.");

  async function verifyKeepers() {
    assert(checkProject(await api.project()) === liveId, "Live deployment changed; cleanup stopped.");
    for (const keeper of [live, rollback]) {
      const current = await api.deployment(idOf(keeper));
      checkProduction(current);
      assert(current.url === keeper.url && createdOf(current) === createdOf(keeper), "Preserved deployment changed.");
      assert(healthy(await health(current)), "Live or rollback database health failed; keep all remaining versions.");
    }
    const aliases = await api.aliases(liveId);
    assert(Array.isArray(aliases) && aliases.some(alias => alias.alias === SCOPE.domain), "Canonical domain no longer belongs to the preserved live deployment.");
    assert(checkProject(await api.project()) === liveId, "Production changed during health checks.");
  }
  await verifyKeepers();
  const keep = [liveId, rollbackId];
  const candidates = inventory.filter(row => !keep.includes(idOf(row)) && createdOf(row) < now
    && (stateOf(row) !== "READY" || createdOf(row) < createdOf(rollback)));
  assert(candidates.length <= 25, "More than25 candidates; review a dry run before batch cleanup.");
  const result = { apply, keep, deleted: [], wouldDelete: [], aliased: [], skipped: undefined };
  for (const candidate of candidates) {
    const freshInventory = await api.list();
    checkInventory(freshInventory);
    if (freshInventory.some(row => ACTIVE.has(stateOf(row)))) {
      result.skipped = "A deployment started during cleanup; stop and let its release event retry.";
      break;
    }
    assert(keep.every(id => freshInventory.some(row => idOf(row) === id)), "A preserved deployment disappeared.");
    if (!freshInventory.some(row => idOf(row) === idOf(candidate))) continue; // Already removed; never retry DELETE.
    await verifyKeepers();
    const detail = await api.deployment(idOf(candidate));
    checkDeployment(detail);
    assert(createdOf(detail) === createdOf(candidate) && stateOf(detail) === stateOf(candidate), "Candidate changed; cleanup stopped.");
    assert(!ACTIVE.has(stateOf(detail)) && !keep.includes(idOf(detail)), "Refusing to delete an active or preserved deployment.");
    const aliases = await api.aliases(idOf(detail));
    assert(Array.isArray(aliases), "Cannot verify candidate aliases.");
    if (aliases.length) { result.aliased.push(idOf(detail)); continue; }
    assert(checkProject(await api.project()) === liveId, "Production changed before deletion.");
    if (apply) {
      // A failed/uncertain response stops the run. Never automatically retry a deletion.
      await api.remove(idOf(detail));
      result.deleted.push(idOf(detail));
      log(`Deleted obsolete unaliased deployment ${idOf(detail)}.`);
    } else {
      result.wouldDelete.push(idOf(detail));
      log(`Dry run: would delete ${idOf(detail)}.`);
    }
  }
  await verifyKeepers();
  return result;
}

export function createApi(token, fetcher = fetch) {
  assert(typeof token === "string" && token.trim(), "Set the GitHub Actions repository secret VERCEL_TOKEN. Cleanup is disabled until then; nothing was deleted.");
  async function request(route, { method = "GET", query = {} } = {}) {
    const url = new URL(route, "https://api.vercel.com");
    assert(url.origin === "https://api.vercel.com", "Unexpected API origin.");
    url.searchParams.set("teamId", SCOPE.team);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const response = await fetcher(url, { method, headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
    assert(response.ok, `Vercel ${method} request failed (${response.status}); cleanup stopped.`);
    return response.json();
  }
  return {
    project: () => request(`/v9/projects/${SCOPE.project}`),
    async healthToken() {
      const project = await this.project(); checkProject(project);
      const bypass = project.protectionBypass;
      const token = Object.keys(bypass ?? {}).find(key => bypass[key].scope === "automation-bypass");
      assert(token, "No existing automation health credential; protection settings were not changed and no deployments were deleted.");
      return token;
    },
    deployment: (id) => { assert(validId(id), "Invalid deployment identifier."); return request(`/v13/deployments/${id}`); },
    aliases: async (id) => { assert(validId(id), "Invalid deployment identifier."); return (await request(`/v2/deployments/${id}/aliases`)).aliases; },
    async list() {
      const rows = new Map();
      let until;
      for (let page = 0; page < 10; page++) {
        const body = await request("/v7/deployments", { query: { projectId: SCOPE.project, limit: 100, ...(until ? { until } : {}) } });
        assert(Array.isArray(body.deployments) && body.pagination, "Incomplete paginated deployment response.");
        for (const row of body.deployments) rows.set(idOf(row), row);
        const next = body.pagination.next;
        if (next == null) return [...rows.values()];
        assert(Number.isSafeInteger(next) && next > 0 && (!until || next < until), "Invalid or repeating deployment pagination.");
        until = next;
      }
      throw new Error("Deployment inventory exceeds ten pages; nothing can be safely planned.");
    },
    async remove(id) {
      assert(validId(id), "Invalid deletion identifier.");
      const result = await request(`/v13/deployments/${id}`, { method: "DELETE" });
      assert(result.state === "DELETED" && (result.uid ?? result.id) === id, "Deletion acknowledgement was uncertain; stop without retrying.");
    },
  };
}

export function createHealthCheck(api, fetcher = fetch) {
  let token;
  return async deployment => {
    assert(typeof deployment.url === "string" && /^[a-z0-9-]+\.vercel\.app$/.test(deployment.url), "Unsafe deployment health hostname.");
    token ??= await api.healthToken();
    let response;
    try {
      response = await fetcher(`https://${deployment.url}/api/health`, {
        headers: { "x-vercel-protection-bypass": token }, redirect: "manual", signal: AbortSignal.timeout(20_000),
      });
    } catch { throw new Error("Protected health network request failed; cleanup stopped."); }
    assert(response.status === 200, `Protected health returned HTTP ${response.status}; cleanup stopped.`);
    let body;
    try { body = await response.json(); } catch { throw new Error("Health response was not application JSON; cleanup stopped."); }
    return { status: response.status, body };
  };
}

export function checkActionContext(env, expectedSha) {
  if (env.GITHUB_ACTIONS !== "true") return;
  assert(env.GITHUB_REPOSITORY === SCOPE.repository, "Cleanup may run only from MONO's trusted repository.");
  assert((env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/main")
    || (env.GITHUB_EVENT_NAME === "deployment_status" && /^[a-f0-9]{40}$/i.test(expectedSha ?? "")),
  "Cleanup requires a main-branch manual run or a verified deployment SHA.");
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.length <= 1 && (args.length === 0 || ["--apply", "--dry-run"].includes(args[0])), "Use --dry-run (default) or --apply.");
  const apply = args[0] === "--apply";
  const expectedSha = process.env.MONO_EXPECTED_SHA || undefined;
  assert(!expectedSha || /^[a-f0-9]{40}$/i.test(expectedSha), "Invalid release SHA.");
  checkActionContext(process.env, expectedSha);
  const api = createApi(process.env.VERCEL_TOKEN);
  const result = await cleanupDeployments({ api, health: createHealthCheck(api), apply, expectedSha, log: console.log });
  const summary = `MONO deployment cleanup: ${JSON.stringify(result)}`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${summary}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Cleanup stopped safely: ${error.message}`); process.exitCode = 1; });
}
