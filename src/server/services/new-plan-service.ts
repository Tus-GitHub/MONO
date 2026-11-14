import "server-only";

import { DateStatus } from "@prisma/client";
import { requireCoupleContext } from "@/lib/authz";
import { lockLivingUser } from "@/lib/authz/user-write";
import { serializable } from "@/lib/db/serializable";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { dateBasicsSchema, dateBudgetSchema, plannedActivitySchema } from "@/lib/validation/date";
import type { LocalPlan } from "@/lib/validation/new-plan";
import { preparePlanVenue, resolvePlanVenue } from "./plan-venue-service";
import { getPlanTemplate } from "./plan-template-service";
import { planStepErrors } from "@/lib/date/plan-validation";
import { stopTimes } from "@/lib/date/stop-time";
import { todayYmdInTimeZone } from "@/lib/utils/timezone";
import { ensureRemindersForDate, ensureUnfinishedPlanReminder } from "./reminder-service";

/** The new editor performs no writes until this explicit, idempotent Save boundary. */
export async function saveNewPlan(input: LocalPlan, finalize: boolean, recreationId?: string) {
  const { user, couple } = await requireCoupleContext();
  if (recreationId) {
    const template = await getPlanTemplate(recreationId, true);
    input = { ...template, key: input.key, date: input.date, startTime: input.startTime, endTime: input.endTime };
    const clock = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (template.startTime && input.startTime) {
      const delta = clock(input.startTime) - clock(template.startTime);
      const shift = (time?: string) => {
        if (!time) return time;
        const minutes = clock(time) + delta;
        if (minutes < 0 || minutes >= 1440) throw new ValidationError("Those times move a stop outside the selected day.");
        return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      };
      input.activities = input.activities.map((stop) => ({ ...stop, startTime: shift(stop.startTime), endTime: shift(stop.endTime) }));
    }
  }
  if (!/^[a-f0-9-]{36}$/i.test(input.key)) throw new ValidationError("Start a new plan before saving.");
  const basics = dateBasicsSchema.parse({ ...input, discoveryCategory: input.category });
  const budget = dateBudgetSchema.parse({ ...input });
  const activities = input.activities.map((activity) => plannedActivitySchema.parse({
    title: activity.title, durationMinutes: activity.duration, costCents: activity.cost, savedPlaceId: activity.savedPlaceId,
    description: activity.description, startTime: activity.startTime, endTime: activity.endTime, placeSelection: activity.place?.selection,
  }));
  const today = todayYmdInTimeZone(couple.timezone);
  if (basics.date && basics.date < today) throw new ValidationError("Pick today or a future date.");
  if (finalize && (!basics.title?.trim() || !basics.date)) throw new ValidationError("Give your date a title and choose when before saving it as a date.");
  if (finalize) {
    const errors = planStepErrors(input, "review", couple.timezone);
    if (Object.keys(errors).length) throw new ValidationError("Check your date, times and event details before saving.", errors);
  }
  const selection = input.place?.selection;
  const selections = [selection, ...activities.map((activity) => activity.placeSelection ?? (activity.savedPlaceId ? { mode: "saved" as const, savedPlaceId: activity.savedPlaceId } : undefined))];
  const prepared = new Map<string, ReturnType<typeof preparePlanVenue>>();
  const venues = await Promise.all(selections.map((choice) => {
    const key = JSON.stringify(choice ?? null);
    if (!prepared.has(key)) prepared.set(key, preparePlanVenue(couple.id, choice));
    return prepared.get(key)!;
  }));
  const timing = activities.map((activity) => stopTimes(basics.date, activity.startTime, activity.endTime));
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
    if (recreationId && !await tx.date.findFirst({ where: { id: recreationId, coupleId: couple.id, deletedAt: null, status: "COMPLETED" }, select: { id: true } })) throw new NotFoundError("The original date is no longer available.");
    const resolved = new Map<string, string | null>();
    const resolve = async (index: number) => {
      const key = JSON.stringify(selections[index] ?? null);
      if (!resolved.has(key)) resolved.set(key, await resolvePlanVenue(tx, couple.id, user.id, selections[index], venues[index]));
      return resolved.get(key) ?? null;
    };
    const placeId = await resolve(0);
    const activityPlaces: (string | null)[] = [];
    for (let index = 0; index < activities.length; index++) activityPlaces.push(await resolve(index + 1));
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
        description: activity.description, ...timing[index], durationMinutes: activity.durationMinutes, costCents: activity.costCents, placeId: activityPlaces[index] })) },
      events: { create: { actorId: user.id, kind: "CREATED", summary: finalize ? "saved this date" : "saved this draft" } },
    }, select: { id: true, status: true } });
    return date;
  });
  try { if (saved.status === DateStatus.DRAFT) await ensureUnfinishedPlanReminder(saved.id); else await ensureRemindersForDate(saved.id); }
  catch { console.error("[plan] Saved plan reminder setup will need retrying."); }
  return saved;
}
