import assert from "node:assert/strict";
import { readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// Conservative route-trace budgets, not a promise about team-wide billed usage.
// Count shared dependencies per route to leave room for separately packed functions.
const MAX_ROUTE_BYTES = 45 * 1024 * 1024;
const MAX_ALL_ROUTES_BYTES = 2 * 1024 * 1024 * 1024;
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
const root = process.cwd();
const traces = (await walk(path.join(root, ".next/server"))).filter(file => file.endsWith(".nft.json"));
assert(traces.length > 0, "Build Next.js before checking function size.");
const unique = new Map();
const routes = [];
for (const trace of traces) {
  const files = JSON.parse(await readFile(trace, "utf8")).files;
  let bytes = 0;
  for (const relative of files) {
    const absolute = path.resolve(path.dirname(trace), relative);
    assert(!/(?:query_engine[^/\\]*\.node|libquery_engine[^/\\]*\.so\.node)$/i.test(absolute), "Native Prisma query engine returned to a runtime trace.");
    // A checkout may itself live under .postgres-test; reject private files relative
    // to this project, without rejecting every legitimate file in that checkout.
    const relativeToProject = path.relative(root, absolute);
    const privacyPath = relativeToProject.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToProject) ? absolute : relativeToProject;
    assert(!/(?:^|[\\/])(?:\.storage|\.postgres-test|\.screenshots)[\\/]/.test(privacyPath), "Private local/test files must not ship in functions.");
    const size = (await stat(absolute)).size;
    unique.set(absolute, size);
    bytes += size;
  }
  routes.push({ trace: path.relative(root, trace).replaceAll("\\", "/"), bytes });
}
const summedBytes = routes.reduce((sum, route) => sum + route.bytes, 0);
const largestBytes = Math.max(...routes.map(route => route.bytes));
const uniqueBytes = [...unique.values()].reduce((sum, bytes) => sum + bytes, 0);
const compiler = path.join(root, "node_modules/.prisma/client/query_compiler_bg.wasm");
assert(unique.has(compiler) || unique.has(await realpath(compiler)), "Required Prisma WASM compiler is missing from runtime traces.");
const report = { routeCount: routes.length, largestBytes, summedBytes, uniqueBytes, budgets: { largestBytes: MAX_ROUTE_BYTES, summedBytes: MAX_ALL_ROUTES_BYTES }, routes };
await writeFile(".next/function-size-report.json", JSON.stringify(report, null, 2));
console.log(`Runtime traces: ${routes.length} routes; largest ${(largestBytes/1048576).toFixed(2)} MiB; summed ${(summedBytes/1048576).toFixed(2)} MiB; unique ${(uniqueBytes/1048576).toFixed(2)} MiB.`);
assert(largestBytes <= MAX_ROUTE_BYTES, "Function trace exceeds 45 MiB; inspect .next/function-size-report.json.");
assert(summedBytes <= MAX_ALL_ROUTES_BYTES, "Summed function traces exceed 2 GiB; reduce dependencies before deploying.");
