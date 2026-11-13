import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Retry serialization conflicts; callbacks must only perform database work. */
export async function serializable<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { timeout?: number; maxWait?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // Keep atomic multi-query operations within a bounded budget even after a cold start.
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
        ...options,
      });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (
        error.code === "P2034"
        || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)))
      );
      if (attempt >= 2 || !retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
}
