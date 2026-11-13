export interface DirtyState { revision: number; saved: number; submitted: number | null }
export type DirtyEvent = "edit" | "submit" | "success" | "failure" | "reset";
export function dirtyTransition(state: DirtyState, event: DirtyEvent): DirtyState {
  if (event === "edit") return { ...state, revision: state.revision + 1 };
  if (event === "submit") return { ...state, submitted: state.revision };
  if (event === "success") return { ...state, saved: state.submitted ?? state.saved, submitted: null };
  if (event === "reset") return { ...state, saved: state.revision, submitted: null };
  return { ...state, submitted: null };
}
