import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  const { AuthenticationError } = await import("@/lib/errors");
  return { requireUser: async () => {
    const id = testUser.getStore();
    const user = id && await prisma.user.findFirst({ where: { id, deletedAt: null, blockedAt: null } });
    if (!user) throw new AuthenticationError();
    return user;
  } };
});

import { prisma } from "@/lib/db/prisma";
import { getAdminRestaurantRatings } from "@/server/services/admin-restaurant-ratings";

let users: string[] = [], couples: string[] = [], cafeId: string;
const read = (query: Record<string, unknown> = {}) => asUser(users[0], () => getAdminRestaurantRatings({ venueQuery: couples[0], ...query }));
const place = (name: string, category: "CAFE" | "RESTAURANT" | "CINEMA" = "CAFE", coupleId = couples[0]) =>
  prisma.place.create({ data: { coupleId, createdById: users[1], name, category, city: "Delhi", address: "Test venue address", notes: "PRIVATE VENUE NOTE" } });
const date = (scores = [7, 9]) => prisma.date.create({ data: {
  coupleId: couples[0], createdById: users[1], title: "PRIVATE DATE TITLE", notes: "PRIVATE DATE NOTES",
  status: "COMPLETED", completedAt: new Date("2026-11-15T20:00:00Z"), plannedPlaceId: cafeId,
  reviews: { create: scores.map((score, i) => ({ authorId: users[i + 1], overallRating: 10, submittedAt: new Date(), lovedText: "PRIVATE REFLECTION", placeRatings: { create: { placeId: cafeId, score } } })) },
} });
async function ratePlace(dateId: string, placeId: string, scores = [7, 9]) {
  for (let i = 0; i < scores.length; i++) {
    const review = await prisma.dateReview.findUniqueOrThrow({ where: { dateId_authorId: { dateId, authorId: users[i + 1] } } });
    await prisma.datePlaceRating.create({ data: { reviewId: review.id, placeId, score: scores[i] } });
  }
}

beforeEach(async () => {
  const key = randomUUID(); users = []; couples = [];
  for (let n = 0; n < 3; n++) users.push((await prisma.user.create({ data: { email: `ratings-${key}-${n}@example.invalid`, name: `PRIVATE NAME ${key} ${n}`, emailVerified: new Date() } })).id);
  await prisma.adminAccess.create({ data: { userId: users[0] } });
  couples.push((await prisma.couple.create({ data: { createdById: users[1], inviteCode: key, status: "ACTIVE", members: { create: [{ userId: users[1], role: "OWNER" }, { userId: users[2], role: "PARTNER" }] } } })).id);
  cafeId = (await place("100% Pure _Café_ & O'Brien")).id;
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: couples } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});
afterAll(() => prisma.$disconnect());

it("requires a signed-in verified current admin grant", async () => {
  await expect(getAdminRestaurantRatings()).rejects.toMatchObject({ httpStatus: 401 });
  await expect(asUser(users[1], () => getAdminRestaurantRatings())).rejects.toMatchObject({ httpStatus: 403 });
  await prisma.user.update({ where: { id: users[0] }, data: { emailVerified: null } });
  await expect(read()).rejects.toMatchObject({ httpStatus: 403 });
  await prisma.user.update({ where: { id: users[0] }, data: { emailVerified: new Date() } });
  await prisma.adminAccess.delete({ where: { userId: users[0] } });
  await expect(read()).rejects.toMatchObject({ httpStatus: 403 });
});

it("excludes drafts and one-sided submissions from both rows and counts", async () => {
  const d = await date([7]);
  expect((await read()).count).toBe(0);
  await prisma.dateReview.create({ data: { dateId: d.id, authorId: users[2], overallRating: 9, placeRatings: { create: { placeId: cafeId, score: 9 } } } });
  expect((await read()).rows).toEqual([]);
  await prisma.dateReview.update({ where: { dateId_authorId: { dateId: d.id, authorId: users[2] } }, data: { submittedAt: new Date() } });
  const result = await read();
  expect(result.count).toBe(1); expect(result.rows[0].average).toBe(8);
  expect(result.rows[0].reviews.map((r) => r.score).sort()).toEqual([7, 9]);
});

it("returns venue catalog data and numeric ratings without private prose or identities", async () => {
  await date(); const result = await read();
  expect(result.rows[0].venues[0]).toMatchObject({ id: cafeId, name: "100% Pure _Café_ & O'Brien", category: "CAFE", recorded: false });
  expect(Object.keys(result.rows[0]).sort()).toEqual(["average", "completedAt", "coupleId", "id", "placeId", "reviews", "venues"]);
  const encoded = JSON.stringify(result);
  for (const value of ["PRIVATE", "example.invalid", "passwordHash", "lovedText", "photoUrl", "personalRevisit", "chatMessages"]) expect(encoded).not.toContain(value);
});

it("separates café and dinner scores on one date, deduplicates stops and excludes the movie", async () => {
  const d = await date(); const movie = await place("Test cinema", "CINEMA"), dinner = await place("Test dinner", "RESTAURANT");
  await prisma.dateActivity.createMany({ data: [cafeId, movie.id, dinner.id, cafeId].map((placeId, sortOrder) => ({ dateId: d.id, kind: "PLANNED", title: "PRIVATE EVENT", placeId, sortOrder })) });
  expect((await read()).count).toBe(1);
  await ratePlace(d.id, dinner.id, [3, 5]);
  const result = await read(); expect(result.count).toBe(2); expect(result.rows).toHaveLength(2);
  expect(result.rows.flatMap((row) => row.venues.map((v) => v.id)).sort()).toEqual([cafeId, dinner.id].sort());
  expect(result.rows.find((row) => row.placeId === cafeId)?.average).toBe(8);
  expect(result.rows.find((row) => row.placeId === dinner.id)?.average).toBe(4);
  expect((await read({ venueQuery: "Test dinner" })).rows.map((row) => row.placeId)).toEqual([dinner.id]);
});

it("prefers recorded venues and actual stops over replaced planned venues", async () => {
  const d = await date(); const actual = await place("Actual dinner", "RESTAURANT"), stop = await place("Actual coffee");
  await prisma.date.update({ where: { id: d.id }, data: { actualPlaceId: actual.id } });
  await prisma.dateActivity.createMany({ data: [
    { dateId: d.id, kind: "PLANNED", title: "Skipped plan", placeId: cafeId },
    { dateId: d.id, kind: "ACTUAL", title: "Actual stop", placeId: stop.id },
  ] });
  await ratePlace(d.id, actual.id); await ratePlace(d.id, stop.id);
  const result = await read();
  expect(result.rows.flatMap((row) => row.venues.map((v) => v.id)).sort()).toEqual([actual.id, stop.id].sort());
  expect(result.rows.every((row) => row.venues.every((v) => v.recorded))).toBe(true);
  expect((await read({ venueQuery: "100% Pure" })).count).toBe(0);
  await prisma.date.update({ where: { id: d.id }, data: { actualPlaceId: null } });
  expect((await read()).rows[0].venues.map((v) => v.id)).toEqual([stop.id]);
});

it("does not assign a free-text replacement location's score to the old restaurant", async () => {
  const d = await date();
  await prisma.date.update({ where: { id: d.id }, data: { actualLocationText: "PRIVATE ALTERNATE LOCATION" } });
  expect((await read()).count).toBe(0);
});

it("excludes deleted dates, places and spaces, unfinished dates and mismatched place ownership", async () => {
  const d = await date();
  await prisma.date.update({ where: { id: d.id }, data: { status: "PLANNED" } }); expect((await read()).count).toBe(0);
  await prisma.date.update({ where: { id: d.id }, data: { status: "COMPLETED", deletedAt: new Date() } }); expect((await read()).count).toBe(0);
  await prisma.date.update({ where: { id: d.id }, data: { deletedAt: null } });
  await prisma.place.update({ where: { id: cafeId }, data: { deletedAt: new Date() } }); expect((await read()).count).toBe(0);
  await prisma.place.update({ where: { id: cafeId }, data: { deletedAt: null } });
  await prisma.couple.update({ where: { id: couples[0] }, data: { deletedAt: new Date() } }); expect((await read()).count).toBe(0);
  await prisma.couple.update({ where: { id: couples[0] }, data: { deletedAt: null } });
  couples.push((await prisma.couple.create({ data: { createdById: users[1], inviteCode: randomUUID() } })).id);
  const foreign = await place("Foreign restaurant", "RESTAURANT", couples[1]);
  await prisma.date.update({ where: { id: d.id }, data: { plannedPlaceId: foreign.id } }); expect((await read()).count).toBe(0);
});

it("supports current solo reviews, ignores former members and reflects score edits immediately", async () => {
  const d = await date();
  await prisma.coupleMember.updateMany({ where: { coupleId: couples[0], userId: users[2] }, data: { status: "LEFT" } });
  expect((await read()).rows[0].reviews).toEqual([expect.objectContaining({ accountId: users[1], score: 7 })]);
  await prisma.datePlaceRating.updateMany({ where: { placeId: cafeId, review: { dateId: d.id, authorId: users[1] } }, data: { score: 4 } });
  expect((await read()).rows[0].average).toBe(4);
  await prisma.coupleMember.updateMany({ where: { coupleId: couples[0] }, data: { status: "LEFT" } });
  expect((await read()).count).toBe(0);
});

it("searches venue names, city and reviewer IDs with literal SQL wildcard characters", async () => {
  await date();
  for (const venueQuery of ["O'Brien", "_Café_", "100%", "delhi", users[2]]) expect((await read({ venueQuery })).count).toBe(1);
  expect((await read({ venueQuery: "%' OR 1=1 --" })).count).toBe(0);
  expect((await read({ venueQuery: "Missing_venue" })).count).toBe(0);
});

it("paginates venue visits with stable ordering and clamps out-of-range pages", async () => {
  await Promise.all(Array.from({ length: 21 }, () => date()));
  const first = await read(), second = await read({ page: 2 }), beyond = await read({ page: 9999 });
  expect(first.count).toBe(21); expect(first.pageCount).toBe(2); expect(first.rows).toHaveLength(20); expect(second.rows).toHaveLength(1);
  expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(21);
  expect(beyond.query.page).toBe(2); expect(beyond.rows[0].id).toBe(second.rows[0].id);
  const malformed = await read({ page: ["bad"], venueQuery: ["bad"] });
  expect(malformed.query.page).toBe(1); expect(malformed.query.venueQuery).toBe("");
});
