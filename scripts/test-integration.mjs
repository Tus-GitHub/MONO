import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// Deliberately do not load .env or fall back to DATABASE_URL: integration tests write fixtures.
const value = process.env.MONO_TEST_DATABASE_URL;
if (!value) throw new Error("Set MONO_TEST_DATABASE_URL to an isolated local mono_test_* database.");
let url;
try { url = new URL(value); } catch { throw new Error("MONO_TEST_DATABASE_URL must be a valid PostgreSQL URL."); }
if (!["postgres:", "postgresql:"].includes(url.protocol)
  || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  || !/^\/mono_test_[a-z0-9_]+$/i.test(url.pathname)) {
  throw new Error("Integration tests require a loopback PostgreSQL database named mono_test_*.");
}
const env = {
  ...process.env,
  NODE_ENV: "test", DATABASE_URL: value,
  AUTH_SECRET: randomBytes(48).toString("base64url"), APP_URL: "http://localhost:3000",
  STORAGE_DRIVER: "local", STORAGE_LOCAL_ROOT: "./.postgres-test/storage", IMAGE_PROCESSOR: "noop",
  EMAIL_DRIVER: "console", PLACE_PROVIDER: "none", GOOGLE_OAUTH_ENABLED: "false",
  GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GOOGLE_PLACES_API_KEY: "",
  VAPID_PRIVATE_KEY: "", VAPID_PUBLIC_KEY: "", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
};
if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
env.DATABASE_URL = url.toString();
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Test command failed (${code}).`)));
  });
}
await run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
await run("node_modules/vitest/vitest.mjs", ["run", "--config", "vitest.integration.config.ts", ...process.argv.slice(2)]);
