"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema, toFieldErrors } from "@/lib/validation/common";
import { dateExpenseSchema } from "@/lib/validation/date";
import {
  addDateExpense,
  deleteDateExpense,
  updateDateExpense,
} from "@/server/services/expense-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

export async function addDateExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.parse(formData.get("dateId"));
  const parsed = dateExpenseSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the amount and description.", toFieldErrors(parsed.error));
  }
  try {
    await addDateExpense(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`);
  revalidatePath("/", "layout");
  return successState(undefined, "Added.");
}

export async function updateDateExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const expenseId = idSchema.parse(formData.get("expenseId"));
  const parsed = dateExpenseSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the amount and description.", toFieldErrors(parsed.error));
  }
  try {
    await updateDateExpense(expenseId, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${dateId}`);
  revalidatePath("/", "layout");
  return successState(undefined, "Updated.");
}

export async function deleteDateExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const expenseId = idSchema.parse(formData.get("expenseId"));
  try {
    await deleteDateExpense(expenseId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${dateId}`);
  revalidatePath("/", "layout");
  return successState(undefined, "Removed.");
}
