import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/admin";

/** IDs and byte counts only: never select names, emails, messages or media keys. */
export async function adminCoupleStorage(query: string, skip: number, take: number) {
  await requireAdmin();
  const where: Prisma.CoupleWhereInput = { deletedAt: null, ...(query ? { OR: [{ id: { contains: query } }, { members: { some: { userId: { contains: query } } } }] } : {}) };
  const [count, rows, videos] = await Promise.all([
    prisma.couple.count({ where }),
    prisma.couple.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
      id: true, status: true, members: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { userId: true } },
    } }),
    prisma.chatVideo.aggregate({ where: { messageId: { not: null } }, _sum: { byteLength: true }, _count: { _all: true } }),
  ]);
  const ids = rows.map((r) => r.id);
  const usage = ids.length ? await prisma.$queryRaw<{ coupleId: string; chatBytes: bigint; photoBytes: bigint; videoBytes: bigint }[]>(Prisma.sql`
    SELECT "coupleId", SUM(chat)::bigint AS "chatBytes", SUM(photo)::bigint AS "photoBytes", SUM(video)::bigint AS "videoBytes" FROM (
      SELECT "coupleId", "byteLength"::bigint AS chat, 0::bigint AS photo, 0::bigint AS video FROM chat_images WHERE "coupleId" IN (${Prisma.join(ids)})
      UNION ALL SELECT "coupleId", 0, 0, "byteLength" FROM chat_videos WHERE "messageId" IS NOT NULL AND "coupleId" IN (${Prisma.join(ids)})
      UNION ALL SELECT d."coupleId", 0, COALESCE(p."sizeBytes", 0), 0 FROM date_photos p JOIN dates d ON d.id = p."dateId" WHERE p."deletedAt" IS NULL AND d."deletedAt" IS NULL AND d."coupleId" IN (${Prisma.join(ids)})
    ) u GROUP BY "coupleId"`) : [];
  const byId = new Map(usage.map((u) => [u.coupleId, u]));
  return { count, videoBytes: videos._sum.byteLength ?? 0, videoCount: videos._count._all,
    rows: rows.map((row) => { const u = byId.get(row.id); const chatBytes = Number(u?.chatBytes ?? 0), videoBytes = Number(u?.videoBytes ?? 0), photoBytes = Number(u?.photoBytes ?? 0);
      return { ...row, chatBytes, videoBytes, photoBytes, totalBytes: chatBytes + videoBytes + photoBytes }; }),
  };
}
