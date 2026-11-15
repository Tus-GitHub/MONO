import "server-only";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import type { GameHistoryPage } from "@/lib/together/types";
import { requireTogether } from "./together-context";
import { gameDTO } from "./together-service";

export async function getGameHistory(before?: string): Promise<GameHistoryPage> {
  const { couple, user } = await requireTogether();
  const cursor = before ? await prisma.gameMatch.findFirst({ where: { id: before, coupleId: couple.id }, select: { id: true, createdAt: true } }) : null;
  if (before && !cursor) throw new NotFoundError();
  const rows = await prisma.gameMatch.findMany({
    where: { coupleId: couple.id, ...(cursor ? { OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31,
  });
  const page = rows.slice(0, 30);
  return { games: page.map((row) => gameDTO(row, user.id)), nextCursor: rows.length > 30 ? page[29].id : null };
}
