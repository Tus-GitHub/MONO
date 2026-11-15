/** Run with --conditions=react-server and explicit intended environment files. Default: audit only. */
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/pg-adapter.mjs";
import { env } from "../src/config/env";
import { createPrivateCrypto } from "../src/lib/privacy/crypto";
import { migratePrivateFields, migratePrivateFiles } from "../src/lib/privacy/migration";
import { LocalStorageDriver } from "../src/lib/storage/local";
import { S3StorageDriver } from "../src/lib/storage/s3";

async function main() {
  const apply = process.argv.includes("--apply");
  const crypto = createPrivateCrypto(env.DATA_ENCRYPTION_KEY);
  const raw = new PrismaClient({ adapter: createDatabaseAdapter(env.DATABASE_URL), log: [] });
  try {
    const driver = env.STORAGE_DRIVER === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
    // Validate every existing ciphertext and file before writing anything. A wrong
    // key or missing source must not leave an avoidable partially migrated dataset.
    if (apply) {
      await migratePrivateFields(raw, crypto, false);
      await migratePrivateFiles(raw, driver, crypto, false);
    }
    const fields = await migratePrivateFields(raw, crypto, apply);
    const files = await migratePrivateFiles(raw, driver, crypto, apply);
    console.log(JSON.stringify({ apply, fields, files }));
    if (apply) {
      const checkedFields = await migratePrivateFields(raw, crypto, false);
      const checkedFiles = await migratePrivateFiles(raw, driver, crypto, false);
      const plaintext = Object.values(checkedFields).reduce((sum, entry) => sum + entry.plaintextFields, 0) + checkedFiles.plaintextFiles;
      console.log(JSON.stringify({ audited: true, remainingPlaintextFieldsOrFiles: plaintext }));
      if (plaintext) process.exitCode = 1;
    }
  } finally { await raw.$disconnect(); }
}
main().catch(() => { console.error("Private-data migration stopped. No private row values or keys were logged. Inspect configuration and rerun the audit before continuing."); process.exitCode = 1; });
