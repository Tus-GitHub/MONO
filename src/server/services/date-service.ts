import "server-only";

import { DateStatus, Prisma } from "@prisma/client";

import { authorizeDate, requireCoupleContext } from "@/lib/authz/couple";
import { buildComparison } from "@/lib/date/comparison";
import { assertTransition, lifecycleTimestampsFor } from "@/lib/date/lifecycle";
import { buildPipeline } from "@/lib/date/pipeline";
import { budgetDelta, categoryBreakdown } from "@/lib/date/expense-breakdown";
import { contributionsOf, ownerShareOf, payerFacing } from "@/lib/date/expense-split";
import { isReviewEditable, reviewStage } from "@/lib/date/review-reveal";
import { valueForMoney } from "@/lib/date/value-for-money";
import { buildReviewComparison, revisitCompatibility } from "@/lib/review/comparison";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { formatWallTime } from "@/lib/utils/format";
import type {
  DateActualsInput,
  DatePlanInput,
  TransitionDateInput,
} from "@/lib/validation/date";
import { logDateEvent } from "@/server/services/date-event-service";
import { PHOTO_SELECT, toPhotoView } from "@/server/services/photo-service";
import {
  ensureMemoryReminder,
  ensureRemindersForDate,
  ensureReviewReminders,
} from "@/server/services/reminder-service";

/** "7:00 PM – 9:30 PM" from two "HH:MM" wall-clock strings (either side optional). */
function wallRange(start: string | null, end: string | null): string | null {
  const s = start ? formatWallTime(start) : "";
  const e = end ? formatWallTime(end) : "";
  if (s && e) return `${s} – ${e}`;
  return s || e || null;
}

const RECORDABLE_STATUSES: DateStatus[] = [
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

const STATUS_VERB: Record<DateStatus, string> = {
  DRAFT: "moved it back to a draft",
  PLANNED: "marked it as planned",
  TODAY: "flagged it for today",
  IN_PROGRESS: "started the date",
  COMPLETED: "marked the date completed",
  CANCELLED: "cancelled the date",
};

const UPCOMING_STATUSES: DateStatus[] = [
  DateStatus.PLANNED,
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
];

/**
 * Business logic for the Date entity. All couple resolution and access checks happen through
 * the authorization layer — callers pass only the ids they received and the validated input.
 */

async function assertPlaceInCouple(coupleId: string, placeId: string): Promise<void> {
  const place = await prisma.place.findFirst({
    where: { id: placeId, coupleId, deletedAt: null },
    select: { id: true },
  });
  if (!place) throw new NotFoundError("That place isn't in your list.");
}

export async function createDate(input: DatePlanInput) {
  const { user, couple } = await requireCoupleContext();

  if (input.plannedPlaceId) {
    await assertPlaceInCouple(couple.id, input.plannedPlaceId);
  }

  return prisma.date.create({
    data: {
      coupleId: couple.id,
      createdById: user.id,
      status: DateStatus.DRAFT,
      title: input.title,
      notes: input.notes,
      scheduledFor: input.scheduledFor,
      plannedStartAt: input.plannedStartAt,
      plannedEndAt: input.plannedEndAt,
      plannedPlaceId: input.plannedPlaceId,
      expectedBudgetCents: input.expectedBudgetCents,
      currency: input.currency ?? couple.currency,
    },
  });
}

export async function listDates(params: { status?: DateStatus } = {}) {
  const { couple } = await requireCoupleContext();

  return prisma.date.findMany({
    where: { coupleId: couple.id, deletedAt: null, status: params.status },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    include: {
      plannedPlace: true,
      _count: { select: { photos: true, activities: true, reviews: true, expenses: true } },
    },
  });
}

export async function getDateDetail(dateId: string) {
  const { resource } = await authorizeDate(dateId);

  return prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    include: {
      plannedPlace: true,
      actualPlace: true,
      activities: { orderBy: { sortOrder: "asc" } },
      photos: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      reviews: {
        include: {
          ratings: { include: { category: true } },
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      revisitDecision: true,
      memory: true,
      expenses: { where: { deletedAt: null }, orderBy: { spentAt: "asc" } },
    },
  });
}

export async function transitionDate(dateId: string, input: TransitionDateInput) {
  const { context, resource } = await authorizeDate(dateId);
  assertTransition(resource.status, input.to); // backend enforces the lifecycle

  const updated = await prisma.date.update({
    where: { id: resource.id },
    data: {
      status: input.to,
      cancelReason:
        input.to === DateStatus.CANCELLED ? (input.cancelReason ?? null) : null,
      // Record who first got the date under way; a later reopen doesn't overwrite it.
      startedById:
        input.to === DateStatus.IN_PROGRESS
          ? (resource.startedById ?? context.user.id)
          : undefined,
      ...lifecycleTimestampsFor(input.to),
    },
  });

  await logDateEvent(
    resource.id,
    context.user.id,
    "STATUS_CHANGED",
    STATUS_VERB[input.to],
    { from: resource.status, to: input.to },
  );
  await ensureRemindersForDate(resource.id);
  // Both of these clear themselves when the date isn't COMPLETED, so a reopen tidies up too.
  await ensureReviewReminders(resource.id);
  await ensureMemoryReminder(resource.id);

  return updated;
}

/**
 * Record what actually happened. Every field may diverge completely from the plan; a saved
 * place wins over free text. Allowed once the date is under way (TODAY / IN_PROGRESS) and
 * still allowed after it's COMPLETED — a completed date is never locked.
 */
export async function recordActuals(dateId: string, input: DateActualsInput) {
  const { context, resource } = await authorizeDate(dateId);
  if (!RECORDABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("You can record what happened once the date is under way.");
  }

  let actualPlaceId: string | null = null;
  if (input.actualSavedPlaceId) {
    await assertPlaceInCouple(context.couple.id, input.actualSavedPlaceId);
    actualPlaceId = input.actualSavedPlaceId;
  }

  const day =
    input.actualDate ??
    (resource.scheduledFor ? resource.scheduledFor.toISOString().slice(0, 10) : null);
  const combine = (time?: string) =>
    day && time ? new Date(`${day}T${time}:00.000Z`) : null;

  await prisma.date.update({
    where: { id: resource.id },
    data: {
      actualPlaceId,
      actualLocationText: actualPlaceId ? null : (input.actualLocationText ?? null),
      actualStartAt: combine(input.actualStartTime),
      actualEndAt: combine(input.actualEndTime),
      actualSpendCents: input.actualSpend ?? null,
      actualNotes: input.actualNotes ?? null,
      actualsRecordedAt: new Date(),
    },
  });

  await logDateEvent(
    resource.id,
    context.user.id,
    "ACTUALS_RECORDED",
    "recorded how it actually went",
  );
}

/**
 * The full view model for `/dates/[id]`: the plan, what actually happened, the plan-vs-reality
 * comparison, and the post-date pipeline — assembled here so the page just renders.
 */
export async function getDateExperience(dateId: string, userId: string) {
  const { context, resource } = await authorizeDate(dateId);
  const [members, reviewCategories] = await Promise.all([
    prisma.coupleMember.findMany({
      where: { coupleId: context.couple.id, status: "ACTIVE" },
      select: { role: true, user: { select: { id: true, name: true, nickname: true } } },
    }),
    prisma.reviewCategory.findMany({
      where: { coupleId: context.couple.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, key: true },
    }),
  ]);
  const hasPartner = members.length >= 2;
  const myRole = context.membership.role; // OWNER | PARTNER
  const iAmOwner = myRole === "OWNER";
  const otherName =
    members.find((m) => m.user.id !== userId)?.user.nickname ??
    members.find((m) => m.user.id !== userId)?.user.name ??
    "your partner";

  const placeSelect = {
    id: true,
    name: true,
    city: true,
    category: true,
    isFavorite: true,
    address: true,
    latitude: true,
    longitude: true,
    mapUrl: true,
  } satisfies Prisma.PlaceSelect;

  const date = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    include: {
      couple: { select: { timezone: true } },
      plannedPlace: { select: placeSelect },
      actualPlace: { select: placeSelect },
      startedBy: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      activities: { orderBy: { sortOrder: "asc" } },
      photos: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: PHOTO_SELECT },
      reviews: {
        orderBy: { createdAt: "asc" },
        include: {
          ratings: { select: { categoryId: true, score: true } },
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      revisitDecision: { include: { decidedBy: { select: { id: true, name: true } } } },
      memory: { include: { coverPhoto: { select: { id: true, url: true } } } },
      expenses: {
        where: { deletedAt: null },
        orderBy: { spentAt: "asc" },
        include: { recordedBy: { select: { id: true, name: true } } },
      },
    },
  });

  const iso = (value: Date | null) => value?.toISOString() ?? null;
  const ymd = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
  const hhmm = (value: Date | null) => (value ? value.toISOString().slice(11, 16) : null);

  const plannedActivities = date.activities.filter((a) => a.kind === "PLANNED");
  const actualAll = date.activities.filter((a) => a.kind === "ACTUAL");
  const actualCore = actualAll.filter((a) => !a.unplanned);
  const extras = actualAll.filter((a) => a.unplanned);

  const plan = {
    placeId: date.plannedPlace?.id ?? null,
    placeName: date.plannedPlace?.name ?? null,
    placeCity: date.plannedPlace?.city ?? null,
    place: date.plannedPlace,
    dateYmd: ymd(date.scheduledFor),
    startTime: hhmm(date.plannedStartAt),
    endTime: hhmm(date.plannedEndAt),
    startIso: iso(date.plannedStartAt),
    timeLabel: wallRange(hhmm(date.plannedStartAt), hhmm(date.plannedEndAt)),
    budgetCents: date.expectedBudgetCents,
    budgetMinCents: date.expectedBudgetMinCents,
    budgetMaxCents: date.expectedBudgetMaxCents,
    currency: date.currency,
    notes: date.notes,
    activities: plannedActivities.map((a) => ({
      id: a.id,
      title: a.title,
      durationMinutes: a.durationMinutes,
      costCents: a.costCents,
    })),
  };

  const expenseSumCents = date.expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const effectiveSpendCents =
    date.actualSpendCents ?? (date.expenses.length > 0 ? expenseSumCents : null);

  // --- Money -------------------------------------------------------------
  const expenseViews = date.expenses.map((e) => {
    const ownerShare = ownerShareOf({
      amountCents: e.amountCents,
      paidBy: e.paidBy,
      ownerShareCents: e.ownerShareCents,
    });
    const mineShareCents = iAmOwner ? ownerShare : e.amountCents - ownerShare;
    return {
      id: e.id,
      description: e.description,
      amountCents: e.amountCents,
      currency: e.currency,
      category: e.category,
      note: e.note,
      spentAt: e.spentAt.toISOString(),
      payer: payerFacing(e.paidBy, myRole),
      mineShareCents,
      partnerShareCents: e.amountCents - mineShareCents,
      recordedByName: e.recordedBy.name,
      recordedByMe: e.recordedBy.id === userId,
    };
  });

  const contrib = contributionsOf(
    date.expenses.map((e) => ({
      amountCents: e.amountCents,
      paidBy: e.paidBy,
      ownerShareCents: e.ownerShareCents,
    })),
  );
  const mineContribCents = iAmOwner ? contrib.ownerCents : contrib.partnerCents;

  const spending = {
    currency: date.currency,
    totalCents: expenseSumCents,
    expenseCount: date.expenses.length,
    actualSpendCents: date.actualSpendCents,
    effectiveSpendCents,
    plannedTotalCents: date.expectedBudgetCents,
    plannedMinCents: date.expectedBudgetMinCents,
    plannedMaxCents: date.expectedBudgetMaxCents,
    delta: budgetDelta(date.expectedBudgetCents, effectiveSpendCents, date.currency),
    categories: categoryBreakdown(
      date.expenses.map((e) => ({ category: e.category, amountCents: e.amountCents })),
    ),
    contributions: {
      mineCents: mineContribCents,
      partnerCents: contrib.totalCents - mineContribCents,
      partnerName: otherName,
    },
  };

  const actual = {
    placeId: date.actualPlace?.id ?? null,
    placeName: date.actualPlace?.name ?? null,
    place: date.actualPlace,
    locationText: date.actualLocationText,
    label: date.actualPlace?.name ?? date.actualLocationText ?? null,
    dateYmd: ymd(date.actualStartAt),
    startTime: hhmm(date.actualStartAt),
    endTime: hhmm(date.actualEndAt),
    startIso: iso(date.actualStartAt),
    timeLabel: wallRange(hhmm(date.actualStartAt), hhmm(date.actualEndAt)),
    spendCents: date.actualSpendCents,
    effectiveSpendCents,
    notes: date.actualNotes,
    recordedAt: iso(date.actualsRecordedAt),
    activities: actualCore.map((a) => ({
      id: a.id,
      title: a.title,
      unplanned: a.unplanned,
      costCents: a.costCents,
      note: a.description,
      sortOrder: a.sortOrder,
    })),
    extras: extras.map((a) => ({
      id: a.id,
      title: a.title,
      unplanned: true,
      costCents: a.costCents,
      note: a.description,
      sortOrder: a.sortOrder,
    })),
  };

  const hasActualSignal =
    date.actualsRecordedAt != null ||
    actualAll.length > 0 ||
    date.actualPlace != null ||
    date.actualLocationText != null ||
    date.actualStartAt != null ||
    date.actualSpendCents != null ||
    (date.actualNotes?.length ?? 0) > 0;

  const comparison = hasActualSignal
    ? buildComparison({
        plannedTime: plan.timeLabel,
        actualTime: actual.timeLabel,
        plannedPlace: plan.placeName,
        actualPlace: actual.label,
        plannedBudgetCents: plan.budgetCents,
        actualSpendCents: effectiveSpendCents,
        plannedActivities: plan.activities.map((a) => a.title),
        actualActivities: actualCore.map((a) => a.title),
        extraActivities: extras.map((a) => a.title),
      })
    : null;

  const mineRow = date.reviews.find((r) => r.authorId === userId) ?? null;
  const partnerRow = date.reviews.find((r) => r.authorId !== userId) ?? null;
  const mineSubmitted = mineRow?.submittedAt != null;
  const partnerSubmitted = partnerRow?.submittedAt != null;
  const stage = reviewStage({
    mineExists: mineRow != null,
    mineSubmitted,
    partnerSubmitted,
    hasPartner,
  });
  const revealed = stage === "revealed";

  const shapeReviewSide = (row: typeof mineRow) =>
    row
      ? {
          authorName: row.author.name,
          authorAvatar: row.author.avatarUrl,
          submitted: row.submittedAt != null,
          overallRating: row.overallRating,
          suggestedOverall: row.suggestedOverall,
          personalRevisit: row.personalRevisit,
          personalRevisitNote: row.personalRevisitNote,
          reflections: {
            loved: row.lovedText,
            better: row.betterText,
            remember: row.rememberText,
            unexpected: row.unexpectedText,
          },
          scores: Object.fromEntries(row.ratings.map((rt) => [rt.categoryId, rt.score])),
        }
      : null;

  const mineSide = shapeReviewSide(mineRow);
  const partnerSide = revealed ? shapeReviewSide(partnerRow) : null;

  // The full combined-review model is built *only* once both sides are in.
  const reviewComparison =
    revealed && mineSide && partnerSide
      ? buildReviewComparison({
          categories: reviewCategories,
          youScores: mineSide.scores,
          partnerScores: partnerSide.scores,
          youOverall: mineSide.overallRating,
          partnerOverall: partnerSide.overallRating,
          partnerName: partnerRow?.author.name ?? "your partner",
        })
      : null;
  const revisitCompat =
    revealed && mineSide && partnerSide
      ? revisitCompatibility(mineSide.personalRevisit, partnerSide.personalRevisit)
      : null;
  const combined10 = reviewComparison?.coupleScore ?? null;

  // Value for money — only the recorded spend and the score the couple actually gave.
  const valueCategoryId = reviewCategories.find((c) => c.key === "value")?.id ?? null;
  const valueScore =
    reviewComparison && valueCategoryId
      ? (reviewComparison.categories.find((c) => c.id === valueCategoryId)?.combined ?? null)
      : null;
  const valueForMoneyView = revealed
    ? valueForMoney({ spendCents: effectiveSpendCents, valueScore })
    : null;

  const pipeline = buildPipeline({
    dateId: date.id,
    actualsRecorded: date.actualsRecordedAt != null || actualAll.length > 0,
    photoCount: date.photos.length,
    bestPhotoSet: date.bestPhotoId != null,
    myReview: mineSubmitted,
    partnerReview: partnerSubmitted,
    hasPartner,
    revisitDecided: date.revisitDecision != null,
    hasMemory: date.memory != null,
  });

  return {
    date: {
      id: date.id,
      title: date.title,
      status: date.status,
      notes: date.notes,
      currency: date.currency,
      timezone: date.couple.timezone,
      scheduledForYmd: ymd(date.scheduledFor),
      startedAt: iso(date.startedAt),
      startedBy: date.startedBy
        ? {
            id: date.startedBy.id,
            name: date.startedBy.name,
            nickname: date.startedBy.nickname,
            isMe: date.startedBy.id === userId,
          }
        : null,
      completedAt: iso(date.completedAt),
      cancelReason: date.cancelReason,
      bestPhotoId: date.bestPhotoId,
    },
    plan,
    actual,
    comparison,
    pipeline,
    photos: date.photos.map((row) => toPhotoView(row, date.bestPhotoId)),
    review: {
      stage,
      revealed,
      editable: isReviewEditable(stage),
      hasPartner,
      partnerName: partnerRow?.author.name ?? null,
      mineStarted: mineRow != null,
      mineSubmitted,
      partnerSubmitted,
      categories: reviewCategories,
      mine: mineSide,
      partner: partnerSide,
      combined10,
      comparison: reviewComparison,
      revisitCompat,
    },
    revisit: date.revisitDecision
      ? {
          choice: date.revisitDecision.choice,
          reason: date.revisitDecision.reason,
          targetTimeframe: date.revisitDecision.targetTimeframe,
          decidedByName: date.revisitDecision.decidedBy.name,
        }
      : null,
    memory: date.memory
      ? {
          id: date.memory.id,
          title: date.memory.title,
          body: date.memory.body,
          isFavorite: date.memory.isFavorite,
          coverPhotoId: date.memory.coverPhotoId,
          coverPhotoUrl: date.memory.coverPhoto?.url ?? null,
        }
      : null,
    expenses: expenseViews,
    spending,
    valueForMoney: valueForMoneyView,
    totals: { expenseSumCents, effectiveSpendCents },
  };
}

export type DateExperience = Awaited<ReturnType<typeof getDateExperience>>;

/** All live dates (planned / today / in progress), chronological. */
export async function getUpcomingDates(sort: "soonest" | "latest" = "soonest") {
  const { couple } = await requireCoupleContext();
  return prisma.date.findMany({
    where: { coupleId: couple.id, deletedAt: null, status: { in: UPCOMING_STATUSES } },
    orderBy: [
      { scheduledFor: { sort: sort === "soonest" ? "asc" : "desc", nulls: "last" } },
      { plannedStartAt: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      plannedPlace: { select: { name: true, city: true, category: true } },
      activities: { where: { kind: "PLANNED" }, orderBy: { sortOrder: "asc" }, select: { title: true } },
      _count: { select: { activities: true } },
    },
  });
}
