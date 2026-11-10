import { expect, it } from "vitest";
import { migrationDatabaseUrl } from "../../../scripts/migration-url.mjs";

it("uses a direct Neon host only for migrations while retaining credentials and query settings", () => {
  const input = "postgresql://role:encoded%21pass@ep-test-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connection_limit=5";
  const output = new URL(migrationDatabaseUrl(input));
  expect(output.hostname).toBe("ep-test.c-4.ap-southeast-1.aws.neon.tech");
  expect(output.password).toBe("encoded%21pass");
  expect(output.searchParams.get("sslmode")).toBe("require");
  expect(new URL(input).hostname).toContain("-pooler.");
});
it("preserves other providers/local test URLs and supports an explicit direct override", () => {
  const local = "postgresql://test@127.0.0.1:55439/mono_test_migration";
  expect(migrationDatabaseUrl(local)).toBe(local);
  expect(migrationDatabaseUrl(local, "postgresql://migration@direct.example/db")).toBe("postgresql://migration@direct.example/db");
  const other = "postgresql://role@ep-test-pooler.example.com/db";
  expect(migrationDatabaseUrl(other)).toBe(other);
});
