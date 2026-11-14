import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { cleanupDeployments, createApi, createHealthCheck, checkActionContext, SCOPE } from "../scripts/cleanup-vercel-deployments.mjs";

const goodHealth = { status: 200, body: { status: "ok", database: "up" } };
const deployment = (id, createdAt, extra = {}) => ({
  id, projectId: SCOPE.project, createdAt, readyState: "READY", target: "production",
  url: `mono-${id.slice(4)}.vercel.app`, meta: { githubCommitSha: "a".repeat(40), githubCommitRef: "main" }, ...extra,
});
function fixture(extra = []) {
  const rows = [deployment("dpl_live", 300), deployment("dpl_rollback", 200), deployment("dpl_old", 100), ...extra];
  const state = { current: "dpl_live", rows, deleted: [], healthCalls: [], reads: 0, detailReads: new Map(), aliases: new Map(), hook: () => {} };
  state.aliases.set("dpl_live", [{ alias: SCOPE.domain }]);
  const api = {
    async project() { state.hook("project"); return { id: SCOPE.project, accountId: SCOPE.team, name: "mono", targets: { production: { id: state.current } } }; },
    async list() { state.reads++; state.hook("list"); return structuredClone(state.rows); },
    async deployment(id) {
      state.detailReads.set(id, (state.detailReads.get(id) ?? 0) + 1);
      state.hook("deployment", id);
      const row = state.rows.find(row => row.id === id);
      assert(row, "Fixture deployment missing"); return structuredClone(row);
    },
    async aliases(id) { state.hook("aliases", id); return structuredClone(state.aliases.get(id) ?? []); },
    async remove(id) { state.hook("remove", id); state.deleted.push(id); state.rows = state.rows.filter(row => row.id !== id); },
  };
  const health = async row => { state.healthCalls.push(row.id); state.hook("health", row.id); return goodHealth; };
  return { state, api, health };
}
const run = (f, options = {}) => cleanupDeployments({ ...f, now: 1000, ...options });

test("dry-run is the default and preserves all remote deployments", async () => {
  const f = fixture(); const result = await run(f);
  assert.deepEqual(result.keep, ["dpl_live", "dpl_rollback"]);
  assert.deepEqual(result.wouldDelete, ["dpl_old"]); assert.deepEqual(f.state.deleted, []);
  assert(f.state.healthCalls.includes("dpl_live") && f.state.healthCalls.includes("dpl_rollback"));
});
test("apply removes only obsolete deployments, including canceled records, and retains two healthy productions", async () => {
  const f = fixture([deployment("dpl_canceled", 400, { readyState: "CANCELED" })]);
  const result = await run(f, { apply: true });
  assert.deepEqual(result.deleted.sort(), ["dpl_canceled", "dpl_old"]);
  assert.deepEqual(f.state.rows.map(row => row.id), ["dpl_live", "dpl_rollback"]);
});
test("stale release event cannot clean a newer live deployment", async () => {
  const f = fixture(); const result = await run(f, { apply: true, expectedSha: "b".repeat(40) });
  assert.match(result.skipped, /stale event/); assert.deepEqual(f.state.deleted, []);
});

test("production from a different branch cannot authorize cleanup", async () => {
  const f = fixture(); f.state.rows[0].meta.githubCommitRef = "feature";
  await assert.rejects(run(f, { apply: true }), /main-branch release/); assert.deepEqual(f.state.deleted, []);
});

test("Vercel SHA refs are accepted only for deployment events with an expected SHA", () => {
  const env = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: SCOPE.repository, GITHUB_REF: "a".repeat(40), GITHUB_EVENT_NAME: "deployment_status" };
  checkActionContext(env, "a".repeat(40));
  assert.throws(() => checkActionContext(env), /verified deployment SHA/);
  assert.throws(() => checkActionContext({ ...env, GITHUB_REPOSITORY: "other/repo" }, "a".repeat(40)), /trusted repository/);
});

test("manual cleanup cannot run from a feature branch or an unrelated event", () => {
  const env = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: SCOPE.repository, GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch" };
  checkActionContext(env);
  assert.throws(() => checkActionContext({ ...env, GITHUB_REF: "refs/heads/feature" }), /main-branch manual run/);
  assert.throws(() => checkActionContext({ ...env, GITHUB_EVENT_NAME: "pull_request" }), /main-branch manual run/);
});
test("rejects a foreign project before inspecting or deleting deployments", async () => {
  const f = fixture(); f.api.project = async () => ({ id: "another", accountId: SCOPE.team, name: "mono" });
  await assert.rejects(run(f, { apply: true }), /Project\/team mismatch/); assert.deepEqual(f.state.deleted, []);
});
test("rejects a foreign candidate even if an inventory endpoint misbehaves", async () => {
  const f = fixture([deployment("dpl_foreign", 50, { projectId: "other-project" })]);
  await assert.rejects(run(f, { apply: true }), /Foreign deployment/); assert.deepEqual(f.state.deleted, []);
});
test("checks detailed ownership instead of trusting project-scoped inventory alone", async () => {
  const f = fixture(); const get = f.api.deployment;
  f.api.deployment = async id => ({ ...await get(id), ...(id === "dpl_old" ? { projectId: "other" } : {}) });
  await assert.rejects(run(f, { apply: true }), /another project/); assert.deepEqual(f.state.deleted, []);
});
test("preserves an old deployment with any active alias", async () => {
  const f = fixture(); f.state.aliases.set("dpl_old", [{ alias: "active-preview.example.invalid" }]);
  const result = await run(f, { apply: true });
  assert.deepEqual(result.aliased, ["dpl_old"]); assert.deepEqual(f.state.deleted, []);
});
test("missing alias information fails closed", async () => {
  const f = fixture(); const aliases = f.api.aliases;
  f.api.aliases = async id => id === "dpl_old" ? undefined : aliases(id);
  await assert.rejects(run(f, { apply: true }), /verify candidate aliases/); assert.deepEqual(f.state.deleted, []);
});
test("does not clean while another deployment is building", async () => {
  const f = fixture([deployment("dpl_next", 400, { readyState: "BUILDING" })]);
  const result = await run(f, { apply: true }); assert.match(result.skipped, /in progress/); assert.deepEqual(f.state.deleted, []);
});
test("stops when a build starts after planning", async () => {
  const f = fixture(); f.state.hook = kind => {
    if (kind === "list" && f.state.reads === 2) f.state.rows.push(deployment("dpl_next", 400, { readyState: "QUEUED" }));
  };
  const result = await run(f, { apply: true }); assert.match(result.skipped, /started during cleanup/); assert.deepEqual(f.state.deleted, []);
});
test("missing successful rollback prevents every deletion", async () => {
  const f = fixture(); f.state.rows = f.state.rows.filter(row => row.id === "dpl_live");
  await assert.rejects(run(f, { apply: true }), /No previous successful/); assert.deepEqual(f.state.deleted, []);
});
for (const keeper of ["dpl_live", "dpl_rollback"]) {
  test(`unhealthy ${keeper} prevents deletion`, async () => {
    const f = fixture(); f.health = async row => row.id === keeper ? { status: 503, body: { database: "down" } } : goodHealth;
    await assert.rejects(run(f, { apply: true }), /health failed/); assert.deepEqual(f.state.deleted, []);
  });
}
test("an authentication redirect is not a working rollback", async () => {
  const f = fixture(); f.health = async row => row.id === "dpl_rollback" ? { status: 302, body: {} } : goodHealth;
  await assert.rejects(run(f, { apply: true }), /health failed/); assert.deepEqual(f.state.deleted, []);
});
test("a live deployment changing during health checks stops cleanup", async () => {
  const f = fixture(); f.state.hook = (kind, id) => { if (kind === "health" && id === "dpl_rollback") f.state.current = "dpl_next"; };
  await assert.rejects(run(f, { apply: true }), /Production changed/); assert.deepEqual(f.state.deleted, []);
});
test("canonical alias must still belong to the selected live deployment", async () => {
  const f = fixture(); f.state.aliases.set("dpl_live", []);
  await assert.rejects(run(f, { apply: true }), /Canonical domain/); assert.deepEqual(f.state.deleted, []);
});
test("a candidate already removed is not retried", async () => {
  const f = fixture(); f.state.hook = kind => { if (kind === "list" && f.state.reads === 2) f.state.rows = f.state.rows.filter(row => row.id !== "dpl_old"); };
  await run(f, { apply: true }); assert.deepEqual(f.state.deleted, []);
});
test("a candidate state changing after planning stops deletion", async () => {
  const f = fixture(); f.state.hook = (kind, id) => { if (kind === "deployment" && id === "dpl_old") f.state.rows.find(row => row.id === id).readyState = "ERROR"; };
  await assert.rejects(run(f, { apply: true }), /Candidate changed/); assert.deepEqual(f.state.deleted, []);
});
test("a preserved rollback losing READY state stops deletion", async () => {
  const f = fixture(); f.state.hook = (kind, id) => {
    if (kind === "deployment" && id === "dpl_rollback" && f.state.detailReads.get(id) === 2) f.state.rows.find(row => row.id === id).readyState = "ERROR";
  };
  await assert.rejects(run(f, { apply: true }), /not READY/); assert.deepEqual(f.state.deleted, []);
});
test("newer preview and equal-timestamp versions are preserved", async () => {
  const f = fixture([deployment("dpl_preview", 250, { target: null }), deployment("dpl_equal", 200, { target: null })]);
  await run(f, { apply: true }); assert.deepEqual(f.state.deleted, ["dpl_old"]);
});
test("an uncertain DELETE stops before deleting another candidate", async () => {
  const f = fixture([deployment("dpl_older", 50)]); const calls = [];
  f.api.remove = async id => { calls.push(id); throw new Error("uncertain acknowledgement"); };
  await assert.rejects(run(f, { apply: true }), /uncertain acknowledgement/); assert.deepEqual(calls, ["dpl_old"]);
});
test("over-large cleanup batches need explicit review", async () => {
  const f = fixture(Array.from({ length: 25 }, (_, i) => deployment(`dpl_extra${i}`, i + 1)));
  await assert.rejects(run(f, { apply: true }), /More than25/); assert.deepEqual(f.state.deleted, []);
});
test("unknown inventory states and malformed creation times cannot be pruned", async () => {
  for (const change of [{ readyState: "UNKNOWN" }, { createdAt: undefined }]) {
    const f = fixture(); Object.assign(f.state.rows[2], change);
    await assert.rejects(run(f, { apply: true })); assert.deepEqual(f.state.deleted, []);
  }
});
test("missing API credential performs no network operation", () => {
  assert.throws(() => createApi("", () => { throw new Error("network must not be called"); }), /secret VERCEL_TOKEN/);
});
test("REST inventory paginates with fixed team/project scope", async () => {
  const calls = [];
  const api = createApi("fixture-only", async (url, options) => {
    calls.push({ url, method: options.method });
    assert.equal(url.origin, "https://api.vercel.com"); assert.equal(url.searchParams.get("teamId"), SCOPE.team);
    assert.equal(url.searchParams.get("projectId"), SCOPE.project);
    assert.equal(options.redirect, "error"); assert.equal(options.headers.Authorization, "Bearer fixture-only");
    return Response.json({ deployments: [deployment(calls.length === 1 ? "dpl_live" : "dpl_old", calls.length === 1 ? 300 : 100)], pagination: { next: calls.length === 1 ? 200 : null } });
  });
  assert.equal((await api.list()).length, 2); assert.equal(calls[1].url.searchParams.get("until"), "200");
});
test("repeating pagination stops before any deletion can be planned", async () => {
  const api = createApi("fixture-only", async () => Response.json({ deployments: [], pagination: { next: 200 } }));
  await assert.rejects(api.list(), /repeating deployment pagination/);
});
test("REST DELETE requires an exact acknowledgement and is never retried", async () => {
  let calls = 0;
  const api = createApi("fixture-only", async (url, options) => {
    calls++; assert.equal(options.method, "DELETE"); assert.equal(url.searchParams.get("teamId"), SCOPE.team);
    return Response.json({ state: "DELETED", uid: "dpl_wrong" });
  });
  await assert.rejects(api.remove("dpl_old"), /uncertain/); assert.equal(calls, 1);
});
test("API errors never print returned credential-bearing response bodies", async () => {
  const api = createApi("fixture-only", async () => new Response("sensitive upstream body", { status: 403 }));
  await assert.rejects(api.project(), error => !error.message.includes("sensitive") && /403/.test(error.message));
});
test("protected health pins host/path and caches access separately per keeper URL", async () => {
  let calls = 0, now = Date.now(); const requests = [];
  const health = createHealthCheck({ async healthToken() { calls++; return { secret: "fixture-private", expiresAt: now + 60000 }; } }, async (url, options) => {
    requests.push({ url, options }); return Response.json(goodHealth.body);
  }, () => now);
  assert.deepEqual(await health(deployment("dpl_live", 300)), goodHealth);
  await health(deployment("dpl_live", 300)); assert.equal(calls, 1);
  await health(deployment("dpl_rollback", 200)); assert.equal(calls, 2);
  now += 36000; await health(deployment("dpl_live", 300)); assert.equal(calls, 3);
  assert.equal(requests[0].url.origin, "https://mono-live.vercel.app");
  assert.equal(requests[0].url.pathname, "/api/health");
  assert.equal(requests[0].options.redirect, "manual");
  assert.equal(requests[0].url.searchParams.get("x-vercel-protection-bypass"), "fixture-private");
  await assert.rejects(health({ url: "evil.invalid/;delete" }), /Unsafe/);
});
test("protected health rejects redirects/HTML and redacts network failures", async () => {
  const api = { async healthToken() { return { secret: "fixture-private", expiresAt: Date.now() + 60000 }; } };
  await assert.rejects(createHealthCheck(api, async () => new Response("", { status: 302 }), undefined, async () => {})(deployment("dpl_live", 300)), /HTTP 302/);
  await assert.rejects(createHealthCheck(api, async () => new Response("<html>sign in</html>"))(deployment("dpl_live", 300)), /not application JSON/);
  await assert.rejects(createHealthCheck(api, async () => { throw Error("fixture-private"); })(deployment("dpl_live", 300)), error => !error.message.includes("fixture-private") && /network/.test(error.message));
});
test("temporary health access is deployment-scoped with exactly 60-second TTL", async () => {
  const calls = [], createdAt = Date.now(), expires = Math.floor(createdAt / 1000) + 60;
  const api = createApi("fixture-only", async (url, options) => {
    calls.push(options.method); assert.equal(url.searchParams.get("teamId"), SCOPE.team);
    if (options.method === "GET") return Response.json(deployment("dpl_live", 300));
    assert.equal(url.pathname, "/aliases/dpl_live/protection-bypass"); assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { ttl: 60 });
    return Response.json({ protectionBypass: { "fixture-private": { scope: "shareable-link", createdAt, expires } } });
  });
  assert.deepEqual(await api.healthToken(deployment("dpl_live", 300)), { secret: "fixture-private", expiresAt: expires * 1000 });
  assert.deepEqual(calls, ["GET", "PATCH"]);
});
test("unbounded, expired and overlong access responses cannot authorize health", async () => {
  for (const value of [{ scope: "shareable-link", createdAt: Date.now() }, { scope: "shareable-link", createdAt: Date.now() - 120000, expires: Math.floor(Date.now()/1000) - 60 }, { scope: "shareable-link", createdAt: Date.now(), expires: Math.floor(Date.now()/1000) + 120 }, { scope: "automation-bypass", createdAt: Date.now(), expires: Math.floor(Date.now()/1000) + 60 }]) {
    const api = createApi("fixture-only", async (url, options) => Response.json(options.method === "GET" ? deployment("dpl_live", 300) : { protectionBypass: { "fixture-private": value } }));
    await assert.rejects(api.healthToken(deployment("dpl_live", 300)), /bounded 60-second/);
  }
});
test("a foreign deployment cannot request temporary health access", async () => {
  let calls = 0; const api = createApi("fixture-only", async () => { calls++; throw Error("must not call"); });
  await assert.rejects(api.healthToken(deployment("dpl_live", 300, { projectId: "other" })), /another project/); assert.equal(calls, 0);
});
test("a keeper that changes before temporary access is not modified", async () => {
  let calls = 0; const api = createApi("fixture-only", async () => { calls++; return Response.json(deployment("dpl_live", 301)); });
  await assert.rejects(api.healthToken(deployment("dpl_live", 300)), /Health deployment changed/); assert.equal(calls, 1);
});

test("workflow accepts only trusted successful main production events and standard free runners", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deployment-cleanup.yml", import.meta.url), "utf8");
  for (const expected of ["deployment_status:", "refs/heads/main", "state == 'success'", "environment == 'Production'", "vercel[bot]", "cancel-in-progress: false", "contents: read", "ubuntu-24.04", "persist-credentials: false", "secrets.VERCEL_TOKEN", "default: dry-run"]) assert(workflow.includes(expected), expected);
  assert(!workflow.includes("pull_request_target") && !workflow.includes("id-token: write"));
  assert(workflow.includes("vars.MONO_DEPLOYMENT_CLEANUP_ENABLED == 'true' && 'apply' || 'dry-run'"));
});
