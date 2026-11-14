import "server-only";
import type { Place } from "@prisma/client";
import { authorizeDate } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { emptyLocalPlan } from "@/lib/date/local-plan";
import type { LocalPlan, LocalPlaceChoice } from "@/lib/validation/new-plan";
import { dateTimeInTimeZone } from "@/lib/utils/timezone";
import { ValidationError } from "@/lib/errors";

export async function firstCompletedDateId(coupleId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM dates WHERE "coupleId" = ${coupleId} AND "deletedAt" IS NULL AND status = 'COMPLETED'
    ORDER BY COALESCE("actualStartAt", "scheduledFor", "startedAt", "completedAt", "createdAt") ASC, id ASC LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

/** A read-only snapshot: opening a copy/recreation never creates a draft or changes the source. */
export async function getPlanTemplate(id: string, recreate = false): Promise<LocalPlan> {
  const { resource, context } = await authorizeDate(id);
  if (recreate && resource.status !== "COMPLETED") throw new ValidationError("Recreate a date after it has happened.");
  const source = await prisma.date.findUniqueOrThrow({ where: { id: resource.id }, include: {
    plannedPlace: true, actualPlace: true, activities: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { place: true } },
  } });
  const choice = (place: Place | null): LocalPlaceChoice | null => {
    if (!place || place.coupleId !== context.couple.id) return null;
    return { name: place.name, city: place.city, address: place.address, imageUrl: place.imageUrl,
      selection: place.deletedAt ? { mode: "custom", name: place.name, category: place.category, city: place.city ?? undefined, address: place.address?.slice(0, 240) ?? undefined }
        : { mode: "saved", savedPlaceId: place.id } };
  };
  const initial = emptyLocalPlan(source.currency, recreate ? source.title || "Our first date" : `${source.title} (copy)`.slice(0, 160));
  const money = (value: number | null) => value == null ? "" : String(value / 100);
  initial.notes = source.notes ?? ""; initial.category = source.discoveryCategory ?? "";
  initial.expectedTotal = money(source.expectedBudgetCents); initial.budgetMin = money(source.expectedBudgetMinCents);
  initial.budgetMax = money(source.expectedBudgetMaxCents); initial.split = source.budgetSplit;
  initial.place = choice(recreate ? source.actualPlace ?? source.plannedPlace : source.plannedPlace);
  initial.startTime = source.plannedStartAt?.toISOString().slice(11, 16) ?? "";
  initial.endTime = source.plannedEndAt?.toISOString().slice(11, 16) ?? "";
  const planned = source.activities.filter((stop) => stop.kind === "PLANNED");
  const actual = source.activities.filter((stop) => stop.kind === "ACTUAL");
  initial.activities = (recreate && actual.length ? actual : planned).map((stop) => {
    const fallback = planned.find((plan) => plan.title === stop.title && plan.sortOrder === stop.sortOrder);
    const clock = (value: Date | null) => value ? (stop.kind === "ACTUAL" ? dateTimeInTimeZone(value, context.couple.timezone).slice(11, 16) : value.toISOString().slice(11, 16)) : undefined;
    const place = choice(stop.place ?? fallback?.place ?? null);
    return { key: stop.id, title: stop.title.slice(0, 120), description: stop.description ?? fallback?.description ?? "",
      duration: String(stop.durationMinutes ?? fallback?.durationMinutes ?? ""), cost: money(stop.costCents ?? fallback?.costCents ?? null),
      savedPlaceId: place?.selection.mode === "saved" ? place.selection.savedPlaceId : "", place,
      startTime: clock(stop.startAt) ?? fallback?.startAt?.toISOString().slice(11, 16),
      endTime: clock(stop.endAt) ?? fallback?.endAt?.toISOString().slice(11, 16) };
  });
  return initial;
}
