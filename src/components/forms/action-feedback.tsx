import type { ActionState } from "@/lib/utils/result";

export function ActionFeedback({ state }: { state: ActionState }) {
  return state.status !== "idle" ? <div role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-error" : "text-sm text-muted"}>
    <p>{state.message}</p>
    {state.status === "error" && state.fieldErrors ? Object.entries(state.fieldErrors).map(([key, messages]) => <p key={key}>{messages.join(" ")}</p>) : null}
  </div> : null;
}
