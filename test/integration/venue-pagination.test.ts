import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
import type { ProviderPlace } from "@/lib/places/types";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const sources = vi.hoisted(() => ({ india: { name: "indiarestros", searchPage: vi.fn(), details: vi.fn() }, photon: { name: "photon", resolveArea: vi.fn(), search: vi.fn() } }));
vi.mock("@/lib/places", () => ({ getExternalPlaceProvider: (query?: unknown) => query ? sources.india : sources.photon,
  getPlaceProviderByName: (name: string) => name === "indiarestros" ? sources.india : null }));
vi.mock("@/lib/places/venue-photos", () => ({ lookupVenuePhotos: async () => new Map() }));

import { prisma } from "@/lib/db/prisma";
import { searchPlacesPage } from "@/server/services/place-search-service";
import { savePlace, getPlaceDetail } from "@/server/services/place-service";
import { preparePlanVenue, resolvePlanVenue } from "@/server/services/plan-venue-service";

const near = { latitude: 28.6, longitude: 77.4 };
const options = { near, categories: ["CAFE" as const], radiusKm: 50, limit: 2 };
const venue = (id: string, latitude = 28.61): ProviderPlace => ({ provider: "indiarestros", providerPlaceId: id, name: `Cafe ${id}`, category: "CAFE",
  latitude, longitude: 77.4, address: "Venue address", city: "Ghaziabad", imageUrl: `https://indiarestros.com/img/${id}/123456789abc-480.webp`,
  externalRating: 4.7, externalRatingCount: 86, externalRatingSource: "google", externalUrl: `https://indiarestros.com/r/cafe-${id.slice(4).toLowerCase()}`,
  website: null, description: null, phone: null, openingText: null, priceLevel: 2 });
let owner: string, partner: string, outsider: string, couple: string, otherCouple: string;
beforeEach(async () => {
  sources.india.searchPage.mockReset().mockResolvedValue({ results: [], nextOffset: null });
  sources.india.details.mockReset(); sources.photon.resolveArea.mockReset().mockResolvedValue(near); sources.photon.search.mockReset().mockResolvedValue([]);
  const run = randomUUID();
  const make = (role: string) => prisma.user.create({ data: { name: `${role} ${run}`, email: `${role}-${run}@example.invalid`, emailVerified: new Date() } });
  owner = (await make("venues-owner")).id; partner = (await make("venues-partner")).id; outsider = (await make("venues-outsider")).id;
  couple = (await prisma.couple.create({ data: { createdById: owner, inviteCode: run, members: { create: [{ userId: owner, role: "OWNER", status: "ACTIVE" }, { userId: partner, role: "PARTNER", status: "ACTIVE" }] } } })).id;
  otherCouple = (await prisma.couple.create({ data: { createdById: outsider, inviteCode: `other-${run}`, members: { create: { userId: outsider, role: "OWNER", status: "ACTIVE" } } } })).id;
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider] } } });
});
afterAll(() => prisma.$disconnect());

it("pages both saved and external results without dropping rows and filters every page by radius", async () => {
  const savedVenue = venue("IRR-0000000001");
  await prisma.place.createMany({ data: [
    { ...savedVenue, category: "CAFE", coupleId: couple, createdById: owner },
    { name: "Saved two", category: "CAFE", latitude: 28.62, longitude: 77.4, coupleId: couple, createdById: owner },
    { name: "Saved three", category: "CAFE", latitude: 28.63, longitude: 77.4, coupleId: couple, createdById: owner },
    { name: "Other couple private", category: "CAFE", latitude: 28.61, longitude: 77.4, coupleId: otherCouple, createdById: outsider },
  ] });
  sources.india.searchPage.mockResolvedValueOnce({ results: [savedVenue, venue("IRR-0000000002")], nextOffset: 2 })
    .mockResolvedValueOnce({ results: [venue("IRR-0000000003", 28.9), venue("IRR-0000000004", 30)], nextOffset: null });
  const first = await asUser(owner, () => searchPlacesPage(options));
  const second = await asUser(partner, () => searchPlacesPage({ ...options, cursor: first.nextCursor! }));
  expect(first.results).toHaveLength(3); expect(second.results).toHaveLength(2); expect(second.nextCursor).toBeNull();
  const all = [...first.results, ...second.results];
  expect(new Set(all.map((place) => place.savedPlaceId ?? place.external?.providerPlaceId)).size).toBe(5);
  expect(all.every((place) => place.distanceKm! <= 50 && place.name !== "Other couple private")).toBe(true);
  expect(second.results.find((place) => place.external?.providerPlaceId === "IRR-0000000003")?.distanceKm).toBeGreaterThan(30);
  expect(sources.india.searchPage).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2, near, radiusKm: 50 }));
});
it("rejects a previous radius/query or another couple's continuation", async () => {
  sources.india.searchPage.mockResolvedValue({ results: [venue("IRR-0000000001")], nextOffset: 2 });
  const first = await asUser(owner, () => searchPlacesPage(options));
  await expect(asUser(owner, () => searchPlacesPage({ ...options, radiusKm: 5, cursor: first.nextCursor! }))).rejects.toThrow(/changed/);
  await expect(asUser(owner, () => searchPlacesPage({ ...options, text: "new", cursor: first.nextCursor! }))).rejects.toThrow(/changed/);
  await expect(asUser(outsider, () => searchPlacesPage({ ...options, cursor: first.nextCursor! }))).rejects.toThrow(/changed/);
});
it("keeps continuation after an empty filtered page and exposes retriable upstream failures", async () => {
  sources.india.searchPage.mockResolvedValueOnce({ results: [venue("IRR-0000000001", 30)], nextOffset: 2 }).mockRejectedValueOnce(new Error("busy"));
  const first = await asUser(owner, () => searchPlacesPage(options)); expect(first.results).toHaveLength(0); expect(first.nextCursor).toBeTruthy();
  await expect(asUser(owner, () => searchPlacesPage({ ...options, cursor: first.nextCursor! }))).rejects.toMatchObject({ httpStatus: 503 });
});
it("falls back to Photon coverage when IndiaRestros has no matches", async () => {
  sources.photon.search.mockResolvedValue([{ ...venue("IRR-0000000001"), provider: "photon", providerPlaceId: "N1:28.61:77.4:amenity:cafe", imageUrl: null }]);
  const page = await asUser(owner, () => searchPlacesPage(options));
  expect(page.results[0].external?.provider).toBe("photon"); expect(page.nextCursor).toBeNull();
});
it("saves a later-page venue through both selection paths with rating/source visible to both partners only", async () => {
  const detail = venue("IRR-0000000002", 28.9);
  sources.india.searchPage.mockResolvedValueOnce({ results: [venue("IRR-0000000001")], nextOffset: 2 }).mockResolvedValueOnce({ results: [detail], nextOffset: null });
  sources.india.details.mockResolvedValue(detail);
  const first = await asUser(owner, () => searchPlacesPage(options));
  const next = await asUser(owner, () => searchPlacesPage({ ...options, cursor: first.nextCursor! }));
  const selection = { mode: "external" as const, ...next.results[0].external! };
  const verified = await preparePlanVenue(couple, selection);
  const id = await prisma.$transaction((tx) => resolvePlanVenue(tx, couple, owner, selection, verified));
  const saved = await asUser(partner, () => savePlace(selection)); expect(saved.id).toBe(id);
  for (const user of [owner, partner]) expect(await asUser(user, () => getPlaceDetail(id!))).toMatchObject({ externalRating: 4.7, externalRatingCount: 86,
    externalRatingSource: "google", externalUrl: detail.externalUrl, photo: { source: "indiarestros", sourceUrl: detail.externalUrl } });
  await expect(asUser(outsider, () => getPlaceDetail(id!))).rejects.toThrow();
  const separate = await asUser(outsider, () => savePlace(selection)); expect(separate.id).not.toBe(id);
  expect(await prisma.place.findUniqueOrThrow({ where: { id: separate.id } })).toMatchObject({ coupleId: otherCouple, externalRatingSource: "google" });
});
