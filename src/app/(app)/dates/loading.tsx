import { Skeleton } from "@/components/ui/skeleton";

export default function DatesLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
