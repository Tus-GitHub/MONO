import "server-only";

import type { Date as DateRecord, Prisma } from "@prisma/client";
import { requireCoupleContext, type CoupleContext } from "@/lib/authz";
import { isPlanningStatus } from "@/lib/date/lifecycle";
import { serializable } from "@/lib/db/serializable";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export function assertPlanEditable(date: Pick<DateRecord, "status">): void {
  if (!isPlanningStatus(date.status)) throw new ValidationError("This date can no longer be planned.");
}

/** Serialize related writes on the date, then recheck ownership and current state inside the transaction. */
export async function withDateWrite<T>(
  dateId: string,
  work: (tx: Prisma.TransactionClient, date: DateRecord, context: CoupleContext) => Promise<T>,
  expectedVersion?: number,
): Promise<T> {
  const context = await requireCoupleContext();
  return serializable(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM dates
      WHERE id = ${dateId} AND "coupleId" = ${context.couple.id} AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    if (locked.length === 0) throw new NotFoundError();
    const date = await tx.date.findFirst({
      where: {
        id: dateId, coupleId: context.couple.id, deletedAt: null,
        couple: {
          deletedAt: null, status: { in: ["PENDING", "ACTIVE"] },
          members: { some: { userId: context.user.id, status: "ACTIVE", user: { deletedAt: null } } },
        },
      },
    });
    if (!date) throw new NotFoundError();
    if (expectedVersion != null && date.version !== expectedVersion) {
      throw new ConflictError("This plan changed while you were editing. Reload it to see the latest changes; your device draft is kept.");
    }
    const result = await work(tx, date, context);
    await tx.date.update({ where: { id: date.id }, data: { version: { increment: 1 } } });
    return result;
  });
}
