import "server-only";

import { DateStatus, NotificationType, Prisma, type ReviewRevisit } from "@prisma/client";

import { authorizeDate } from "@/lib/authz";
import type { CoverImage } from "@/lib/date/photo-view";
import { isReviewEditable, reviewStage, type ReviewStage } from "@/lib/date/review-reveal";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { SCORE_MAX, SCORE_MIN, suggestedOverall } from "@/lib/review/scale";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { ReviewDraftInput, ReviewSubmitInput } from "@/lib/validation/date";
import { logDateEvent } from "@/server/services/date-event-service";
import { notifyCouple, notifyPartner } from "@/server/services/notification-service";
import { PHOTO_SELECT, resolveDateCover } from "@/server/services/photo-service";
import { ensureReviewReminders } from "@/server/services/reminder-service";

const REVIEWABLE_STATUSES: DateStatus[] = [DateStatus.IN_PROGRESS, DateStatus.COMPLETED];

const REVIEW_SELECT = {
  authorId: true,
  submittedAt: true,
  overallRating: true,
  suggestedOverall: true,
  personalRevisit: true,
  personalRevisitNote: true,
  lovedText: true,
  betterText: true,
  rememberText: true,
  unexpectedText: true,
  ratings: { select: { categoryId: true, score: true } },
} satisfies Prisma.DateReviewSelect;

type ReviewRow = Prisma.DateReviewGetPayload<{ select: typeof REVIEW_SELECT }>;

export interface MyReviewView {
  submitted: boolean;
  overallRating: number | null;
  suggestedOverall: number | null;
  personalRevisit: ReviewRevisit | null;
  personalRevisitNote: string | null;
  lovedText: string | null;
  betterText: string | null;
  rememberText: string | null;
  unexpectedText: string | null;
  scores: Record<string, number>;
}

export interface ReviewContext {
  dateId: string;
  dateTitle: string;
  dateYmd: string | null;
  placeLabel: string | null;
  placeCategoryLabel: string | null;
  cover: CoverImage | null;
  status: DateStatus;
  reviewable: boolean;
  stage: ReviewStage;
  editable: boolean;
  hasPartner: boolean;
  partnerName: string;
  partnerSubmitted: boolean;
  categories: { id: string; label: string; description: string | null }[];
  myReview: MyReviewView | null;
}

function toMyReviewView(row: ReviewRow): MyReviewView {
  return {
    submitted: row.submittedAt != null,
    overallRating: row.overallRating,
    suggestedOverall: row.suggestedOverall,
    personalRevisit: row.personalRevisit,
    personalRevisitNote: row.personalRevisitNote,
    lovedText: row.lovedText,
    betterText: row.betterText,
    rememberText: row.rememberText,
    unexpectedText: row.unexpectedText,
    scores: Object.fromEntries(row.ratings.map((r) => [r.categoryId, r.score])),
  };
}

/** Everything the review page needs — the date's context, the categories, and my own draft. */
export async function getReviewContext(dateId: string, userId: string): Promise<ReviewContext> {
  const { context, resource } = await authorizeDate(dateId);

  const [date, categories, reviews, memberCount, partner] = await Promise.all([
    prisma.date.findUniqueOrThrow({
      where: { id: resource.id },
      select: {
        title: true,
        status: true,
        scheduledFor: true,
        actualStartAt: true,
        actualLocationText: true,
        plannedPlace: { select: { name: true, city: true, category: true } },
        actualPlace: { select: { name: true, city: true, category: true } },
        bestPhoto: { select: PHOTO_SELECT },
        memory: { select: { coverPhoto: { select: PHOTO_SELECT } } },
        photos: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: PHOTO_SELECT,
        },
      },
    }),
    prisma.reviewCategory.findMany({
      where: { coupleId: context.couple.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, description: true },
    }),
    prisma.dateReview.findMany({ where: { dateId: resource.id }, select: REVIEW_SELECT }),
    prisma.coupleMember.count({ where: { coupleId: context.couple.id, status: "ACTIVE" } }),
    prisma.coupleMember.findFirst({
      where: { coupleId: context.couple.id, status: "ACTIVE", userId: { not: userId } },
      select: { user: { select: { name: true, nickname: true } } },
    }),
  ]);

  const mine = reviews.find((r) => r.authorId === userId) ?? null;
  const partnerRow = reviews.find((r) => r.authorId !== userId) ?? null;
  const hasPartner = memberCount >= 2;

  const stage = reviewStage({
    mineExists: mine != null,
    mineSubmitted: mine?.submittedAt != null,
    partnerSubmitted: partnerRow?.submittedAt != null,
    hasPartner,
  });

  const place = date.actualPlace ?? date.plannedPlace;

  return {
    dateId: resource.id,
    dateTitle: date.title,
    dateYmd: (date.actualStartAt ?? date.scheduledFor)?.toISOString().slice(0, 10) ?? null,
    placeLabel:
      place?.name ??
      date.actualLocationText ??
      (place?.city ? place.city : null),
    placeCategoryLabel: place ? PLACE_CATEGORY_LABEL[place.category] : null,
    cover: resolveDateCover({
      bestPhoto: date.bestPhoto,
      memoryCoverPhoto: date.memory?.coverPhoto ?? null,
      firstPhoto: date.photos[0] ?? null,
    }),
    status: date.status,
    reviewable: REVIEWABLE_STATUSES.includes(date.status),
    stage,
    editable: isReviewEditable(stage),
    hasPartner,
    partnerName: partner?.user.nickname || partner?.user.name || "your partner",
    partnerSubmitted: partnerRow?.submittedAt != null,
    categories,
    myReview: mine ? toMyReviewView(mine) : null,
  };
}

// ---------------------------------------------------------------------------

interface WriteResult {
  submitted: boolean;
  revealed: boolean;
}

async function writeReview(
  dateId: string,
  input: ReviewDraftInput | ReviewSubmitInput,
  categoryScores: Record<string, number>,
  opts: { submit: boolean },
): Promise<WriteResult> {
  const { context, resource } = await authorizeDate(dateId);
  if (!REVIEWABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Reviews open once the date has happened.");
  }

  const [mine, partner, memberCount, categoryIds] = await Promise.all([
    prisma.dateReview.findUnique({
      where: { dateId_authorId: { dateId: resource.id, authorId: context.user.id } },
      select: { id: true, submittedAt: true },
    }),
    prisma.dateReview.findFirst({
      where: { dateId: resource.id, authorId: { not: context.user.id } },
      select: { submittedAt: true },
    }),
    prisma.coupleMember.count({ where: { coupleId: context.couple.id, status: "ACTIVE" } }),
    prisma.reviewCategory
      .findMany({ where: { coupleId: context.couple.id }, select: { id: true } })
      .then((rows) => new Set(rows.map((r) => r.id))),
  ]);

  const hasPartner = memberCount >= 2;
  const alreadyRevealed =
    mine?.submittedAt != null && (partner?.submittedAt != null || !hasPartner);
  if (alreadyRevealed) {
    throw new ConflictError("Both sides are in — this review is locked now.");
  }

  const scores = Object.entries(categoryScores).filter(
    ([id, score]) => categoryIds.has(id) && score >= SCORE_MIN && score <= SCORE_MAX,
  );
  const suggested = suggestedOverall(scores.map(([, score]) => score));

  const submittedAt = opts.submit ? (mine?.submittedAt ?? new Date()) : (mine?.submittedAt ?? null);
  const isNew = mine == null;

  const data = {
    overallRating: input.overallRating ?? null,
    suggestedOverall: suggested,
    personalRevisit: input.personalRevisit ?? null,
    personalRevisitNote: input.personalRevisitNote ?? null,
    lovedText: input.lovedText ?? null,
    betterText: input.betterText ?? null,
    rememberText: input.rememberText ?? null,
    unexpectedText: input.unexpectedText ?? null,
    submittedAt,
  };

  await prisma.$transaction(async (tx) => {
    const review = await tx.dateReview.upsert({
      where: { dateId_authorId: { dateId: resource.id, authorId: context.user.id } },
      create: { dateId: resource.id, authorId: context.user.id, ...data },
      update: data,
    });
    await tx.dateReviewRating.deleteMany({ where: { reviewId: review.id } });
    if (scores.length > 0) {
      await tx.dateReviewRating.createMany({
        data: scores.map(([categoryId, score]) => ({ reviewId: review.id, categoryId, score })),
      });
    }
  });

  const nowRevealed =
    opts.submit && (partner?.submittedAt != null || !hasPartner);

  if (opts.submit) {
    await logDateEvent(
      resource.id,
      context.user.id,
      "REVIEW_WRITTEN",
      isNew ? "submitted their side of the review" : "updated their submitted review",
    );
    if (nowRevealed) {
      await notifyCouple({
        coupleId: context.couple.id,
        actorId: context.user.id,
        type: NotificationType.REVIEW_ADDED,
        title: "The reviews are in",
        body: "You've both submitted — see how you compared.",
        entityType: "Date",
        entityId: resource.id,
      });
    } else {
      await notifyPartner({
        coupleId: context.couple.id,
        actorId: context.user.id,
        type: NotificationType.REVIEW_ADDED,
        title: "Your partner saved their side",
        body: "They're waiting on your review of this date.",
        entityType: "Date",
        entityId: resource.id,
      });
    }
    await ensureReviewReminders(resource.id);
  }

  return { submitted: submittedAt != null, revealed: nowRevealed };
}

export function saveReviewDraft(
  dateId: string,
  input: ReviewDraftInput,
  categoryScores: Record<string, number>,
): Promise<WriteResult> {
  return writeReview(dateId, input, categoryScores, { submit: false });
}

export function submitReview(
  dateId: string,
  input: ReviewSubmitInput,
  categoryScores: Record<string, number>,
): Promise<WriteResult> {
  return writeReview(dateId, input, categoryScores, { submit: true });
}

/** Re-open a submitted-but-not-yet-revealed review for editing. */
export async function reopenReview(dateId: string) {
  const { context, resource } = await authorizeDate(dateId);
  const [mine, partner, memberCount] = await Promise.all([
    prisma.dateReview.findUnique({
      where: { dateId_authorId: { dateId: resource.id, authorId: context.user.id } },
      select: { id: true, submittedAt: true },
    }),
    prisma.dateReview.findFirst({
      where: { dateId: resource.id, authorId: { not: context.user.id } },
      select: { submittedAt: true },
    }),
    prisma.coupleMember.count({ where: { coupleId: context.couple.id, status: "ACTIVE" } }),
  ]);

  if (!mine?.submittedAt) throw new NotFoundError("There's nothing submitted to re-open.");
  const hasPartner = memberCount >= 2;
  if (partner?.submittedAt != null || !hasPartner) {
    throw new ConflictError("Both sides are in — this review is locked now.");
  }

  await prisma.dateReview.update({ where: { id: mine.id }, data: { submittedAt: null } });
  await ensureReviewReminders(resource.id);
}

export async function deleteReview(dateId: string) {
  const { context, resource } = await authorizeDate(dateId);
  const [mine, partner, memberCount] = await Promise.all([
    prisma.dateReview.findUnique({
      where: { dateId_authorId: { dateId: resource.id, authorId: context.user.id } },
      select: { id: true, submittedAt: true },
    }),
    prisma.dateReview.findFirst({
      where: { dateId: resource.id, authorId: { not: context.user.id } },
      select: { submittedAt: true },
    }),
    prisma.coupleMember.count({ where: { coupleId: context.couple.id, status: "ACTIVE" } }),
  ]);
  if (!mine) throw new NotFoundError("You don't have a review on this date.");
  const hasPartner = memberCount >= 2;
  if (mine.submittedAt != null && (partner?.submittedAt != null || !hasPartner)) {
    throw new ConflictError("Both sides are in — this review can't be withdrawn now.");
  }
  await prisma.dateReview.delete({ where: { id: mine.id } });
  await ensureReviewReminders(resource.id);
}
