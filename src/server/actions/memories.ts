"use server";

import { revalidatePath } from "next/cache";

import { successState, type ActionState } from "@/lib/utils/result";
import { idSchema } from "@/lib/validation/common";
import { toggleMemoryFavorite } from "@/server/services/memory-service";
import { toActionError } from "@/server/actions/_helpers";

/** Heart / un-heart a memory. Returns `{ favorite }` so the button can reflect the new state. */
export async function toggleMemoryFavoriteAction(
  _prev: ActionState<{ favorite: boolean }>,
  formData: FormData,
): Promise<ActionState<{ favorite: boolean }>> {
  const memoryId = idSchema.parse(formData.get("memoryId"));
  let favorite: boolean;
  try {
    favorite = await toggleMemoryFavorite(memoryId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/memories", "layout");
  revalidatePath("/", "layout");
  return successState({ favorite }, favorite ? "Added to favourites." : "Removed from favourites.");
}
