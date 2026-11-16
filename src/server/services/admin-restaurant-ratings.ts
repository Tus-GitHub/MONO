import "server-only";

import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { sharedPlaceRatings } from "@/lib/date/place-ratings";
import { averageScore } from "@/lib/review/scale";
import { adminRatingsQuerySchema } from "@/lib/validation/admin-ratings";

const PAGE_SIZE = 20;

// Only catalog fields and numeric, revealed place scores are exposed. Do not select
// date titles, reflections, category prose, user identities or any media fields.
const venueDates = Prisma.sql`
  WITH rated_dates AS (
    SELECT d.id, d."coupleId", d."completedAt", d."actualPlaceId", d."plannedPlaceId",
      d."actualLocationText" IS NULL AS "noActualLocation"
      FROM dates d JOIN couples c ON c.id = d."coupleId"
    WHERE d."deletedAt" IS NULL AND c."deletedAt" IS NULL AND d.status = 'COMPLETED'
      AND EXISTS (SELECT 1 FROM couple_members m WHERE m."coupleId" = d."coupleId" AND m.status = 'ACTIVE')
      AND NOT EXISTS (
        SELECT 1 FROM couple_members m WHERE m."coupleId" = d."coupleId" AND m.status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM date_reviews r WHERE r."dateId" = d.id AND r."authorId" = m."userId"
            AND r."submittedAt" IS NOT NULL AND r."overallRating" BETWEEN 1 AND 10)
      )
  ), venue_links AS (
    SELECT d.id AS "dateId", COALESCE(d."actualPlaceId", CASE WHEN d."noActualLocation"
      AND NOT EXISTS (SELECT 1 FROM date_activities actual WHERE actual."dateId" = d.id AND actual.kind = 'ACTUAL') THEN d."plannedPlaceId" END) AS "placeId",
      d."actualPlaceId" IS NOT NULL AS recorded FROM rated_dates d
    UNION ALL
    SELECT a."dateId", a."placeId", a.kind = 'ACTUAL' AS recorded
      FROM date_activities a JOIN rated_dates d ON d.id = a."dateId"
      WHERE a.kind = 'ACTUAL' OR (a.kind = 'PLANNED' AND d."actualPlaceId" IS NULL AND d."noActualLocation"
        AND NOT EXISTS (SELECT 1 FROM date_activities actual WHERE actual."dateId" = d.id AND actual.kind = 'ACTUAL'))
  ), food_venues AS (
    SELECT v."dateId", p.id, p.name, p.category, p.address, p.city, bool_or(v.recorded) AS recorded
      FROM venue_links v JOIN rated_dates d ON d.id = v."dateId"
      JOIN places p ON p.id = v."placeId" AND p."coupleId" = d."coupleId"
      WHERE p."deletedAt" IS NULL AND p.category IN ('RESTAURANT', 'CAFE')
      GROUP BY v."dateId", p.id
  ), revealed_venues AS (
    SELECT v.* FROM food_venues v JOIN rated_dates d ON d.id = v."dateId"
    WHERE NOT EXISTS (
      SELECT 1 FROM couple_members m WHERE m."coupleId" = d."coupleId" AND m.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM date_reviews r JOIN date_place_ratings pr ON pr."reviewId" = r.id
          WHERE r."dateId" = d.id AND r."authorId" = m."userId" AND r."submittedAt" IS NOT NULL
            AND pr."placeId" = v.id AND pr.score BETWEEN 1 AND 10)
    )
  )`;

type FoodVenue = { dateId: string; id: string; name: string; category: "RESTAURANT" | "CAFE"; address: string | null; city: string | null; recorded: boolean };

/** Paginate in SQL after reveal/venue filtering, so hidden reviews never affect counts. */
export async function getAdminRestaurantRatings(rawQuery: unknown = {}) {
  await requireAdmin();
  const query = adminRatingsQuerySchema.parse(rawQuery);
  const needle = `%${query.venueQuery.replace(/[\\%_]/g, "\\$&")}%`;
  const matching = Prisma.sql`
    TRUE
    ${query.venueQuery ? Prisma.sql`AND (
      d.id ILIKE ${needle} OR d."coupleId" ILIKE ${needle}
      OR EXISTS (SELECT 1 FROM couple_members m WHERE m."coupleId" = d."coupleId" AND m.status = 'ACTIVE' AND m."userId" ILIKE ${needle})
      OR v.name ILIKE ${needle} OR v.city ILIKE ${needle} OR v.address ILIKE ${needle}
    )` : Prisma.empty}`;

  return prisma.$transaction(async (tx) => {
    const [total] = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`${venueDates}
      SELECT count(*) FROM revealed_venues v JOIN rated_dates d ON d.id = v."dateId" WHERE ${matching}`);
    const count = Number(total.count), pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const page = Math.min(query.page, pageCount);
    const selected = await tx.$queryRaw<{ id: string; placeId: string }[]>(Prisma.sql`${venueDates}
      SELECT d.id, v.id AS "placeId" FROM revealed_venues v JOIN rated_dates d ON d.id = v."dateId" WHERE ${matching}
      ORDER BY d."completedAt" DESC NULLS LAST, d.id DESC, v.id LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`);
    const ids = [...new Set(selected.map((row) => row.id))];
    const [dates, venues] = ids.length ? await Promise.all([
      tx.date.findMany({ where: { id: { in: ids } }, select: {
        id: true, coupleId: true, completedAt: true,
        couple: { select: { members: { where: { status: "ACTIVE" }, select: { userId: true } } } },
        reviews: { select: { authorId: true, submittedAt: true, placeRatings: { select: { placeId: true, score: true, updatedAt: true } } }, orderBy: { authorId: "asc" } },
      } }),
      tx.$queryRaw<FoodVenue[]>(Prisma.sql`${venueDates}
        SELECT * FROM food_venues WHERE "dateId" IN (${Prisma.join(ids)}) ORDER BY recorded DESC, name, id`),
    ]) : [[], []];
    const byId = new Map(dates.map((date) => [date.id, date]));
    const rows = selected.flatMap(({ id, placeId }) => {
      const date = byId.get(id);
      if (!date) return [];
      const reviews = sharedPlaceRatings(date.reviews, date.couple.members.map((member) => member.userId), placeId)
        .map((rating) => ({ accountId: rating.authorId, score: rating.score, updatedAt: rating.updatedAt }));
      return [{ id: date.id, placeId, coupleId: date.coupleId, completedAt: date.completedAt, reviews,
        average: averageScore(reviews.map((review) => review.score)),
        venues: venues.filter((venue) => venue.dateId === id && venue.id === placeId).map(({ id, name, category, address, city, recorded }) => ({ id, name, category, address, city, recorded })),
      }];
    });
    return { query: { ...query, page }, count, pageCount, pageSize: PAGE_SIZE, rows };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export type AdminRestaurantRatings = Awaited<ReturnType<typeof getAdminRestaurantRatings>>;
