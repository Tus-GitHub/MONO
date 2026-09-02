import "server-only";

import { DateActivityKind, DateStatus, ExpensePayer, NotificationType } from "@prisma/client";

import { assertTransition } from "@/lib/date/lifecycle";
import { authorizeDate, requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { formatWallDate, formatWallTime } from "@/lib/utils/format";
import { logDateEvent } from "@/server/services/date-event-service";
import { notifyPartner } from "@/server/services/notification-service";
import {
  ensureRemindersForDate,
  ensureUnfinishedPlanReminder,
} from "@/server/services/reminder-service";
import type {
  DateBasicsInput,
  DateBudgetInput,
  PlannedActivityInput,
} from "@/lib/validation/date";

const PLANNED = DateActivityKind.PLANNED;
const EDITABLE_STATUSES: DateStatus[] = [
  DateStatus.DRAFT,
  DateStatus.PLANNED,
  DateStatus.TODAY,
];

/**
 * Tell the other partner one date got changed. Best-effort; the notification layer collapses a
 * flurry of edits into a single message and honours the recipient's "partner activity" pref.
 * Skipped for a draft (nobody else is watching it) and for a cancelled date.
 */
async function notePlanEditToPartner(
  context: { couple: { id: string }; user: { id: string } },
  resource: { id: string; title: string; status: DateStatus },
): Promise<void> {
  if (resource.status === DateStatus.DRAFT || resource.status === DateStatus.CANCELLED) return;
  await notifyPartner({
    coupleId: context.couple.id,
    actorId: context.user.id,
    type: NotificationType.DATE_EDITED,
    title: "Your partner updated a plan",
    body: resource.title || "A shared date",
    entityType: "Date",
    entityId: resource.id,
  });
}

/** Wall-clock times are stored as UTC-encoded so `YYYY-MM-DD` / `HH:MM` round-trip cleanly. */
function combineWall(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T${timeStr ?? "00:00"}:00.000Z`);
}

// --- DTOs ------------------------------------------------------------------

export interface PlanActivityDTO {
  id: string;
  title: string;
  durationMinutes: number | null;
  costCents: number | null;
  sortOrder: number;
  placeId: string | null;
  placeName: string | null;
}

export interface SavedPlaceOption {
  id: string;
  name: string;
}

export interface PlanDateDTO {
  id: string;
  status: DateStatus;
  title: string;
  notes: string | null;
  date: string | null; // YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null;
  plannedStartIso: string | null;
  expectedTotalCents: number | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  budgetSplit: ExpensePayer;
  currency: string;
  place: { id: string; name: string } | null;
  activities: PlanActivityDTO[];
}

type DateRow = Awaited<ReturnType<typeof loadPlanRow>>;

function loadPlanRow(id: string) {
  return prisma.date.findUniqueOrThrow({
    where: { id },
    include: {
      plannedPlace: { select: { id: true, name: true } },
      activities: {
        where: { kind: PLANNED },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          durationMinutes: true,
          costCents: true,
          sortOrder: true,
          placeId: true,
          place: { select: { name: true } },
        },
      },
    },
  });
}

function toDTO(date: DateRow): PlanDateDTO {
  return {
    id: date.id,
    status: date.status,
    title: date.title,
    notes: date.notes,
    date: date.scheduledFor ? date.scheduledFor.toISOString().slice(0, 10) : null,
    startTime: date.plannedStartAt ? date.plannedStartAt.toISOString().slice(11, 16) : null,
    endTime: date.plannedEndAt ? date.plannedEndAt.toISOString().slice(11, 16) : null,
    plannedStartIso: date.plannedStartAt?.toISOString() ?? null,
    expectedTotalCents: date.expectedBudgetCents,
    budgetMinCents: date.expectedBudgetMinCents,
    budgetMaxCents: date.expectedBudgetMaxCents,
    budgetSplit: date.budgetSplit,
    currency: date.currency,
    place: date.plannedPlace,
    activities: date.activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      durationMinutes: activity.durationMinutes,
      costCents: activity.costCents,
      sortOrder: activity.sortOrder,
      placeId: activity.placeId,
      placeName: activity.place?.name ?? null,
    })),
  };
}

export async function listSavedPlaceOptions(): Promise<SavedPlaceOption[]> {
  const { couple } = await requireCoupleContext();
  return prisma.place.findMany({
    where: { coupleId: couple.id, deletedAt: null },
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
    take: 100,
  });
}

// --- reads ---------------------------------------------------------------

export async function getPlan(dateId: string): Promise<PlanDateDTO> {
  const { resource } = await authorizeDate(dateId);
  if (!EDITABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("This date can no longer be planned.");
  }
  return toDTO(await loadPlanRow(resource.id));
}

export async function listDrafts(): Promise<
  { id: string; title: string; date: string | null; activityCount: number; updatedAt: string }[]
> {
  const { couple } = await requireCoupleContext();
  const rows = await prisma.date.findMany({
    where: { coupleId: couple.id, deletedAt: null, status: DateStatus.DRAFT },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      scheduledFor: true,
      updatedAt: true,
      _count: { select: { activities: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.scheduledFor ? row.scheduledFor.toISOString().slice(0, 10) : null,
    activityCount: row._count.activities,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

// --- create ------------------------------------------------------------------

export async function startDraft(options: {
  title?: string;
  plannedPlaceId?: string;
} = {}): Promise<{ id: string }> {
  const { user, couple } = await requireCoupleContext();

  let placeId: string | null = null;
  if (options.plannedPlaceId) {
    const place = await prisma.place.findFirst({
      where: { id: options.plannedPlaceId, coupleId: couple.id, deletedAt: null },
      select: { id: true },
    });
    placeId = place?.id ?? null;
  }

  const draft = await prisma.date.create({
    data: {
      coupleId: couple.id,
      createdById: user.id,
      status: DateStatus.DRAFT,
      title: options.title?.trim().slice(0, 160) ?? "",
      plannedPlaceId: placeId,
      currency: couple.currency,
    },
    select: { id: true },
  });
  await logDateEvent(draft.id, user.id, "CREATED", "started this plan");
  await ensureUnfinishedPlanReminder(draft.id);
  return draft;
}

// --- step saves ------------------------------------------------------------

export async function updateBasics(dateId: string, input: DateBasicsInput) {
  const { context, resource } = await authorizeDate(dateId);
  const before = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    select: { title: true, notes: true, scheduledFor: true, plannedStartAt: true, plannedEndAt: true },
  });

  const nextTitle = input.title?.trim() ?? "";
  const nextNotes = input.notes ?? null;
  const nextScheduled = input.date ? new Date(`${input.date}T00:00:00.000Z`) : null;
  const nextStart = combineWall(input.date, input.startTime);
  const nextEnd = combineWall(input.date, input.endTime);

  await prisma.date.update({
    where: { id: resource.id },
    data: {
      title: nextTitle,
      notes: nextNotes,
      scheduledFor: nextScheduled,
      plannedStartAt: nextStart,
      plannedEndAt: nextEnd,
    },
  });

  const actorId = context.user.id;
  const iso = (d: Date | null) => d?.toISOString() ?? null;

  if (nextTitle !== before.title) {
    await logDateEvent(
      resource.id,
      actorId,
      "TITLE_CHANGED",
      nextTitle ? `renamed it to “${nextTitle}”` : "cleared the title",
    );
  }
  if ((nextNotes ?? "") !== (before.notes ?? "")) {
    await logDateEvent(resource.id, actorId, "NOTES_CHANGED", "updated the notes");
  }
  if (
    iso(nextScheduled) !== iso(before.scheduledFor) ||
    iso(nextStart) !== iso(before.plannedStartAt) ||
    iso(nextEnd) !== iso(before.plannedEndAt)
  ) {
    let summary = "changed the time";
    if (iso(nextScheduled) !== iso(before.scheduledFor) && input.date) {
      summary = `moved it to ${formatWallDate(input.date, "medium")}`;
    } else if (input.startTime && iso(nextStart) !== iso(before.plannedStartAt)) {
      summary = `set the start time to ${formatWallTime(input.startTime)}`;
    } else if (!nextScheduled) {
      summary = "cleared the date";
    }
    await logDateEvent(resource.id, actorId, "TIME_CHANGED", summary);
    await ensureRemindersForDate(resource.id);
  }
  await notePlanEditToPartner(context, resource);
}

export async function updateBudget(dateId: string, input: DateBudgetInput) {
  const { context, resource } = await authorizeDate(dateId);
  const before = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    select: {
      expectedBudgetCents: true,
      expectedBudgetMinCents: true,
      expectedBudgetMaxCents: true,
      budgetSplit: true,
      currency: true,
    },
  });

  const next = {
    expectedBudgetCents: input.expectedTotal ?? null,
    expectedBudgetMinCents: input.budgetMin ?? null,
    expectedBudgetMaxCents: input.budgetMax ?? null,
    budgetSplit: input.split,
    currency: input.currency ?? "USD",
  };
  await prisma.date.update({ where: { id: resource.id }, data: next });

  if (
    next.expectedBudgetCents !== before.expectedBudgetCents ||
    next.expectedBudgetMinCents !== before.expectedBudgetMinCents ||
    next.expectedBudgetMaxCents !== before.expectedBudgetMaxCents ||
    next.budgetSplit !== before.budgetSplit ||
    next.currency !== before.currency
  ) {
    await logDateEvent(resource.id, context.user.id, "BUDGET_CHANGED", "updated the budget");
    await notePlanEditToPartner(context, resource);
  }
}

// --- activities ----------------------------------------------------------

async function resolveActivityPlace(
  coupleId: string,
  savedPlaceId: string | undefined,
): Promise<string | null> {
  if (!savedPlaceId) return null;
  const place = await prisma.place.findFirst({
    where: { id: savedPlaceId, coupleId, deletedAt: null },
    select: { id: true },
  });
  if (!place) throw new NotFoundError("That place isn't in your list.");
  return place.id;
}

export async function addActivity(dateId: string, input: PlannedActivityInput) {
  const { context, resource } = await authorizeDate(dateId);
  const [max, placeId] = await Promise.all([
    prisma.dateActivity.aggregate({
      where: { dateId: resource.id, kind: PLANNED },
      _max: { sortOrder: true },
    }),
    resolveActivityPlace(context.couple.id, input.savedPlaceId),
  ]);
  await prisma.dateActivity.create({
    data: {
      dateId: resource.id,
      kind: PLANNED,
      title: input.title,
      durationMinutes: input.durationMinutes ?? null,
      costCents: input.costCents ?? null,
      placeId,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  await logDateEvent(resource.id, context.user.id, "ACTIVITY_ADDED", `added “${input.title}”`);
  await notePlanEditToPartner(context, resource);
}

export async function updateActivity(
  dateId: string,
  activityId: string,
  input: PlannedActivityInput,
) {
  const { context, resource } = await authorizeDate(dateId);
  const [placeId, before] = await Promise.all([
    resolveActivityPlace(context.couple.id, input.savedPlaceId),
    prisma.dateActivity.findFirst({
      where: { id: activityId, dateId: resource.id, kind: PLANNED },
      select: { title: true },
    }),
  ]);
  const result = await prisma.dateActivity.updateMany({
    where: { id: activityId, dateId: resource.id, kind: PLANNED },
    data: {
      title: input.title,
      durationMinutes: input.durationMinutes ?? null,
      costCents: input.costCents ?? null,
      placeId,
    },
  });
  if (result.count === 0) throw new NotFoundError("That activity isn't on this date.");
  const summary =
    before && before.title !== input.title
      ? `renamed an activity to “${input.title}”`
      : `updated “${input.title}”`;
  await logDateEvent(resource.id, context.user.id, "ACTIVITY_UPDATED", summary);
  await notePlanEditToPartner(context, resource);
}

export async function deleteActivity(dateId: string, activityId: string) {
  const { context, resource } = await authorizeDate(dateId);
  const activity = await prisma.dateActivity.findFirst({
    where: { id: activityId, dateId: resource.id, kind: PLANNED },
    select: { title: true },
  });
  await prisma.dateActivity.deleteMany({
    where: { id: activityId, dateId: resource.id, kind: PLANNED },
  });
  if (activity) {
    await logDateEvent(
      resource.id,
      context.user.id,
      "ACTIVITY_REMOVED",
      `removed “${activity.title}”`,
    );
    await notePlanEditToPartner(context, resource);
  }
}

export async function reorderActivities(dateId: string, orderedIds: string[]) {
  const { context, resource } = await authorizeDate(dateId);
  const existing = await prisma.dateActivity.findMany({
    where: { dateId: resource.id, kind: PLANNED },
    select: { id: true },
  });
  const ids = new Set(existing.map((activity) => activity.id));
  if (orderedIds.length !== ids.size || orderedIds.some((id) => !ids.has(id))) {
    throw new ValidationError("That ordering doesn't match this date's activities.");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.dateActivity.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  await logDateEvent(
    resource.id,
    context.user.id,
    "ACTIVITY_REORDERED",
    "reordered the activities",
  );
  await notePlanEditToPartner(context, resource);
}

// --- lifecycle -----------------------------------------------------------

/** DRAFT/PLANNED/TODAY → PLANNED (or TODAY if it's today). Requires a title and a date. */
export async function finalizePlan(dateId: string): Promise<{ id: string }> {
  const { context, resource } = await authorizeDate(dateId);
  if (!EDITABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("This date can no longer be planned.");
  }
  const date = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    select: { title: true, scheduledFor: true },
  });
  if (!date.title.trim()) throw new ValidationError("Give your date a title first.");
  if (!date.scheduledFor) throw new ValidationError("Pick a date first.");

  const isToday = date.scheduledFor.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

  await prisma.date.update({
    where: { id: resource.id },
    data: {
      status: isToday ? DateStatus.TODAY : DateStatus.PLANNED,
      plannedAt: resource.status === DateStatus.DRAFT ? new Date() : undefined,
    },
  });

  await logDateEvent(
    resource.id,
    context.user.id,
    "STATUS_CHANGED",
    resource.status === DateStatus.DRAFT ? "made it a plan" : "saved the plan",
    { to: isToday ? "TODAY" : "PLANNED" },
  );
  await ensureRemindersForDate(resource.id);
  return { id: resource.id };
}

export async function duplicateDate(dateId: string): Promise<{ id: string }> {
  const { context, resource } = await authorizeDate(dateId);
  const source = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    include: {
      activities: {
        where: { kind: PLANNED },
        orderBy: { sortOrder: "asc" },
        select: { title: true, description: true, durationMinutes: true, costCents: true },
      },
    },
  });

  const copy = await prisma.date.create({
    data: {
      coupleId: context.couple.id,
      createdById: context.user.id,
      status: DateStatus.DRAFT,
      title: source.title ? `${source.title} (copy)`.slice(0, 160) : "",
      notes: source.notes,
      plannedPlaceId: source.plannedPlaceId,
      expectedBudgetCents: source.expectedBudgetCents,
      expectedBudgetMinCents: source.expectedBudgetMinCents,
      expectedBudgetMaxCents: source.expectedBudgetMaxCents,
      budgetSplit: source.budgetSplit,
      currency: source.currency,
      activities: {
        create: source.activities.map((activity, index) => ({
          kind: PLANNED,
          title: activity.title,
          description: activity.description,
          durationMinutes: activity.durationMinutes,
          costCents: activity.costCents,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });
  await logDateEvent(copy.id, context.user.id, "CREATED", "created this from a copy");
  await ensureUnfinishedPlanReminder(copy.id);
  return copy;
}

export async function cancelDate(dateId: string, reason?: string) {
  const { context, resource } = await authorizeDate(dateId);
  assertTransition(resource.status, DateStatus.CANCELLED);
  await prisma.date.update({
    where: { id: resource.id },
    data: {
      status: DateStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason?.trim() || null,
    },
  });
  await logDateEvent(resource.id, context.user.id, "STATUS_CHANGED", "cancelled the date", {
    from: resource.status,
    to: "CANCELLED",
  });
  await ensureRemindersForDate(resource.id);
}

export async function deleteDatePlan(dateId: string) {
  const { resource } = await authorizeDate(dateId);
  await prisma.date.update({
    where: { id: resource.id },
    data: { deletedAt: new Date() },
  });
}
