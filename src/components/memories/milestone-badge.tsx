import { Icon } from "@/components/ui/icon";
import type { Milestone } from "@/lib/date/milestones";
import { ordinalLabel } from "@/lib/date/milestones";
import { cn } from "@/lib/utils/cn";

const TONE: Record<Milestone["kind"], string> = {
  "first-date": "bg-accent-tint text-accent",
  "nth-date": "bg-accent-tint text-accent",
  "first-city": "bg-primary-tint text-primary",
  regulars: "bg-primary-tint text-primary",
  anniversary: "bg-accent-tint text-accent",
  "top-score": "bg-rating/15 text-rating",
};

export function MilestoneBadge({ milestone, className }: { milestone: Milestone; className?: string }) {
  return (
    <span
      className={cn(
        "anim-scale-in inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium",
        TONE[milestone.kind],
        className,
      )}
    >
      <Icon name={milestone.icon} size={12} />
      {milestone.label}
    </span>
  );
}

/** The little "Our 10th date" eyebrow. */
export function DateOrdinal({ ordinal, className }: { ordinal: number; className?: string }) {
  if (!ordinal) return null;
  return (
    <span
      className={cn(
        "text-2xs font-semibold uppercase tracking-wide text-faint",
        className,
      )}
    >
      Our {ordinalLabel(ordinal)} date
    </span>
  );
}
