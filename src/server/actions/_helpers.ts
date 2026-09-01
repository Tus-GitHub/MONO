import "server-only";

import { ZodError } from "zod";

import { AppError, ValidationError } from "@/lib/errors";
import { errorState, type ActionState } from "@/lib/utils/result";
import { toFieldErrors } from "@/lib/validation/common";

/**
 * Shared helpers for server actions. This file has no `"use server"` directive on purpose —
 * only the action modules themselves are Server Function boundaries.
 */

/** Translate any thrown value into an `ActionState` the forms can render. */
export function toActionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return errorState("Some fields need attention.", toFieldErrors(error));
  }
  if (error instanceof ValidationError) {
    return errorState(error.message, error.fieldErrors);
  }
  if (error instanceof AppError) {
    return errorState(error.message);
  }
  console.error("[action] unhandled error:", error);
  return errorState("Something went wrong. Please try again.");
}

/** Collect string fields from a FormData into a plain object for zod parsing. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
