import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/** Date writes increment version; hash only aggregate metadata, never expose private records. */
export async function coupleRevision(coupleId: string, coupleUpdatedAt: Date): Promise<string> {
  const state = await prisma.date.aggregate({ where: { coupleId }, _max: { updatedAt: true }, _sum: { version: true }, _count: { _all: true } });
  return createHash("sha256").update(JSON.stringify([coupleUpdatedAt, state])).digest("hex");
}
