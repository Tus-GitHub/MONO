import type { RevisitChoice } from "@prisma/client";

import { Icon } from "@/components/ui/icon";
import { REVISIT_CHOICE_META } from "@/lib/date/revisit-choice";
import { scoreTone } from "@/lib/review/scale";
import { cn } from "@/lib/utils/cn";

const SCORE_TONE = {
  high: "bg-success-tint text-success",
  mid: "bg-rating/15 text-rating",
  low: "bg-warning-tint text-warning",
} as const;

/** The combined couple score, or nothing when the review hasn't revealed. */
export function ScorePill({
  score,
  size = "sm",
  className,
}: {
  score: number | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  if (score == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 rounded-full font-semibold tabular-nums",
        size === "lg" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs",
        SCORE_TONE[scoreTone(score)],
        className,
      )}
    >
      {score.toFixed(1)}
      <span className="text-2xs font-normal opacity-70">/10</span>
    </span>
  );
}

export function RevisitTag({
  revisit,
  className,
}: {
  revisit: RevisitChoice | null;
  className?: string;
}) {
  if (!revisit) return null;
  const meta = REVISIT_CHOICE_META[revisit];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
        meta.className,
        className,
      )}
    >
      <Icon name="refresh" size={11} />
      {meta.short}
    </span>
  );
}
