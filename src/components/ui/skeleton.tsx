import { cn } from "@/lib/utils/cn";

/** Shimmering placeholder. Shimmer stops under `prefers-reduced-motion` (global CSS). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface p-5", className)}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText className="mt-4" lines={3} />
    </div>
  );
}

export function SkeletonImageGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
      ))}
    </div>
  );
}
