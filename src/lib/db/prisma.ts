import { PrismaClient } from "@prisma/client";

import { env, isProduction } from "@/config/env";
import { createDatabaseAdapter } from "./pg-adapter.mjs";
import { withPrivateData } from "@/lib/privacy/prisma-extension";
import { privateCrypto } from "@/lib/privacy/server";

/**
 * A single PrismaClient per process. In development the module graph is re-evaluated on every
 * hot reload, so we stash the client on `globalThis` to avoid exhausting the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  withPrivateData(new PrismaClient({
    adapter: createDatabaseAdapter(env.DATABASE_URL),
    log: [],
  }), privateCrypto);

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
