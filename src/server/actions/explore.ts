"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RecommendationSignal, RecommendationTargetType } from "@prisma/client";

import { requireCoupleContext } from "@/lib/authz";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema } from "@/lib/validation/common";
import { setRecommendationFeedback } from "@/server/services/explore-service";
import { toActionError } from "@/server/actions/_helpers";

const schema = z.object({
  targetType: z.enum(["PLACE", "IDEA"]),
  targetKey: z.string().trim().min(1).max(64),
  // "clear" removes any stored feedback
  signal: z.enum(["INTERESTED", "NOT_FOR_US", "SAVED", "clear"]),
});

type FeedbackData = { signal: RecommendationSignal | null };

export async function recommendationFeedbackAction(
  _prev: ActionState<FeedbackData>,
  formData: FormData,
): Promise<ActionState<FeedbackData>> {
  const { user, couple } = await requireCoupleContext();
  const parsed = schema.safeParse({
    targetType: formData.get("targetType"),
    targetKey: formData.get("targetKey"),
    signal: formData.get("signal"),
  });
  if (!parsed.success) return errorState("That feedback didn't stick.");

  const targetType =
    parsed.data.targetType === "PLACE"
      ? RecommendationTargetType.PLACE
      : RecommendationTargetType.IDEA;

  // A place key must look like an id; an idea key is a short slug.
  if (targetType === RecommendationTargetType.PLACE && !idSchema.safeParse(parsed.data.targetKey).success) {
    return errorState("Unknown place.");
  }

  const signal = parsed.data.signal === "clear" ? null : (parsed.data.signal as RecommendationSignal);

  try {
    await setRecommendationFeedback({
      coupleId: couple.id,
      userId: user.id,
      targetType,
      targetKey: parsed.data.targetKey,
      signal,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/explore");
  return successState({ signal }, signal ? "Noted." : "Cleared.");
}
