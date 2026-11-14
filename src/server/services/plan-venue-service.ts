import "server-only";
import type { Prisma } from "@prisma/client";
import { PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getExternalPlaceProvider } from "@/lib/places";
import type { ProviderPlace } from "@/lib/places/types";
import type { SelectPlaceInput } from "@/lib/validation/place";
import { NotFoundError, ValidationError } from "@/lib/errors";

/** Verify provider data before entering the write transaction. */
export async function preparePlanVenue(coupleId: string, selection?: SelectPlaceInput): Promise<ProviderPlace | null> {
  if (selection?.mode !== "external") return null;
  if (await prisma.place.findFirst({ where: { coupleId, provider: selection.provider, providerPlaceId: selection.providerPlaceId, deletedAt: null }, select: { id: true } })) return null;
  const provider = getExternalPlaceProvider();
  const place = provider?.name === selection.provider ? await provider.details(selection.providerPlaceId).catch(() => null) : null;
  if (!place) throw new ValidationError("Couldn't verify that venue. Search again or choose a custom place.");
  return place;
}

/** Each stop has its own venue; all saved IDs are rechecked inside the same transaction. */
export async function resolvePlanVenue(tx: Prisma.TransactionClient, coupleId: string, userId: string, selection?: SelectPlaceInput, external?: ProviderPlace | null): Promise<string | null> {
  if (!selection) return null;
  if (selection.mode === "saved") {
    const place = await tx.place.findFirst({ where: { id: selection.savedPlaceId, coupleId, deletedAt: null }, select: { id: true } });
    if (!place) throw new NotFoundError("That venue isn't in your space.");
    return place.id;
  }
  if (selection.mode === "custom") return (await tx.place.create({ data: { coupleId, createdById: userId, name: selection.name, category: selection.category, city: selection.city, address: selection.address } })).id;
  const existing = await tx.place.findFirst({ where: { coupleId, provider: selection.provider, providerPlaceId: selection.providerPlaceId, deletedAt: null }, select: { id: true } });
  if (existing) return existing.id;
  if (!external) throw new ValidationError("That venue changed. Search for it again.");
  const data = { ...external };
  delete data.distanceKm;
  return (await tx.place.create({ data: { ...data, category: data.category ?? PlaceCategory.OTHER, coupleId, createdById: userId } })).id;
}
