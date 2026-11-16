import "server-only";
import type { Prisma } from "@prisma/client";

const PLACE_SELECT = { id: true, coupleId: true, name: true, category: true, address: true, city: true, deletedAt: true } satisfies Prisma.PlaceSelect;
export const DATE_VENUE_SELECT = {
  coupleId: true, actualLocationText: true,
  actualPlace: { select: PLACE_SELECT }, plannedPlace: { select: PLACE_SELECT },
  activities: { orderBy: { sortOrder: "asc" }, select: { kind: true, place: { select: PLACE_SELECT } } },
} satisfies Prisma.DateSelect;
type VenueDate = Prisma.DateGetPayload<{ select: typeof DATE_VENUE_SELECT }>;

/** Recorded stops replace the plan. Deduplicate revisits to the same venue on a date. */
export function visitedPlaces(date: VenueDate) {
  const actualStops = date.activities.filter((activity) => activity.kind === "ACTUAL");
  const recorded = !!date.actualPlace || date.actualLocationText != null || actualStops.length > 0;
  const candidates = recorded
    ? [date.actualPlace, ...actualStops.map((activity) => activity.place)]
    : [date.plannedPlace, ...date.activities.filter((activity) => activity.kind === "PLANNED").map((activity) => activity.place)];
  const unique = new Map<string, NonNullable<VenueDate["actualPlace"]>>();
  for (const place of candidates) if (place && place.coupleId === date.coupleId && !place.deletedAt) unique.set(place.id, place);
  return [...unique.values()].map(({ id, name, category, address, city }) => ({ id, name, category, address, city }));
}

export function foodPlaces(date: VenueDate) {
  return visitedPlaces(date).filter((place) => place.category === "CAFE" || place.category === "RESTAURANT");
}
