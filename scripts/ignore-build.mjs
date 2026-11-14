import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const onlyDocumentationChanged = (files) => files.length > 0 && files.every(file =>
  /^(?:memory|README|CLAUDE|AGENTS|DEPLOY)\.md$/i.test(file) || /^docs\/.+\.md$/i.test(file));

/** @param {Record<string, string | undefined>} env */
export function shouldSkipBuild(env = process.env) {
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  if (env.MONO_FORCE_BUILD === "1" || !/^[0-9a-f]{40}$/i.test(previous ?? "")) return false;
  try {
    const files = execFileSync("git", ["diff", "--name-only", "-z", previous, "HEAD", "--"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
    return onlyDocumentationChanged(files);
  } catch { return false; } // Missing/shallow history must build, not silently skip.
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const skip = shouldSkipBuild();
  console.log(skip ? "Only documentation changed since the last successful deployment; skip duplicate functions." : "Runtime changes, forced build or unknown history; continue build.");
  process.exitCode = skip ? 0 : 1;
}
