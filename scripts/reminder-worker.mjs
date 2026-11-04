/** Run on an always-on host. --once is suitable for a system cron job. */
import { loadEnvFile } from "node:process";
import { setTimeout as delay } from "node:timers/promises";

try { loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }

const secret = process.env.CRON_SECRET;
const origin = process.env.APP_URL;
if (!origin || !secret || secret.length < 32) {
  console.error("Set APP_URL and a 32+ character CRON_SECRET before starting the worker.");
  process.exit(1);
}
const url = new URL("/api/cron/reminders", origin);
if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("The reminder endpoint must use HTTPS.");
}
let stopping = false;
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; controller.abort(); });
}
const once = process.argv.includes("--once");
do {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { users, delivered, failedUsers } = await response.json();
    console.log(JSON.stringify({ time: new Date().toISOString(), users, delivered, failedUsers }));
  } catch (error) {
    if (!stopping) console.error(`[reminder-worker] ${error instanceof Error ? error.message : "dispatch failed"}`);
    if (once) process.exitCode = 1;
  }
  if (once || stopping) break;
  await delay(5 * 60_000, undefined, { signal: controller.signal }).catch(() => {});
} while (!stopping);
