import { Skeleton } from "@/components/ui/skeleton";

export default function PlanLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-5 w-32" />
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="mx-4 my-3.5 h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
