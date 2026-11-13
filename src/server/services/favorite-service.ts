import "server-only";

import { Prisma } from "@prisma/client";
import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";

/** Toggle in SQL: two partners' concurrent clicks must not collapse into one stale read/write. */
export async function toggleCoupleFavorite(kind: "place" | "memory" | "photo", id: string): Promise<boolean> {
  const { couple, user } = await requireCoupleContext();
  const table = kind === "place" ? Prisma.sql`places` : kind === "memory" ? Prisma.sql`memories` : Prisma.sql`date_photos`;
  const owner = kind === "photo"
    ? Prisma.sql`EXISTS (SELECT 1 FROM dates d WHERE d.id = target."dateId" AND d."coupleId" = ${couple.id} AND d."deletedAt" IS NULL)`
    : Prisma.sql`target."coupleId" = ${couple.id}`;
  const rows = await prisma.$queryRaw<{ isFavorite: boolean }[]>(Prisma.sql`
    UPDATE ${table} AS target SET "isFavorite" = NOT target."isFavorite", "updatedAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
    WHERE target.id = ${id} AND target."deletedAt" IS NULL AND ${owner}
      AND EXISTS (
        SELECT 1 FROM couples c JOIN couple_members m ON m."coupleId" = c.id
        JOIN users u ON u.id = m."userId"
        WHERE c.id = ${couple.id} AND c."deletedAt" IS NULL AND c.status IN ('PENDING', 'ACTIVE')
          AND m."userId" = ${user.id} AND m.status = 'ACTIVE' AND u."deletedAt" IS NULL
      )
    RETURNING target."isFavorite"
  `);
  if (!rows[0]) throw new NotFoundError();
  return rows[0].isFavorite;
}
