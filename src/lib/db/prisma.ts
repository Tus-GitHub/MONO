import { PrismaClient } from "@prisma/client";

import { isProduction } from "@/config/env";

/**
 * A single PrismaClient per process. In development the module graph is re-evaluated on every
 * hot reload, so we stash the client on `globalThis` to avoid exhausting the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["error"] : ["warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
