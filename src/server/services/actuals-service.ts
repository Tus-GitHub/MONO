import "server-only";

import { DateActivityKind, DateStatus } from "@prisma/client";

import { authorizeDate } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { ActualActivityInput } from "@/lib/validation/date";
import { logDateEvent } from "@/server/services/date-event-service";

const ACTUAL = DateActivityKind.ACTUAL;

const RECORDABLE_STATUSES: DateStatus[] = [
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

export interface ActualActivityDTO {
  id: string;
  title: string;
  note: string | null;
  costCents: number | null;
  unplanned: boolean;
  sortOrder: number;
}

function toDTO(row: {
  id: string;
  title: string;
  description: string | null;
  costCents: number | null;
  unplanned: boolean;
  sortOrder: number;
}): ActualActivityDTO {
  return {
    id: row.id,
    title: row.title,
    note: row.description,
    costCents: row.costCents,
    unplanned: row.unplanned,
    sortOrder: row.sortOrder,
  };
}

async function requireRecordable(dateId: string) {
  const authorized = await authorizeDate(dateId);
  if (!RECORDABLE_STATUSES.includes(authorized.resource.status)) {
    throw new ValidationError("You can log activities once the date is under way.");
  }
  return authorized;
}

export async function listActualActivities(dateId: string): Promise<ActualActivityDTO[]> {
  const { resource } = await authorizeDate(dateId);
  const rows = await prisma.dateActivity.findMany({
    where: { dateId: resource.id, kind: ACTUAL },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      costCents: true,
      unplanned: true,
      sortOrder: true,
    },
  });
  return rows.map(toDTO);
}

export async function addActualActivity(dateId: string, input: ActualActivityInput) {
  const { context, resource } = await requireRecordable(dateId);
  const max = await prisma.dateActivity.aggregate({
    where: { dateId: resource.id, kind: ACTUAL },
    _max: { sortOrder: true },
  });
  const created = await prisma.dateActivity.create({
    data: {
      dateId: resource.id,
      kind: ACTUAL,
      title: input.title,
      description: input.note ?? null,
      costCents: input.costCents ?? null,
      unplanned: input.unplanned,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  await logDateEvent(
    resource.id,
    context.user.id,
    "ACTIVITY_ADDED",
    input.unplanned ? `added a stop that wasn't planned: “${input.title}”` : `logged “${input.title}”`,
  );
  return created.id;
}

export async function updateActualActivity(
  dateId: string,
  activityId: string,
  input: ActualActivityInput,
) {
  const { context, resource } = await requireRecordable(dateId);
  const result = await prisma.dateActivity.updateMany({
    where: { id: activityId, dateId: resource.id, kind: ACTUAL },
    data: {
      title: input.title,
      description: input.note ?? null,
      costCents: input.costCents ?? null,
      unplanned: input.unplanned,
    },
  });
  if (result.count === 0) throw new NotFoundError("That activity isn't on this date.");
  await logDateEvent(resource.id, context.user.id, "ACTIVITY_UPDATED", `updated “${input.title}”`);
}

export async function deleteActualActivity(dateId: string, activityId: string) {
  const { context, resource } = await requireRecordable(dateId);
  const activity = await prisma.dateActivity.findFirst({
    where: { id: activityId, dateId: resource.id, kind: ACTUAL },
    select: { title: true },
  });
  await prisma.dateActivity.deleteMany({
    where: { id: activityId, dateId: resource.id, kind: ACTUAL },
  });
  if (activity) {
    await logDateEvent(
      resource.id,
      context.user.id,
      "ACTIVITY_REMOVED",
      `removed “${activity.title}”`,
    );
  }
}

export async function reorderActualActivities(dateId: string, orderedIds: string[]) {
  const { resource } = await requireRecordable(dateId);
  const existing = await prisma.dateActivity.findMany({
    where: { dateId: resource.id, kind: ACTUAL },
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
}

/**
 * Copy the plan's activities into the actuals as a starting point — for the couple who mostly
 * did what they planned. Only fills an empty actuals list; it never overwrites what's there.
 */
export async function seedActualsFromPlan(dateId: string): Promise<number> {
  const { context, resource } = await requireRecordable(dateId);
  const [planned, actualCount] = await Promise.all([
    prisma.dateActivity.findMany({
      where: { dateId: resource.id, kind: DateActivityKind.PLANNED },
      orderBy: { sortOrder: "asc" },
      select: { title: true, description: true, costCents: true },
    }),
    prisma.dateActivity.count({ where: { dateId: resource.id, kind: ACTUAL } }),
  ]);
  if (actualCount > 0) throw new ValidationError("There are already activities recorded.");
  if (planned.length === 0) throw new ValidationError("There's no plan to copy from.");

  await prisma.dateActivity.createMany({
    data: planned.map((activity, index) => ({
      dateId: resource.id,
      kind: ACTUAL,
      title: activity.title,
      description: activity.description,
      costCents: activity.costCents,
      unplanned: false,
      sortOrder: index,
    })),
  });
  await logDateEvent(
    resource.id,
    context.user.id,
    "ACTUALS_RECORDED",
    "started the recap from the plan",
  );
  return planned.length;
}
