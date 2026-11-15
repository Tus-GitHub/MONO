import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
import { migrationDatabaseUrl } from "./migration-url.mjs";

try { loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for deployment migrations.");
const privateKey = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? "", "base64");
if (privateKey.length !== 32 || privateKey.toString("base64") !== process.env.DATA_ENCRYPTION_KEY) {
  throw new Error("Configure DATA_ENCRYPTION_KEY before deploying private-data storage. Existing data requires the same key.");
}
const databaseUrl = migrationDatabaseUrl(process.env.DATABASE_URL, process.env.DIRECT_DATABASE_URL);
// Only the migration child receives the direct URL. The running app keeps its configured pool.
function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Migration command failed.")));
  });
}
try {
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], { ...process.env, DATABASE_URL: databaseUrl });
  // Explicit one-time operator switch; enable only after the encryption-aware app is live.
  // Production storage credentials remain on Vercel, never exported to a laptop.
  if (process.env.MONO_PRIVACY_BACKFILL === "1" && process.env.VERCEL_ENV === "production") {
    await run(["--conditions=react-server", "--import", "tsx", "scripts/migrate-private-data.ts", "--apply"]);
  }
} catch {
  console.error("Deployment migration stopped. Review the aggregate operator output before retrying."); process.exitCode = 1;
}
