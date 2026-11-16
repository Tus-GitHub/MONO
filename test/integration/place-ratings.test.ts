import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  const { AuthenticationError } = await import("@/lib/errors");
  return { requireUser: async () => {
    const id = testUser.getStore();
    if (!id) throw new AuthenticationError();
    return prisma.user.findUniqueOrThrow({ where: { id } });
  } };
});
import { prisma } from "@/lib/db/prisma";
import { getReviewContext, saveReviewDraft, submitReview } from "@/server/services/review-service";
import { getDatePlaceRatings } from "@/server/services/place-rating-service";
import { getPlaceHistoryMap, score10 } from "@/server/services/place-history";
import { getPlaceDetail } from "@/server/services/place-service";
import { getAdminRestaurantRatings } from "@/server/services/admin-restaurant-ratings";
import { exportCoupleData } from "@/server/services/account-service";

let users: string[] = [], couples: string[] = [], dateId: string, cafe: string, dinner: string, movie: string;
const input = { overallRating: 10, personalRevisit: "DEFINITELY" as const };
const submit = (user: number, places = { [cafe]: 8, [dinner]: 4 }) => asUser(users[user], () => submitReview(dateId, input, {}, places));
const read = (user: number) => asUser(users[user], () => getDatePlaceRatings(dateId));
const admin = () => asUser(users[2], () => getAdminRestaurantRatings({ venueQuery: couples[0] }));

beforeEach(async () => {
  users = []; couples = []; const key = randomUUID();
  for (let n = 0; n < 3; n++) users.push((await prisma.user.create({ data: { email: `place-${key}-${n}@example.invalid`, name: `Place fixture ${key} ${n}`, emailVerified: new Date() } })).id);
  await prisma.adminAccess.create({ data: { userId: users[2] } });
  couples.push((await prisma.couple.create({ data: { createdById: users[0], inviteCode: key, status: "ACTIVE", members: { create: [{ userId: users[0], role: "OWNER" }, { userId: users[1], role: "PARTNER" }] } } })).id);
  const places = await Promise.all((["CAFE", "RESTAURANT", "CINEMA"] as const).map((category) => prisma.place.create({ data: { coupleId: couples[0], createdById: users[0], name: `${category} ${key}`, category } })));
  [cafe, dinner, movie] = places.map((place) => place.id);
  dateId = (await prisma.date.create({ data: { coupleId: couples[0], createdById: users[0], title: "Cafe then movie then dinner", plannedPlaceId: cafe, status: "COMPLETED", completedAt: new Date(), activities: { create: [cafe, movie, dinner, cafe].map((placeId, sortOrder) => ({ kind: "ACTUAL", title: "Stop", placeId, sortOrder })) } } })).id;
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: couples } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});
afterAll(() => prisma.$disconnect());

it("shows each food venue once and saves an incomplete private draft", async () => {
  const ctx = await asUser(users[0], () => getReviewContext(dateId, users[0]));
  expect(ctx.places.map((p) => p.id)).toEqual([cafe, dinner]);
  await asUser(users[0], () => saveReviewDraft(dateId, {}, {}, { [cafe]: 8 }));
  expect((await read(0))[0]).toMatchObject({ mine: 8, partner: null, average: null, submitted: false });
  expect((await read(1))[0]).toMatchObject({ mine: null, partner: null, average: null });
  expect((await admin()).count).toBe(0);
});

it("requires every venue, rejects unrelated places and invalid scores, and rolls back all changes", async () => {
  for (const values of [{ [cafe]: 8 }, { [cafe]: 8, [dinner]: 4, [movie]: 5 }, { [cafe]: 0, [dinner]: 4 }, { [cafe]: 11, [dinner]: 4 }, { [cafe]: 8.5, [dinner]: 4 }, { [cafe]: NaN, [dinner]: 4 }, { unknown: 8 }]) {
    await expect(submit(0, values)).rejects.toMatchObject({ code: "validation_error" });
  }
  expect(await prisma.dateReview.count({ where: { dateId } })).toBe(0);
});

it("reveals distinct place scores to both partners and admin only after both submit", async () => {
  await submit(0);
  expect((await read(1)).every((place) => place.partner === null && place.average === null)).toBe(true);
  expect((await admin()).count).toBe(0);
  await submit(1, { [cafe]: 6, [dinner]: 2 });
  for (const user of [0, 1]) {
    const places = await read(user);
    expect(places.find((p) => p.id === cafe)?.average).toBe(7);
    expect(places.find((p) => p.id === dinner)?.average).toBe(3);
  }
  expect((await admin()).rows.map((row) => row.average).sort()).toEqual([3, 7]);
  const history = await getPlaceHistoryMap(couples[0]);
  expect(score10(history.get(cafe))).toBe(7); expect(score10(history.get(dinner))).toBe(3);
  expect(history.get(cafe)?.visits).toBe(1); expect(score10(history.get(movie))).toBe(null);
  const detail = await asUser(users[0], () => getPlaceDetail(dinner));
  expect(detail.history).toMatchObject({ visitCount: 1, coupleScore10: 3 });
  expect(detail.history.dates[0].score10).toBe(3);
});

it("keeps date-wide legacy scores separate and gates newly added place scores independently", async () => {
  await prisma.dateReview.createMany({ data: users.slice(0, 2).map((authorId) => ({ dateId, authorId, overallRating: 10, submittedAt: new Date() })) });
  expect((await admin()).count).toBe(0);
  expect((await read(0)).every((place) => place.mine === null && place.average === null)).toBe(true);
  await submit(0);
  expect((await read(1)).every((place) => place.partner === null)).toBe(true);
  expect((await admin()).count).toBe(0);
  const exported = await asUser(users[1], exportCoupleData);
  const exportedCouple = exported.couple as { dates: { id: string; reviews: { placeRatings: unknown[] }[] }[] };
  expect(exportedCouple.dates.find((date) => date.id === dateId)?.reviews.every((review) => review.placeRatings.length === 0)).toBe(true);
  await submit(1);
  expect((await admin()).count).toBe(2);
});

it("edits only the author's scores after reveal and refreshes aggregates immediately", async () => {
  await submit(0); await submit(1);
  const version = (await prisma.date.findUniqueOrThrow({ where: { id: dateId } })).version;
  await submit(0, { [cafe]: 2, [dinner]: 10 });
  expect((await read(1)).find((place) => place.id === cafe)).toMatchObject({ mine: 8, partner: 2, average: 5 });
  expect((await admin()).rows.find((row) => row.placeId === dinner)?.average).toBe(7);
  expect((await prisma.date.findUniqueOrThrow({ where: { id: dateId } })).version).toBeGreaterThan(version);
  await expect(asUser(users[0], () => saveReviewDraft(dateId, {}, {}, { [cafe]: 3 }))).rejects.toMatchObject({ code: "conflict" });
});

it("denies outsiders and cannot fetch another partner's private review context", async () => {
  await expect(read(2)).rejects.toThrow();
  await expect(submit(2)).rejects.toThrow();
  await expect(asUser(users[0], () => getReviewContext(dateId, users[1]))).rejects.toThrow();
  couples.push((await prisma.couple.create({ data: { createdById: users[2], inviteCode: randomUUID() } })).id);
  const foreign = await prisma.place.create({ data: { coupleId: couples[1], createdById: users[2], name: "Foreign cafe", category: "CAFE" } });
  await expect(submit(0, { [cafe]: 8, [dinner]: 4, [foreign.id]: 6 })).rejects.toMatchObject({ code: "validation_error" });
});

it("ignores a former member and permits a current solo venue rating", async () => {
  await prisma.coupleMember.updateMany({ where: { coupleId: couples[0], userId: users[1] }, data: { status: "LEFT" } });
  await submit(0);
  expect((await admin()).rows.every((row) => row.reviews.length === 1)).toBe(true);
  expect((await read(0))[0]).toMatchObject({ hasPartner: false, revealed: true, average: 8 });
});

it("does not show ratings for deleted or replaced venues", async () => {
  await submit(0); await submit(1);
  await prisma.place.update({ where: { id: cafe }, data: { deletedAt: new Date() } });
  expect((await read(0)).map((place) => place.id)).toEqual([dinner]);
  expect((await admin()).count).toBe(1);
  await prisma.dateActivity.updateMany({ where: { dateId, placeId: dinner }, data: { placeId: movie } });
  expect(await read(0)).toEqual([]); expect((await admin()).count).toBe(0);
});
