import { expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { onlyDocumentationChanged, shouldSkipBuild } from "../../../scripts/ignore-build.mjs";

it("skips only documentation and preserves unknown/runtime changes", () => {
  expect(onlyDocumentationChanged(["memory.md", "docs/reports/live.md"])).toBe(true);
  for (const files of [[], ["package.json"], ["src/app/page.tsx"], ["docs/data.json"], ["vercel.json"], ["prisma/schema.prisma"], ["README.md", "src/app/page.tsx"]]) {
    expect(onlyDocumentationChanged(files)).toBe(false);
  }
});
it("always builds when forced or when successful deployment history is unknown", () => {
  expect(shouldSkipBuild({ MONO_FORCE_BUILD: "1" })).toBe(false);
  expect(shouldSkipBuild({})).toBe(false);
  expect(shouldSkipBuild({ VERCEL_GIT_PREVIOUS_SHA: "--invalid" })).toBe(false);
});

it("compares with the last successful release so documentation cannot hide an undeployed code change", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "mono-ignore-build-"));
  const script = path.resolve("scripts/ignore-build.mjs");
  const git = (...args: string[]) => execFileSync("git", ["-c", `safe.directory=${directory}`, ...args], { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const commit = () => { git("add", "."); git("-c", "user.name=MONO test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"); return git("rev-parse", "HEAD"); };
  const run = (previous: string, force = "0") => spawnSync(process.execPath, [script], { cwd: directory, env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previous, MONO_FORCE_BUILD: force }, encoding: "utf8" }).status;
  try {
    git("init"); writeFileSync(path.join(directory, "app.js"), "initial"); const initial = commit();
    writeFileSync(path.join(directory, "app.js"), "runtime change"); const code = commit();
    writeFileSync(path.join(directory, "memory.md"), "documentation"); const docs = commit();
    expect(run(initial)).toBe(1);
    expect(run(code)).toBe(0);
    expect(run(code, "1")).toBe(1);
    expect(run(docs)).toBe(1);
    expect(run("f".repeat(40))).toBe(1);
  } finally {
    if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("mono-ignore-build-")) throw new Error("Unsafe test cleanup path");
    rmSync(directory, { recursive: true, force: true });
  }
});
