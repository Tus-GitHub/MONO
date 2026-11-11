/**
 * Google Places API check — proves GOOGLE_PLACES_API_KEY works.
 *
 *   node scripts/check-places.mjs  ["some search text"]
 *
 * The app's provider (src/lib/places/google-provider.ts) swallows every error and returns an
 * empty list so search can fall back to the couple's saved places — which means a broken key
 * is invisible in the UI. This calls `places:searchText` directly and prints the raw result
 * or Google's actual error (billing off, API not enabled, key restricted, …).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

try {
  const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let rest = m[2].trim();
    let val;
    const q = rest[0] === '"' || rest[0] === "'" ? rest[0] : null;
    if (q) {
      const end = rest.indexOf(q, 1);
      val = end === -1 ? rest.slice(1) : rest.slice(1, end);
    } else {
      val = rest.replace(/\s+#.*$/, "").trim();
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
} catch {
  console.log("(no .env file found — reading from the environment)");
}

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const PROVIDER = process.env.PLACE_PROVIDER;
const query = process.argv[2] || "coffee near London";

if (PROVIDER === "photon") {
  const args = ["node_modules/tsx/dist/cli.mjs", "scripts/check-photon.ts", process.argv[2] || "Starbucks Delhi"];
  const child = spawn(process.execPath, args, { stdio: "inherit", windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  process.exit(typeof code === "number" ? code : 1);
}

if (!KEY) {
  console.error("\nGOOGLE_PLACES_API_KEY is not set in .env — add it, then re-run.\n");
  process.exit(1);
}
if (PROVIDER !== "google") {
  console.log(`note: PLACE_PROVIDER is "${PROVIDER ?? "unset"}" — set it to "google" for MONO to actually use the key. This check runs regardless.\n`);
}
console.log("Key    configured (hidden)");
console.log(`Query  "${query}"\n`);

const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-Goog-Api-Key": KEY,
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.rating",
  },
  body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  signal: AbortSignal.timeout(10_000),
});

const text = (await res.text()).split(KEY).join("[redacted]");
let data;
try {
  data = JSON.parse(text);
} catch {
  console.log(`FAIL  HTTP ${res.status} — non-JSON response:\n${text.slice(0, 400)}`);
  process.exit(1);
}

if (!res.ok || data.error) {
  const e = data.error ?? {};
  console.log(`FAIL  HTTP ${res.status}  ${e.status ?? ""}`);
  console.log(`      ${e.message ?? text.slice(0, 300)}`);
  const reasons = (e.details ?? []).map((detail) => detail.reason).filter((reason) => typeof reason === "string");
  if (reasons.length) console.log(`      Reason: ${reasons.join(", ")}`);
  const hint =
    /API .* not enabled|SERVICE_DISABLED/i.test(e.message ?? "")
      ? 'Enable "Places API (New)" in APIs & Services → Library.'
      : /billing/i.test(e.message ?? "")
        ? "Link a billing account to the Cloud project."
        : /referer|referrer|API_KEY_HTTP_REFERRER|blocked|restrict/i.test(e.message ?? "")
          ? "Use a server key restricted to Places API (New). Website/referrer keys cannot authenticate server calls; IP restrictions must match the server's outbound IPs."
          : /API key not valid|API_KEY_INVALID/i.test(e.message ?? "")
            ? "The key string is wrong or was deleted/regenerated."
            : res.status === 403
              ? "Check billing, Places API (New) enablement, and the server key's API/application restrictions in Google Cloud."
              : "";
  if (hint) console.log(`\n      → ${hint}`);
  console.log();
  process.exit(1);
}

const places = data.places ?? [];
console.log(`PASS  HTTP 200 — ${places.length} result(s):`);
for (const p of places.slice(0, 5)) {
  console.log(`  • ${p.displayName?.text ?? "(no name)"} — ${p.formattedAddress ?? "?"}  [${(p.types ?? [])[0] ?? "?"}]`);
}
console.log("\n✓ Places API works. Set PLACE_PROVIDER=google + GOOGLE_PLACES_API_KEY in your host's Production env.\n");
