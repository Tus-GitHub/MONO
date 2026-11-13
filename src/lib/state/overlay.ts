export type OverlayPhase = "unmounted" | "entering" | "open" | "exiting";
export type OverlayEvent = "show" | "entered" | "hide" | "exited";
export function overlayTransition(phase: OverlayPhase, event: OverlayEvent): OverlayPhase {
  if (event === "show") return phase === "open" ? "open" : "entering";
  if (event === "hide") return phase === "unmounted" ? "unmounted" : "exiting";
  if (event === "entered") return phase === "entering" ? "open" : phase;
  return phase === "exiting" ? "unmounted" : phase;
}

export function overlayHistoryAction(stack: readonly string[], entryId: string, sameUrl: boolean, traversalRequested: boolean): "complete" | "back" | "wait" {
  if (!sameUrl || !stack.includes(entryId)) return "complete";
  return stack.at(-1) === entryId && !traversalRequested ? "back" : "wait";
}
