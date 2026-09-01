import "server-only";

import { DateStatus, NotificationType } from "@prisma/client";

import { authorizeDate, authorizeExpense, type CoupleContext } from "@/lib/authz";
import { resolvePayer } from "@/lib/date/expense-split";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import type { DateExpenseInput } from "@/lib/validation/date";
import { notifyPartner } from "@/server/services/notification-service";

const SPENDABLE_STATUSES: DateStatus[] = [
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

/** Translate the form's viewer-relative input into stored columns. */
function resolveExpense(context: CoupleContext, input: DateExpenseInput) {
  const { paidBy, ownerShareCents } = resolvePayer({
    choice: input.payer,
    myRole: context.membership.role,
    amountCents: input.amount,
    mySharePct: input.mySharePct,
  });
  return {
    description: input.description,
    amountCents: input.amount,
    category: input.category,
    note: input.note ?? null,
    spentAt: input.spentAt ?? new Date(),
    paidBy,
    ownerShareCents,
  };
}

/** Add a spend line to a date — the quick action during the date, and edits after. */
export async function addDateExpense(dateId: string, input: DateExpenseInput): Promise<string> {
  const { context, resource } = await authorizeDate(dateId);
  if (!SPENDABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Track spending once the date is under way.");
  }

  const expense = await prisma.expense.create({
    data: {
      coupleId: context.couple.id,
      dateId: resource.id,
      recordedById: context.user.id,
      currency: input.currency ?? resource.currency,
      ...resolveExpense(context, input),
    },
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
  await prisma.expense.update({
    where: { id: resource.id },
    data: {
      currency: input.currency ?? resource.currency,
      ...resolveExpense(context, input),
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
