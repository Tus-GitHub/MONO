import "server-only";

import { DateStatus } from "@prisma/client";

import { authorizeDate } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import type { RevisitDecisionInput } from "@/lib/validation/date";
import { logDateEvent } from "@/server/services/date-event-service";

const DECIDABLE_STATUSES: DateStatus[] = [DateStatus.IN_PROGRESS, DateStatus.COMPLETED];

const VERB: Record<RevisitDecisionInput["choice"], string> = {
  YES: "wants to do this again",
  MAYBE: "might do this again",
  NO: "is done with this one",
};

/** The couple's single shared "would we do this again?" call. Overwritable at any time. */
export async function saveRevisit(dateId: string, input: RevisitDecisionInput) {
  const { context, resource } = await authorizeDate(dateId);
  if (!DECIDABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Decide this once the date has happened.");
  }

  await prisma.revisitDecision.upsert({
    where: { dateId: resource.id },
    create: {
      dateId: resource.id,
      decidedById: context.user.id,
      choice: input.choice,
      reason: input.reason ?? null,
      targetTimeframe: input.targetTimeframe ?? null,
    },
    update: {
      decidedById: context.user.id,
      choice: input.choice,
      reason: input.reason ?? null,
      targetTimeframe: input.targetTimeframe ?? null,
    },
  });

  await logDateEvent(resource.id, context.user.id, "REVISIT_DECIDED", VERB[input.choice]);
}
