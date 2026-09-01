import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

/** External / public rating — deliberately neutral and clearly labelled "public". */
export function PublicRating({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count?: number | null;
  className?: string;
}) {
  if (rating == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-line/60 px-1.5 py-0.5 text-2xs font-medium text-muted",
        className,
      )}
      title="Public rating"
    >
      <Icon name="star" size={11} />
      {rating.toFixed(1)}
      {count ? <span className="text-faint">({count > 999 ? `${Math.round(count / 1000)}k` : count})</span> : null}
      <span className="text-faint">· public</span>
    </span>
  );
}

/** The couple's private MONO score — warm, distinct, always labelled "together". */
export function CoupleScore({
  score10,
  className,
}: {
  score10: number | null;
  className?: string;
}) {
  if (score10 == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-primary-tint px-1.5 py-0.5 text-2xs font-semibold text-primary",
        className,
      )}
      title="Your private MONO score"
    >
      <Icon name="heart" size={11} />
      {score10.toFixed(1)}/10 · together
    </span>
  );
}
