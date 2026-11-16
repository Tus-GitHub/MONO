import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

/** External / public rating — deliberately neutral and clearly labelled "public". */
export function PublicRating({
  rating,
  count,
  source,
  className,
}: {
  rating: number | null;
  count?: number | null;
  source?: string | null;
  className?: string;
}) {
  if (rating == null) return null;
  const label = ({ google: "Google", zomato: "Zomato", magicpin: "magicpin", swiggy: "Swiggy", tripadvisor: "Tripadvisor", justdial: "Justdial" } as Record<string, string>)[source ?? ""] ?? "public";
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-md bg-line/60 px-1.5 py-0.5 text-2xs font-medium text-muted",
        className,
      )}
      title={`Public visitor rating${source ? ` · ${label}` : ""}${count ? ` · ${count.toLocaleString("en-IN")} reviews` : ""}`}
    >
      <Icon name="star" size={11} />
      {rating.toFixed(1)}
      {count ? <span className="text-faint">({count.toLocaleString("en-IN")})</span> : null}
      <span className="text-faint">· {label}</span>
    </span>
  );
}

/** The couple's private AMOR score — warm, distinct, always labelled "together". */
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
      title="Your private AMOR score"
    >
      <Icon name="heart" size={11} />
      {score10.toFixed(1)}/10 · together
    </span>
  );
}
