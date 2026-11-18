import { PageContainer } from "@/components/layout/page-container";
import { MemoriesNav } from "@/components/memories/memories-nav";

export default function MemoriesLoading() {
  return (
    <PageContainer className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded-md" />
        </div>
        <MemoriesNav />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>

      <div className="skeleton h-56 w-full rounded-2xl" />
    </PageContainer>
  );
}
