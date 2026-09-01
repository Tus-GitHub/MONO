export const PLAN_STEPS = ["basics", "budget", "activities", "review"] as const;

export type PlanStep = (typeof PLAN_STEPS)[number];

export const PLAN_STEP_META: Record<PlanStep, { index: number; label: string }> = {
  basics: { index: 1, label: "The basics" },
  budget: { index: 2, label: "Budget" },
  activities: { index: 3, label: "Activities" },
  review: { index: 4, label: "Review" },
};

export function isPlanStep(value: string | undefined): value is PlanStep {
  return (PLAN_STEPS as readonly string[]).includes(value ?? "");
}

export function planStepHref(dateId: string, step: PlanStep): string {
  return `/plan/${dateId}?step=${step}`;
}

/** Where a "goto" target from a step form should land. */
export function planGotoHref(dateId: string, goto: string): string {
  if (goto === "exit") return "/plan";
  if (isPlanStep(goto)) return planStepHref(dateId, goto);
  return planStepHref(dateId, "basics");
}
