import type { FieldErrors } from "@/lib/errors";

/**
 * The contract between server actions and the forms that call them via React's
 * `useActionState`. Actions never throw across this boundary — they return an `ActionState`.
 */
export type ActionState<Data = undefined> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: Data }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export const idleState: ActionState = { status: "idle" };

export function successState<Data>(data?: Data, message?: string): ActionState<Data> {
  return { status: "success", data, message };
}

export function errorState(message: string, fieldErrors?: FieldErrors): ActionState {
  return { status: "error", message, fieldErrors };
}

/** Plain result type for internal helpers that prefer values over exceptions. */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
