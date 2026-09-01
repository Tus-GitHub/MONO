import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PLAN_STEPS, PLAN_STEP_META, planStepHref, type PlanStep } from "@/lib/date/plan-steps";
import { cn } from "@/lib/utils/cn";

interface PlanStepperProps {
  dateId: string;
  current: PlanStep;
  /** "buttons" renders submit buttons (name="goto") for use inside a step form. */
  variant?: "links" | "buttons";
}

export function PlanStepper({ dateId, current, variant = "links" }: PlanStepperProps) {
  const currentIndex = PLAN_STEPS.indexOf(current);

  return (
    <ol className="mb-6 flex items-center gap-1.5">
      {PLAN_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = step === current;
        const dot = (
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full border text-2xs font-semibold transition-colors",
              done && "border-primary bg-primary text-primary-fg",
              active && "border-primary text-primary",
              !done && !active && "border-line text-faint",
            )}
          >
            {done ? <Icon name="check" size={13} /> : PLAN_STEP_META[step].index}
          </span>
        );
        const label = (
          <span className={cn("hidden text-xs font-medium sm:inline", active ? "text-ink" : "text-muted")}>
            {PLAN_STEP_META[step].label}
          </span>
        );

        return (
          <li key={step} className="flex flex-1 items-center gap-1.5">
            {variant === "buttons" ? (
              <button
                type="submit"
                name="goto"
                value={step}
                className="flex items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {dot}
                {label}
              </button>
            ) : (
              <Link
                href={planStepHref(dateId, step)}
                className="flex items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {dot}
                {label}
              </Link>
            )}
            {index < PLAN_STEPS.length - 1 ? (
              <span className={cn("h-px flex-1", done ? "bg-primary" : "bg-line")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
