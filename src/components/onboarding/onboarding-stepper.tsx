import { Icon } from "@/components/ui/icon";
import {
  ONBOARDING_STEP_META,
  type OnboardingStep,
} from "@/server/services/onboarding-service";
import { cn } from "@/lib/utils/cn";

const STEPS = ["profile", "connect", "couple"] as const;

/** Three-dot progress for the onboarding flow. */
export function OnboardingStepper({ current }: { current: OnboardingStep }) {
  const currentIndex =
    current === "ready" ? STEPS.length : STEPS.indexOf(current as (typeof STEPS)[number]);

  return (
    <ol className="mb-8 flex items-center gap-2">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-2xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-fg",
                active && "border-primary text-primary",
                !done && !active && "border-line text-faint",
              )}
            >
              {done ? <Icon name="check" size={14} /> : ONBOARDING_STEP_META[step].index}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                active ? "text-ink" : "text-muted",
              )}
            >
              {ONBOARDING_STEP_META[step].label}
            </span>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  index < currentIndex ? "bg-primary" : "bg-line",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
