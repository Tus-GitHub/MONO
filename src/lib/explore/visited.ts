import type { RevisitChoice } from "@prisma/client";

/**
 * How the couple already stands with a place. Pure classification from aggregate history —
 * used by the Explore home and the search grid so both label a place the same way.
 */
export type VisitedStatus = "new" | "visited" | "revisit" | "loved" | "avoid";

export function classifyVisited(input: {
  visitCount: number;
  coupleScore10: number | null;
  lastRevisit: RevisitChoice | null;
  notForUs: boolean;
}): VisitedStatus {
  // "Never again" (or explicit Not-for-us feedback) always wins.
  if (input.notForUs || input.lastRevisit === "NO") return "avoid";
  if (input.visitCount === 0) return "new";
  if (input.lastRevisit === "YES" || (input.coupleScore10 != null && input.coupleScore10 >= 8)) {
    return "loved";
  }
  if (input.lastRevisit === "MAYBE" || (input.coupleScore10 != null && input.coupleScore10 >= 6)) {
    return "revisit";
  }
  return "visited";
}

export const VISITED_LABEL: Record<VisitedStatus, string> = {
  new: "Not visited",
  visited: "Been here",
  revisit: "Maybe revisit",
  loved: "You loved this",
  avoid: "You said never again",
};

/** Token-based chip classes — no raw colours. */
export const VISITED_TONE: Record<VisitedStatus, string> = {
  new: "bg-surface text-muted border border-line",
  visited: "bg-surface text-muted border border-line",
  revisit: "bg-warning-tint text-warning",
  loved: "bg-success-tint text-success",
  avoid: "bg-error-tint text-error",
};

/** A place the couple explicitly ruled out is only shown when they searched for it directly. */
export function isSuppressed(status: VisitedStatus): boolean {
  return status === "avoid";
}
