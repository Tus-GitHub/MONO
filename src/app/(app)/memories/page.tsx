import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { requireCoupleOrOnboard } from "@/lib/authz";

export const metadata: Metadata = { title: "Memories" };

export default async function MemoriesPage() {
  await requireCoupleOrOnboard();

  return (
    <div>
      <PageHeader
        title="Memories"
        description="A photo-first archive of the moments worth keeping."
      />
      <EmptyState
        icon={<Icon name="images" size="md" />}
        title="No memories yet"
        description="When you complete a date you can keep a memory — a title, a few words, and a favourite photo. They'll gather here as a gallery."
      />
    </div>
  );
}
