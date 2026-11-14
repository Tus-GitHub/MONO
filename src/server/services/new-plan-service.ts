import "server-only";

import { DateStatus, PlaceCategory } from "@prisma/client";
import { requireCoupleContext } from "@/lib/authz";
import { lockLivingUser } from "@/lib/authz/user-write";
import { serializable } from "@/lib/db/serializable";
import { prisma } from "@/lib/db/prisma";
import { getExternalPlaceProvider } from "@/lib/places";
import type { ProviderPlace } from "@/lib/places/types";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { dateBasicsSchema, dateBudgetSchema, plannedActivitySchema } from "@/lib/validation/date";
import type { LocalPlan } from "@/lib/validation/new-plan";
import { todayYmdInTimeZone } from "@/lib/utils/timezone";
import { ensureRemindersForDate, ensureUnfinishedPlanReminder } from "./reminder-service";

/** The new editor performs no writes until this explicit, idempotent Save boundary. */
export async function saveNewPlan(input: LocalPlan, finalize: boolean) {
  const { user, couple } = await requireCoupleContext();
  if (!/^[a-f0-9-]{36}$/i.test(input.key)) throw new ValidationError("Start a new plan before saving.");
  const basics = dateBasicsSchema.parse({ ...input, discoveryCategory: input.category });
  const budget = dateBudgetSchema.parse({ ...input });
  const activities = input.activities.map((activity) => plannedActivitySchema.parse({
    title: activity.title, durationMinutes: activity.duration, costCents: activity.cost, savedPlaceId: activity.savedPlaceId,
  }));
  const today = todayYmdInTimeZone(couple.timezone);
  if (basics.date && basics.date < today) throw new ValidationError("Pick today or a future date.");
  if (finalize && (!basics.title?.trim() || !basics.date)) throw new ValidationError("Give your date a title and choose when before saving it as a date.");
  const selection = input.place?.selection;
  let external: ProviderPlace | null = null;
  if (selection?.mode === "external") {
    const existing = await prisma.place.findFirst({ where: { coupleId: couple.id, provider: selection.provider, providerPlaceId: selection.providerPlaceId, deletedAt: null }, select: { id: true } });
    if (!existing) {
      const provider = getExternalPlaceProvider();
      external = provider?.name === selection.provider ? await provider.details(selection.providerPlaceId).catch(() => null) : null;
      if (!external) throw new ValidationError("Couldn't verify that venue. Search again or choose a custom place.");
    }
  }
  const saved = await serializable(async (tx) => {
    await lockLivingUser(tx, user.id);
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${couple.id} FOR UPDATE`;
    const current = await tx.couple.findFirst({ where: { id: couple.id, deletedAt: null, status: { in: ["PENDING", "ACTIVE"] }, members: { some: { userId: user.id, status: "ACTIVE" } } } });
    if (!current) throw new NotFoundError("Your shared space is no longer available.");
    const existing = await tx.date.findFirst({ where: { createdById: user.id, clientDraftKey: input.key } });
    if (existing) {
      if (existing.coupleId !== couple.id || existing.deletedAt) throw new ValidationError("That draft was already saved. Start a new plan.");
      return { id: existing.id, status: existing.status };
    }
    let placeId: string | null = null;
    if (selection?.mode === "saved") {
      const place = await tx.place.findFirst({ where: { id: selection.savedPlaceId, coupleId: couple.id, deletedAt: null } });
      if (!place) throw new NotFoundError("That venue isn't in your space.");
      placeId = place.id;
    } else if (selection?.mode === "custom") {
      placeId = (await tx.place.create({ data: { coupleId: couple.id, createdById: user.id, name: selection.name, category: selection.category, city: selection.city, address: selection.address } })).id;
    } else if (selection?.mode === "external") {
      const place = await tx.place.findFirst({ where: { coupleId: couple.id, provider: selection.provider, providerPlaceId: selection.providerPlaceId, deletedAt: null } });
      if (place) placeId = place.id;
      else if (external) placeId = (await tx.place.create({ data: {
        provider: external.provider, providerPlaceId: external.providerPlaceId, name: external.name,
        category: external.category ?? PlaceCategory.OTHER, city: external.city, address: external.address,
        latitude: external.latitude, longitude: external.longitude, imageUrl: external.imageUrl,
        description: external.description, website: external.website, phone: external.phone, openingText: external.openingText,
        externalRating: external.externalRating, externalRatingCount: external.externalRatingCount, priceLevel: external.priceLevel,
        coupleId: couple.id, createdById: user.id,
      } })).id;
      else throw new ValidationError("That venue changed. Search for it again.");
    }
    const linked = [...new Set(activities.flatMap((activity) => activity.savedPlaceId ? [activity.savedPlaceId] : []))];
    if (linked.length && await tx.place.count({ where: { id: { in: linked }, coupleId: couple.id, deletedAt: null } }) !== linked.length) throw new NotFoundError("An activity venue isn't in your space.");
    const status = !finalize ? DateStatus.DRAFT : basics.date === today ? DateStatus.TODAY : DateStatus.PLANNED;
    const wall = (time?: string) => basics.date && time ? new Date(`${basics.date}T${time}:00.000Z`) : null;
    const date = await tx.date.create({ data: {
      coupleId: couple.id, createdById: user.id, clientDraftKey: input.key, status,
      title: basics.title ?? "", discoveryCategory: basics.discoveryCategory, notes: basics.notes,
      scheduledFor: basics.date ? new Date(`${basics.date}T00:00:00.000Z`) : null,
      plannedStartAt: wall(basics.startTime), plannedEndAt: wall(basics.endTime), plannedPlaceId: placeId,
      expectedBudgetCents: budget.expectedTotal, expectedBudgetMinCents: budget.budgetMin,
      expectedBudgetMaxCents: budget.budgetMax, budgetSplit: budget.split, currency: budget.currency ?? current.currency,
      plannedAt: finalize ? new Date() : null,
      activities: { create: activities.map((activity, index) => ({ title: activity.title, kind: "PLANNED", sortOrder: index,
        durationMinutes: activity.durationMinutes, costCents: activity.costCents, placeId: activity.savedPlaceId })) },
      events: { create: { actorId: user.id, kind: "CREATED", summary: finalize ? "saved this date" : "saved this draft" } },
    }, select: { id: true, status: true } });
    return date;
  });
  try { if (saved.status === DateStatus.DRAFT) await ensureUnfinishedPlanReminder(saved.id); else await ensureRemindersForDate(saved.id); }
  catch { console.error("[plan] Saved plan reminder setup will need retrying."); }
  return saved;
}
