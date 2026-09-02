import { Skeleton } from "@/components/ui/skeleton";

export default function MemoriesLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>

      <Skeleton className="h-4 w-72" />

      <Skeleton className="aspect-[2/1] w-full rounded-2xl" />

      <div className="columns-2 gap-2.5 sm:columns-3 lg:columns-4 [&>*]:mb-2.5">
        {[
          "h-40",
          "h-56",
          "h-44",
          "h-52",
          "h-36",
          "h-60",
          "h-40",
          "h-48",
        ].map((height, index) => (
          <Skeleton key={index} className={`w-full rounded-xl ${height}`} />
        ))}
      </div>
    </div>
  );
}
