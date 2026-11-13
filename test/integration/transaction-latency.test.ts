import { afterAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";

afterAll(() => prisma.$disconnect());
it("keeps a bounded transaction alive across a database delay longer than Prisma's five-second default", async () => {
  const rows = await serializable(async (tx) => {
    await tx.$executeRaw`SELECT pg_sleep(5.2)`;
    return tx.$queryRaw<Array<{ value: number }>>`SELECT 42::int AS value`;
  });
  expect(rows).toEqual([{ value: 42 }]);
});
