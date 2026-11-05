import "server-only";

import { DateStatus, NotificationType } from "@prisma/client";

import { authorizeExpense, type CoupleContext } from "@/lib/authz";
import { resolvePayer } from "@/lib/date/expense-split";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { dateTimeInTimeZone, localDateTimeToUtc } from "@/lib/utils/timezone";
import type { DateExpenseInput } from "@/lib/validation/date";
import { notifyPartner } from "@/server/services/notification-service";
import { withDateWrite } from "@/server/services/date-write";

const SPENDABLE_STATUSES: DateStatus[] = [
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

/** Translate the form's viewer-relative input into stored columns. */
function resolveExpense(context: CoupleContext, input: DateExpenseInput, previousTime?: Date) {
  if (input.spentAt && input.spentAtLocal) throw new ValidationError("Provide either an instant or a local time, not both.");
  const { paidBy, ownerShareCents } = resolvePayer({
    choice: input.payer,
    myRole: context.membership.role,
    amountCents: input.amount,
    mySharePct: input.mySharePct,
  });
  let spentAt = input.spentAt ?? previousTime ?? new Date();
  if (input.spentAtLocal) {
    try {
      // Leaving the visible minute unchanged must retain the stored seconds and milliseconds.
      spentAt = previousTime && dateTimeInTimeZone(previousTime, context.couple.timezone) === input.spentAtLocal
        ? previousTime : localDateTimeToUtc(input.spentAtLocal, context.couple.timezone);
    } catch {
      throw new ValidationError("That time does not exist in your space's timezone. Choose another time.", {
        spentAtLocal: ["Choose a valid local time."],
      });
    }
  }
  return {
    description: input.description,
    amountCents: input.amount,
    category: input.category,
    note: input.note ?? null,
    spentAt,
    paidBy,
    ownerShareCents,
  };
}

/** Add a spend line to a date — the quick action during the date, and edits after. */
export async function addDateExpense(dateId: string, input: DateExpenseInput): Promise<string> {
  const { context, resource, expense } = await withDateWrite(dateId, async (tx, resource, context) => {
    if (!SPENDABLE_STATUSES.includes(resource.status)) {
      throw new ValidationError("Track spending once the date is under way.");
    }

    if (input.currency && input.currency !== resource.currency) {
      throw new ValidationError(`Record this date's spending in ${resource.currency}. Use a separate date for another currency.`);
    }
    const expense = await tx.expense.create({
      data: {
        coupleId: context.couple.id,
        dateId: resource.id,
        recordedById: context.user.id,
        currency: resource.currency,
        ...resolveExpense(context, input),
      },
    });
    return { context, resource, expense };
  });

  await notifyPartner({
    coupleId: context.couple.id,
    actorId: context.user.id,
    type: NotificationType.EXPENSE_ADDED,
    title: "New spend on a date",
    body: input.description,
    entityType: "Date",
    entityId: resource.id,
  });

  return expense.id;
}

/** Correct any part of a spend line — description, amount, category, payer, split, note, time. */
export async function updateDateExpense(expenseId: string, input: DateExpenseInput): Promise<void> {
  const { context, resource } = await authorizeExpense(expenseId);
  if (resource.dateId) {
    await withDateWrite(resource.dateId, async (tx, date, currentContext) => {
      if (input.currency && input.currency !== date.currency) throw new ValidationError(`Record this date's spending in ${date.currency}.`);
      const current = await tx.expense.findFirst({
        where: { id: resource.id, coupleId: currentContext.couple.id, deletedAt: null },
        select: { spentAt: true },
      });
      if (!current) throw new NotFoundError();
      const updated = await tx.expense.updateMany({
        where: { id: resource.id, coupleId: currentContext.couple.id, deletedAt: null },
        data: { currency: date.currency, ...resolveExpense(currentContext, input, current.spentAt) },
      });
      if (!updated.count) throw new NotFoundError();
    });
    return;
  }
  await prisma.expense.update({
    where: { id: resource.id },
    data: {
      currency: input.currency ?? resource.currency,
      ...resolveExpense(context, input, resource.spentAt),
    },
  });
}

export async function deleteDateExpense(expenseId: string): Promise<void> {
  const { resource } = await authorizeExpense(expenseId);
  await prisma.expense.update({
    where: { id: resource.id },
    data: { deletedAt: new Date() },
  });
}
