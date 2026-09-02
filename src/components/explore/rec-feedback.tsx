"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecommendationSignal } from "@prisma/client";

import { Icon } from "@/components/ui/icon";
import { idleState, type ActionState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import { recommendationFeedbackAction } from "@/server/actions/explore";

type Data = { signal: RecommendationSignal | null };
type Choice = "INTERESTED" | "NOT_FOR_US" | "SAVED";

const META: Record<Choice, { label: string; icon: "heart" | "x" | "star" }> = {
  INTERESTED: { label: "Interested", icon: "heart" },
  NOT_FOR_US: { label: "Not for us", icon: "x" },
  SAVED: { label: "Save", icon: "star" },
};

/**
 * Lightweight recommendation feedback. Optimistic; reconciles with the server result. Toggling
 * the active choice clears it. Persisted feedback re-weights the deterministic ranking.
 */
export function RecFeedback({
  targetType,
  targetKey,
  initial,
  choices = ["INTERESTED", "NOT_FOR_US"],
  className,
}: {
  targetType: "PLACE" | "IDEA";
  targetKey: string;
  initial: RecommendationSignal | null;
  choices?: Choice[];
  className?: string;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<ActionState<Data>, FormData>(
    recommendationFeedbackAction,
    idleState,
  );
  const [current, setCurrent] = useState<RecommendationSignal | null>(initial);
  const [seen, setSeen] = useState<ActionState<Data>>(idleState);

  if (state !== seen) {
    setSeen(state);
    if (state.status === "success" && state.data) {
      setCurrent(state.data.signal);
      router.refresh();
    } else if (state.status === "error") {
      setCurrent(initial);
    }
  }

  const send = (choice: Choice) => {
    const next = current === choice ? null : choice;
    setCurrent(next as RecommendationSignal | null);
    const fd = new FormData();
    fd.set("targetType", targetType);
    fd.set("targetKey", targetKey);
    fd.set("signal", next ?? "clear");
    startTransition(() => dispatch(fd));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {choices.map((choice) => {
        const active = current === choice;
        return (
          <button
            key={choice}
            type="button"
            aria-pressed={active}
            onClick={() => send(choice)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
              active
                ? choice === "NOT_FOR_US"
                  ? "border-error/40 bg-error-tint text-error"
                  : "border-primary/40 bg-primary-tint text-primary"
                : "border-line text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            <Icon name={META[choice].icon} size={12} />
            {META[choice].label}
          </button>
        );
      })}
    </div>
  );
}
