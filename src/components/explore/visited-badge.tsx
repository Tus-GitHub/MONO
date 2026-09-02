import { cn } from "@/lib/utils/cn";
import { VISITED_LABEL, VISITED_TONE, type VisitedStatus } from "@/lib/explore/visited";

/** Tells the couple where they already stand with a place. Nothing shown for a brand-new one. */
export function VisitedBadge({
  status,
  className,
}: {
  status: VisitedStatus;
  className?: string;
}) {
  if (status === "new") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium",
        VISITED_TONE[status],
        className,
      )}
    >
      {VISITED_LABEL[status]}
    </span>
  );
}
