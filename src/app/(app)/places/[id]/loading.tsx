import { Skeleton } from "@/components/ui/skeleton";

export default function PlaceDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
