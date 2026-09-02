import type { Metadata } from "next";

import { MemoriesNav } from "@/components/memories/memories-nav";
import { PhotoWall } from "@/components/memories/photo-wall";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { requireOnboarded } from "@/lib/onboarding";
import { loadMoreBestPhotosAction } from "@/server/actions/photos";
import { getBestPhotoWallPage } from "@/server/services/photo-service";

export const metadata: Metadata = { title: "Photo wall" };

export default async function PhotoWallPage() {
  await requireOnboarded();
  const first = await getBestPhotoWallPage();

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Photo wall"
        description="One photo from every date — the one that felt most like you."
        action={<MemoriesNav />}
      />

      {first.photos.length === 0 ? (
        <EmptyState
          icon={<Icon name="images" size="md" />}
          title="The wall is waiting for its first photo"
          description="Open any date's gallery and mark the photo that feels most like you — it lands here."
          action={
            <LinkButton href="/dates" variant="secondary">
              Our dates
            </LinkButton>
          }
        />
      ) : (
        <PhotoWall
          photos={first.photos}
          nextCursor={first.nextCursor}
          loadMore={loadMoreBestPhotosAction}
          favoritable
        />
      )}
    </PageContainer>
  );
}
