import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { CoupleProfileForm } from "@/components/settings/couple-profile-form";
import { requireCoupleOrOnboard } from "@/lib/authz";
import { getCoupleProfileForEdit } from "@/server/services/couple-service";

export const metadata: Metadata = { title: "Couple profile" };

export default async function CoupleProfileSettingsPage() {
  const { couple } = await requireCoupleOrOnboard();
  const data = await getCoupleProfileForEdit(couple.id);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Couple profile"
        description="Your shared space — name, photo, when it began."
        back={{ href: "/settings", label: "Settings" }}
      />
      <CoupleProfileForm
        initial={{
          name: data.name,
          description: data.description,
          anniversaryAt: data.anniversaryAt
            ? data.anniversaryAt.toISOString().slice(0, 10)
            : null,
          currency: data.currency,
          photoUrl: data.photoUrl,
        }}
      />
    </div>
  );
}
