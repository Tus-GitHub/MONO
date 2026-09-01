import "server-only";

import type { Couple, CoupleMember } from "@prisma/client";
import { CoupleMemberStatus, CoupleStatus } from "@prisma/client";

import { requireUser, type SessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import {
  AuthorizationError,
  CoupleRequiredError,
  NotFoundError,
} from "@/lib/errors";

/**
 * MONO's authorization layer.
 *
 * Rule: every protected server operation resolves the couple from the authenticated session
 * and verifies membership here. It never trusts a client-supplied couple id, user id, URL
 * parameter, or hidden field. When an id *does* arrive from the client (e.g. a route param),
 * pass it to `requireCoupleMembership` / `authorize*` — those verify it against the session
 * before any data is returned.
 */
export interface CoupleContext {
  user: SessionUser;
  couple: Couple;
  membership: CoupleMember;
}

const ACTIVE_COUPLE_STATUSES = [CoupleStatus.PENDING, CoupleStatus.ACTIVE];

/** The caller's couple context, or `null` if they have not joined/created a couple yet. */
export async function getCoupleContext(): Promise<CoupleContext | null> {
  const user = await requireUser();

  const membership = await prisma.coupleMember.findFirst({
    where: {
      userId: user.id,
      status: CoupleMemberStatus.ACTIVE,
      couple: { deletedAt: null, status: { in: ACTIVE_COUPLE_STATUSES } },
    },
    include: { couple: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;

  const { couple, ...rest } = membership;
  return { user, couple, membership: rest };
}

/** Like `getCoupleContext` but throws `CoupleRequiredError` when there is no couple. */
export async function requireCoupleContext(): Promise<CoupleContext> {
  const context = await getCoupleContext();
  if (!context) throw new CoupleRequiredError();
  return context;
}

/**
 * Verify that the session user is an active member of `coupleId`. Use this whenever a couple
 * id comes from the client (route param, form field, query string).
 */
export async function requireCoupleMembership(coupleId: string): Promise<CoupleContext> {
  const context = await requireCoupleContext();
  if (context.couple.id !== coupleId) {
    // Do not confirm or deny that the other couple exists.
    throw new AuthorizationError();
  }
  return context;
}

/**
 * Load a couple-scoped resource and confirm it belongs to the caller's couple in one step.
 * A missing or foreign resource is reported as `NotFoundError` so existence never leaks.
 */
async function authorizeResource<T>(
  loader: (coupleId: string) => Promise<T | null>,
): Promise<{ context: CoupleContext; resource: T }> {
  const context = await requireCoupleContext();
  const resource = await loader(context.couple.id);
  if (!resource) throw new NotFoundError();
  return { context, resource };
}

export function authorizeDate(dateId: string) {
  return authorizeResource((coupleId) =>
    prisma.date.findFirst({ where: { id: dateId, coupleId, deletedAt: null } }),
  );
}

export function authorizePlace(placeId: string) {
  return authorizeResource((coupleId) =>
    prisma.place.findFirst({ where: { id: placeId, coupleId, deletedAt: null } }),
  );
}

export function authorizeExpense(expenseId: string) {
  return authorizeResource((coupleId) =>
    prisma.expense.findFirst({ where: { id: expenseId, coupleId, deletedAt: null } }),
  );
}

export function authorizeMemory(memoryId: string) {
  return authorizeResource((coupleId) =>
    prisma.memory.findFirst({ where: { id: memoryId, coupleId, deletedAt: null } }),
  );
}

export function authorizeReviewCategory(categoryId: string) {
  return authorizeResource((coupleId) =>
    prisma.reviewCategory.findFirst({ where: { id: categoryId, coupleId } }),
  );
}

/** Photos hang off a Date; authorize by walking to the owning couple. */
export function authorizePhoto(photoId: string) {
  return authorizeResource((coupleId) =>
    prisma.datePhoto.findFirst({
      where: { id: photoId, deletedAt: null, date: { coupleId, deletedAt: null } },
      include: { date: { select: { id: true, coupleId: true } } },
    }),
  );
}

/** Reviews hang off a Date. */
export function authorizeReview(reviewId: string) {
  return authorizeResource((coupleId) =>
    prisma.dateReview.findFirst({
      where: { id: reviewId, date: { coupleId, deletedAt: null } },
      include: { date: { select: { id: true, coupleId: true } } },
    }),
  );
}
