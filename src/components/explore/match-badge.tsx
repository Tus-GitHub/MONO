import { cn } from "@/lib/utils/cn";
import type { CoupleMatch, MatchBand } from "@/lib/explore/compatibility";

const TONE: Record<MatchBand, string> = {
  high: "bg-success-tint text-success",
  medium: "bg-primary-tint text-primary",
  low: "bg-surface text-muted border border-line",
  unknown: "bg-surface text-faint border border-line",
};

/** The private "92% match" pill. Shows "New" when there isn't enough history to score. */
export function MatchBadge({ match, className }: { match: CoupleMatch; className?: string }) {
  return (
    <span
      title={match.reason}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold tabular-nums",
        TONE[match.band],
        className,
      )}
    >
      {match.percent != null ? `${match.percent}% match` : "New territory"}
    </span>
  );
}

/** The one-line explanation that sits under a recommendation. */
export function MatchReason({ match }: { match: CoupleMatch }) {
  return <p className="text-xs text-muted">{match.reason}</p>;
}
