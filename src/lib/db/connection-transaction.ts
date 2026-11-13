/** Remote database round trips can exceed Prisma's five-second default on cold starts.
 * Keep connection changes atomic, with bounded acquisition and execution times. */
export const CONNECTION_TRANSACTION = { maxWait: 10_000, timeout: 30_000 } as const;
