import { PageContainer } from "@/components/layout/page-container";

export default function GamesLoading() {
  return (
    <PageContainer className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-4 w-64 rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
      </div>
    </PageContainer>
  );
}
