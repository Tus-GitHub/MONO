import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
import { migrationDatabaseUrl } from "./migration-url.mjs";

try { loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for deployment migrations.");
const databaseUrl = migrationDatabaseUrl(process.env.DATABASE_URL, process.env.DIRECT_DATABASE_URL);
// Only the migration child receives the direct URL. The running app keeps its configured pool.
const child = spawn(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "inherit", windowsHide: true,
});
child.once("error", () => { console.error("Could not start deployment migrations."); process.exitCode = 1; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
