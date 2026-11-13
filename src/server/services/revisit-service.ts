import "server-only";

import { dateAllows } from "@/lib/date/permissions";

import { withDateWrite } from "@/server/services/date-write";
import { ValidationError } from "@/lib/errors";
import type { RevisitDecisionInput } from "@/lib/validation/date";
import { logDateEvent } from "@/server/services/date-event-service";



const VERB: Record<RevisitDecisionInput["choice"], string> = {
  YES: "wants to do this again",
  MAYBE: "might do this again",
  NO: "is done with this one",
};

/** The couple's single shared "would we do this again?" call. Overwritable at any time. */
export async function saveRevisit(dateId: string, input: RevisitDecisionInput) {
  const { context, resource } = await withDateWrite(dateId, async (tx, resource, context) => {
    if (!dateAllows(resource.status, "revisit")) {
      throw new ValidationError("Decide this once the date has happened.");
    }

    await tx.revisitDecision.upsert({
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

    return { context, resource };
  });

  await logDateEvent(resource.id, context.user.id, "REVISIT_DECIDED", VERB[input.choice]);
}
