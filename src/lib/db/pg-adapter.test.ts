import { describe, expect, it } from "vitest";
import { databaseDriverConfig } from "./pg-adapter.mjs";

describe("database driver compatibility", () => {
  it("preserves a bounded pool, timeout and explicit Prisma schema", () => {
    const config = databaseDriverConfig("postgresql://test@127.0.0.1:55463/test?connection_limit=3&connect_timeout=8&schema=custom");
    expect(config.pool.max).toBe(3);
    expect(config.pool.connectionTimeoutMillis).toBe(8000);
    expect(config.schema).toBe("custom");
    expect(new URL(config.pool.connectionString).search).toBe("");
  });
  it("verifies remote TLS and preserves other pg connection options", () => {
    const config = databaseDriverConfig("postgresql://test@db.example.invalid/test?sslmode=require&application_name=mono");
    const url = new URL(config.pool.connectionString);
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("application_name")).toBe("mono");
    expect(config.pool.max).toBe(5);
    expect(config.schema).toBe("public");
  });
  it.each(["0", "-1", "1.5", "invalid"])("rejects an invalid connection cap %s", (value) => {
    expect(() => databaseDriverConfig(`postgresql://test@localhost/test?connection_limit=${value}`)).toThrow("connection_limit");
  });
});
