import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { runFirstVisit } from "../test/e2e/first-visit.mjs";

// Read-only browser checks; no fixture accounts, email sends or database writes.
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3219";
const target = new URL(baseUrl);
if (target.username || target.password || (target.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(target.hostname))) throw new Error("Use HTTPS or a loopback test origin.");
const executablePath = process.env.MONO_E2E_BROWSER_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const artifactDir = path.resolve(".postgres-test", "first-visit", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(artifactDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--disable-background-networking", "--no-first-run"] });
try {
  const result = await runFirstVisit({ browser, baseUrl, artifactDir });
  await writeFile(path.join(artifactDir, "results.json"), JSON.stringify({ passed: true, browser: await browser.version(), ...result }, null, 2));
  console.log(`PASS: ${result.checks} production first-visit checks. Artifacts: ${artifactDir}`);
} finally { await browser.close(); }
