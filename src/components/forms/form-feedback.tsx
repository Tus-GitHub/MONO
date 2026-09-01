import { Alert } from "@/components/ui/alert";
import type { ActionState } from "@/lib/utils/result";

/** Renders the top-level message from an ActionState (plus any non-field `_form` errors). */
export function FormFeedback({ state }: { state: ActionState<unknown> }) {
  if (state.status === "idle") return null;

  if (state.status === "success") {
    return state.message ? <Alert tone="success">{state.message}</Alert> : null;
  }

  const formErrors = state.fieldErrors?._form ?? [];
  return (
    <Alert tone="error">
      <p>{state.message}</p>
      {formErrors.length ? (
        <ul className="mt-1 list-disc pl-4">
          {formErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}
