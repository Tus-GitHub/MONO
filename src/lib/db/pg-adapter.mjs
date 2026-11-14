import { PrismaPg } from "@prisma/adapter-pg";

/** Keep the existing Prisma URL's connection cap, timeout and schema with pg. */
export function databaseDriverConfig(connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Expected a PostgreSQL database URL.");
  const integerOption = (name, fallback) => {
    const raw = url.searchParams.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid database ${name}.`);
    return value;
  };
  const max = integerOption("connection_limit", 5);
  const connectionTimeoutMillis = integerOption("connect_timeout", 15) * 1000;
  const schema = url.searchParams.get("schema") || "public";
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // pg parses SSL options from the URL after pool options: make verification
  // explicit in the URL as well, rather than accidentally accepting require's
  // compatibility mode with certificate verification disabled.
  if (!loopback) url.searchParams.set("sslmode", "verify-full");
  for (const option of ["schema", "connection_limit", "connect_timeout", "pool_timeout"]) url.searchParams.delete(option);
  return { pool: { connectionString: url.toString(), max, connectionTimeoutMillis, idleTimeoutMillis: 30000 }, schema };
}

export function createDatabaseAdapter(connectionString) {
  const { pool, schema } = databaseDriverConfig(connectionString);
  return new PrismaPg(pool, { schema });
}
