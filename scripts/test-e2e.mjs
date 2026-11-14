import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { once } from "node:events";

// Explicit loopback-only database: never fall back to the application DATABASE_URL/.env.
const value = process.env.MONO_TEST_DATABASE_URL;
if (!value) throw new Error("Set MONO_TEST_DATABASE_URL to a local mono_test_e2e_* database.");
const url = new URL(value);
if (!["postgresql:", "postgres:"].includes(url.protocol)
  || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  || !/^\/mono_test_e2e_[a-z0-9_]+$/i.test(url.pathname)) {
  throw new Error("E2E requires a loopback PostgreSQL database named mono_test_e2e_*.");
}
if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
const engine = process.env.MONO_E2E_BROWSER ?? "chrome";
if (!["chrome", "firefox"].includes(engine)) throw new Error("MONO_E2E_BROWSER must be chrome or firefox.");
const suites = { journey: ["journey.mjs", "runJourney"], account: ["account.mjs", "runAccountControls"], pagination: ["pagination.mjs", "runPagination"], workflows: ["workflows.mjs", "runWorkflows"], compatibility: ["compatibility.mjs", "runCompatibility"], settings: ["settings.mjs", "runSettings"], registration: ["registration.mjs", "runRegistration"], states: ["state-machines.mjs", "runStateMachines"] };
const selected = process.argv.slice(2).length ? process.argv.slice(2) : engine === "firefox" ? ["compatibility"] : Object.keys(suites);
if (selected.some((name) => !suites[name])) throw new Error("Choose journey, account, pagination, workflows, compatibility, settings, registration, or states.");
// The original suites use CDP-only timezone/offline emulation. Never count a skipped
// emulation check as Firefox coverage; its separate suite uses native BiDi operations.
if (engine === "firefox" && selected.some((name) => name !== "compatibility")) throw new Error("Firefox runs compatibility; the other suites require Chromium CDP emulation.");
const port = Number(process.env.MONO_E2E_PORT ?? 3217);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local E2E port.");
const baseUrl = `http://127.0.0.1:${port}`;
const runId = randomBytes(8).toString("hex");
const artifactDir = path.resolve(".postgres-test", "e2e", runId);
const storageRoot = path.join(artifactDir, "storage");
const executablePath = engine === "firefox" ? process.env.FIREFOX_PATH || [
  "C:/Program Files/Mozilla Firefox/firefox.exe", "C:/Program Files (x86)/Mozilla Firefox/firefox.exe",
  "/usr/bin/firefox", "/opt/firefox/firefox", "/Applications/Firefox.app/Contents/MacOS/firefox",
].find(existsSync) : process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!executablePath || !existsSync(executablePath)) throw new Error(`Set ${engine === "firefox" ? "FIREFOX_PATH" : "CHROME_PATH"} to an installed ${engine} browser.`);
await mkdir(storageRoot, { recursive: true });

Object.assign(process.env, {
  NODE_ENV: "development", DATABASE_URL: url.toString(), AUTH_SECRET: randomBytes(48).toString("base64url"),
  APP_URL: baseUrl, SESSION_COOKIE_NAME: "mono_e2e_session", SESSION_MAX_AGE_DAYS: "30", CRON_SECRET: "",
  STORAGE_DRIVER: "local", STORAGE_LOCAL_ROOT: storageRoot, STORAGE_PUBLIC_PREFIX: "/media", IMAGE_PROCESSOR: "sharp",
  EMAIL_DRIVER: "console", EMAIL_FROM: "MONO E2E <no-reply@example.invalid>", SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "",
  S3_BUCKET: "", S3_ACCESS_KEY_ID: "", S3_SECRET_ACCESS_KEY: "", S3_ENDPOINT: "",
  PLACE_PROVIDER: "none", GOOGLE_OAUTH_ENABLED: "false", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GOOGLE_PLACES_API_KEY: "",
  VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "", NEXT_TELEMETRY_DISABLED: "1",
});
const serverEnv = { ...process.env };
const trackedGeneratedFiles = ["next-env.d.ts", "tsconfig.json"];
const originals = new Map(await Promise.all(trackedGeneratedFiles.map(async (file) => {
  try { return [file, await readFile(file)]; }
  catch (error) {
    if (file === "next-env.d.ts" && error.code === "ENOENT") return [file, null];
    throw error;
  }
})));
const log = createWriteStream(path.join(artifactDir, "server.log"));
function launch(args) {
  const child = spawn(process.execPath, args, { env: serverEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.completion = new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code)); });
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    await once(killer, "exit");
  } else { child.kill("SIGTERM"); }
  await Promise.race([child.completion, new Promise((resolve) => setTimeout(resolve, 5_000))]);
}
async function assertFreePort() {
  // Windows may release a killed server's socket just after its process-exit event.
  for (let attempt = 0; ; attempt++) {
    const probe = createServer();
    try {
      await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", resolve); });
      await new Promise((resolve) => probe.close(resolve));
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE" || attempt >= 49) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
async function ready(child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Local test server exited; inspect the fixture server log.");
    try { if ((await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* warming */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Local test server did not become ready.");
}

async function cleanupFixtures() {
  if (!prisma) return;
  const users = await prisma.user.findMany({ where: { email: { startsWith: `e2e-${runId}-` } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  const couples = await prisma.couple.findMany({ where: { createdById: { in: ids } }, select: { id: true } });
  const prefixes = [...ids.map((id) => `users/${id}/`), ...couples.map((couple) => `couples/${couple.id}/`)];
  if (prefixes.length) await prisma.storageCleanup.deleteMany({ where: { OR: prefixes.map((prefix) => ({ key: { startsWith: prefix } })) } });
  await prisma.couple.deleteMany({ where: { id: { in: couples.map((couple) => couple.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Cleaned ${ids.length} fixture accounts and ${couples.length} fixture spaces.`);
}
let server, browser, prisma;
let failed = false;
let failure;
let browserVersion;
const results = [];
try {
  await assertFreePort();
  const migration = launch(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  if (await migration.completion !== 0) throw new Error("Isolated test migrations failed; inspect fixture server log.");
  const { PrismaClient } = await import("@prisma/client");
  const { createDatabaseAdapter } = await import("../src/lib/db/pg-adapter.mjs");
  prisma = new PrismaClient({ adapter: createDatabaseAdapter(process.env.DATABASE_URL) });
  const { default: puppeteer } = await import("puppeteer-core");
  browser = await puppeteer.launch({ browser: engine, executablePath, headless: true, args: engine === "chrome" ? ["--disable-background-networking", "--no-first-run"] : [] });
  browserVersion = await browser.version();
  console.log(`Browser: ${browserVersion}`);
  if (engine === "firefox") {
    // Finish a native navigation before creating isolated BiDi user contexts;
    // Firefox can otherwise discard its initial window during first-run startup.
    const warmup = await browser.newPage();
    await warmup.goto("about:blank");
  }
  for (const name of selected) {
    await assertFreePort();
    server = launch(["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)]);
    await ready(server);
    console.log(`RUN ${name} (${baseUrl}, isolated fixtures)`);
    const [file, entry] = suites[name];
    const suite = await import(`../test/e2e/${file}`);
    const startedAt = Date.now();
    const result = await suite[entry]({ browser, baseUrl, prisma, runId, artifactDir, storageRoot });
    results.push({ suite: name, ...result, durationMs: Date.now() - startedAt });
    await stop(server); server = null;
    // Names are unique across active accounts; suites must not retain each other's fixtures.
    await cleanupFixtures();
    console.log(`PASS ${name}: ${result.checks} checks`);
  }
} catch (error) {
  failed = true;
  failure = error instanceof Error ? error.message : "unknown failure";
  console.error(`E2E failed: ${failure}`);
  if (error instanceof Error) console.error(error.stack);
} finally {
  await browser?.close();
  await stop(server);
  if (prisma) {
    try {
      await cleanupFixtures();
    } catch { failed = true; console.error("Fixture cleanup failed; inspect the isolated test database."); }
    await prisma.$disconnect();
  }
  // Only this run's temporary storage can be removed; screenshots/logs stay for diagnosis.
  const expectedParent = path.resolve(".postgres-test", "e2e");
  if (path.dirname(artifactDir) !== expectedParent || storageRoot !== path.join(expectedParent, runId, "storage")) throw new Error("Unsafe test cleanup path.");
  await rm(storageRoot, { recursive: true, force: true });
  for (const [file, original] of originals) {
    if (original === null) await rm(file, { force: true });
    else await writeFile(file, original);
  }
  log.end();
  await writeFile(path.join(artifactDir, "results.json"), JSON.stringify({ passed: !failed, browser: browserVersion ?? engine, failure, results }, null, 2));
}
console.log(`E2E artifacts: ${artifactDir}`);
process.exitCode = failed ? 1 : 0;
