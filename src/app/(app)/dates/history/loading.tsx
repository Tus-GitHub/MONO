import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-52 rounded-lg" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>

      <Skeleton className="aspect-[2/1] w-full rounded-2xl" />

      <div className="space-y-5 border-l border-line pl-1">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="pl-7">
            <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
