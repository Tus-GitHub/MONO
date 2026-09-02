import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { MemoryDetailView } from "@/components/memories/memory-detail-view";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { getMemoryDetail, type MemoryDetail } from "@/server/services/memory-service";

export const metadata: Metadata = { title: "A memory" };

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireOnboarded();
  const { id } = await params;

  let detail: MemoryDetail;
  try {
    detail = await getMemoryDetail(id, user.id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  return (
    <PageContainer className="space-y-5">
      <Link
        href="/memories"
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
      >
        <Icon name="chevronLeft" size="sm" />
        Memories
      </Link>
      <MemoryDetailView detail={detail} />
    </PageContainer>
  );
}
