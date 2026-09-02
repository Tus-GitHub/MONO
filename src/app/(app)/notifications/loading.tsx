import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-3.5">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
