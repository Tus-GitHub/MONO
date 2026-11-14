import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
import { PlaceCategory } from "@prisma/client";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const provider = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/lib/places", () => ({ getExternalPlaceProvider: () => provider }));
vi.mock("@/lib/places/venue-photos", () => ({ lookupVenuePhotos: async () => new Map() }));

import { prisma } from "@/lib/db/prisma";
import { searchPlaces } from "@/server/services/place-search-service";
import { startDraft, updateBasics, getPlan, duplicateDate } from "@/server/services/plan-service";
import { dateBasicsSchema } from "@/lib/validation/date";

let owner: string, outsider: string, couple: string, otherCouple: string;
beforeEach(async () => {
  provider.search.mockReset().mockResolvedValue([]);
  const run = randomUUID();
  const make = async (role: string) => {
    const user = await prisma.user.create({ data: { name: `${role} ${run}`, email: `${role}-${run}@example.invalid`, emailVerified: new Date() } });
    const space = await prisma.couple.create({ data: { createdById: user.id, inviteCode: `${role}-${run}`, members: { create: { userId: user.id, role: "OWNER", status: "ACTIVE" } } } });
    return { user: user.id, space: space.id };
  };
  const own = await make("discovery"); owner = own.user; couple = own.space;
  const other = await make("outsider"); outsider = other.user; otherCouple = other.space;
  await prisma.place.createMany({ data: [
    { coupleId: couple, createdById: owner, name: "Our café", category: "CAFE", city: "Jaipur" },
    { coupleId: couple, createdById: owner, name: "Our bowling alley", category: "ACTIVITY", city: "Jaipur" },
    { coupleId: couple, createdById: owner, name: "Our restaurant", category: "RESTAURANT", city: "Delhi" },
    { coupleId: otherCouple, createdById: outsider, name: "Private café", category: "CAFE", city: "Jaipur" },
  ] });
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, outsider] } } });
});
afterAll(() => prisma.$disconnect());

it.each([[PlaceCategory.CAFE, "Our café", "cafes"], [PlaceCategory.ACTIVITY, "Our bowling alley", "activities"]])(
  "browses saved and external %s in the selected city while isolating the couple", async (category, name, word) => {
    const results = await asUser(owner, () => searchPlaces({ categories: [category], city: "Jaipur" }));
    expect(results.map((result) => result.name)).toEqual([name]);
    expect(provider.search).toHaveBeenCalledWith(expect.objectContaining({ text: `${word} in Jaipur`, city: "Jaipur", category }));
  },
);
it("keeps explicit venue text separate from the city and discards provider category mismatches", async () => {
  const external = { provider: "fixture", providerPlaceId: "cafe", name: "External café", category: PlaceCategory.CAFE };
  provider.search.mockResolvedValue([external, { ...external, providerPlaceId: "other", name: "Wrong category", category: PlaceCategory.RESTAURANT }]);
  const results = await asUser(owner, () => searchPlaces({ categories: [PlaceCategory.CAFE], city: "Jaipur", text: "café" }));
  expect(results.map((result) => result.name)).toEqual(["External café", "Our café"]);
  expect(provider.search).toHaveBeenCalledWith(expect.objectContaining({ text: "café", city: "Jaipur", category: "CAFE" }));
});
it("persists a manual category independently of the title, returns it on reopen, and preserves it when copying", async () => {
  const draft = await asUser(owner, () => startDraft());
  const input = dateBasicsSchema.parse({ title: "Our anniversary", discoveryCategory: "adventure" });
  await asUser(owner, () => updateBasics(draft.id, input, 0));
  expect((await asUser(owner, () => getPlan(draft.id))).discoveryCategory).toBe("adventure");
  const copy = await asUser(owner, () => duplicateDate(draft.id));
  expect((await asUser(owner, () => getPlan(copy.id))).discoveryCategory).toBe("adventure");
  await expect(asUser(outsider, () => updateBasics(draft.id, { title: " чужой", discoveryCategory: "cafe" }))).rejects.toThrow();
  expect(dateBasicsSchema.safeParse({ discoveryCategory: "untrusted-filter" }).success).toBe(false);
});
