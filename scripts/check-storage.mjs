/**
 * Storage connectivity check — proves the S3 / R2 credentials in `.env` actually work.
 *
 *   node scripts/check-storage.mjs
 *
 * Reads S3_* from `.env` (or the real environment), then does a full round-trip against the
 * bucket under a throwaway `diagnostics/` key: PUT → GET → HEAD → DELETE. Prints PASS/FAIL for
 * each with the raw error on failure. Touches nothing MONO cares about; cleans up after itself.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// --- load .env (plain parser, no dependency) --------------------------------
try {
  const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let rest = m[2].trim();
    let val;
    const q = rest[0] === '"' || rest[0] === "'" ? rest[0] : null;
    if (q) {
      // Quoted: value is up to the matching close quote; anything after (a comment) is dropped.
      const end = rest.indexOf(q, 1);
      val = end === -1 ? rest.slice(1) : rest.slice(1, end);
    } else {
      // Unquoted: an inline `# comment` (preceded by whitespace) is not part of the value.
      val = rest.replace(/\s+#.*$/, "").trim();
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
} catch {
  console.log("(no .env file found — reading from the environment)");
}

const {
  S3_BUCKET,
  S3_REGION = "auto",
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT = "",
  S3_FORCE_PATH_STYLE,
  STORAGE_DRIVER,
} = process.env;

const missing = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(`\nMissing: ${missing.join(", ")}\nFill them in .env, then re-run.`);
  process.exit(1);
}
if (STORAGE_DRIVER !== "s3") {
  console.log(`note: STORAGE_DRIVER is "${STORAGE_DRIVER ?? "unset"}", not "s3" — this check still runs, but MONO won't use S3 until you set it.`);
}

console.log("\nConfig");
console.log(`  bucket        ${S3_BUCKET}`);
console.log(`  region        ${S3_REGION}`);
console.log(`  endpoint      ${S3_ENDPOINT || "(AWS default)"}`);
console.log(`  path style    ${S3_FORCE_PATH_STYLE ?? Boolean(S3_ENDPOINT)}  (auto-on with a custom endpoint)`);
console.log(`  access key    ${S3_ACCESS_KEY_ID.slice(0, 4)}…${S3_ACCESS_KEY_ID.slice(-4)}\n`);

const client = new S3Client({
  region: S3_REGION || "auto",
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  forcePathStyle:
    S3_FORCE_PATH_STYLE != null ? S3_FORCE_PATH_STYLE === "true" : Boolean(S3_ENDPOINT),
  ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
});

const key = `diagnostics/mono-storage-check-${Date.now()}.txt`;
const bytes = Buffer.from(`MONO storage check ${new Date().toISOString()}\n`);
let failed = false;
const step = async (label, fn) => {
  try {
    const extra = await fn();
    console.log(`PASS  ${label}${extra ? "  " + extra : ""}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL  ${label}`);
    console.log(`      ${e.name}: ${e.message}`);
    if (e.$metadata?.httpStatusCode) console.log(`      HTTP ${e.$metadata.httpStatusCode}`);
  }
};

await step("PUT   (upload a test object)", async () => {
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: "text/plain",
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
  return key;
});
await step("GET   (read it back)", async () => {
  const res = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  const back = Buffer.from(await res.Body.transformToByteArray());
  if (!back.equals(bytes)) throw new Error("round-tripped bytes do not match");
  return `${back.length} bytes, ok`;
});
await step("HEAD  (exists check)", async () => {
  const res = await client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  return `content-length ${res.ContentLength}`;
});
await step("DELETE (clean up)", async () => {
  await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
});
await step("HEAD  (confirm it's gone)", async () => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    throw new Error("object still present after delete");
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return "404 as expected";
    throw e;
  }
});

console.log(
  failed
    ? "\n✗ Storage is NOT ready — fix the errors above (usually the endpoint URL, the bucket name, or the token's bucket scope / permissions).\n"
    : "\n✓ Storage is ready. Put these same S3_* values in your host's Production env and set STORAGE_DRIVER=s3.\n",
);
process.exit(failed ? 1 : 0);
