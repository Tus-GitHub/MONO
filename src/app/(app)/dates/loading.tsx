import { PageContainer } from "@/components/layout/page-container";
import { DatesNav } from "@/components/dates/dates-nav";

export default function DatesLoading() {
  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded-md" />
        </div>
        <DatesNav />
      </div>

      <div className="skeleton h-80 w-full rounded-2xl" />
      <div className="skeleton h-32 w-full rounded-2xl" />
    </PageContainer>
  );
}
