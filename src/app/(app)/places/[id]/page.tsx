import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlaceDetail } from "@/components/places/place-detail";
import { Icon } from "@/components/ui/icon";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { getPlaceDetail } from "@/server/services/place-service";

export const metadata: Metadata = { title: "Place" };

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ forDate?: string }>;
}) {
  await requireOnboarded();
  const { id } = await params;
  const { forDate } = await searchParams;

  let place;
  try {
    place = await getPlaceDetail(id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={forDate ? `/explore?forDate=${forDate}` : "/explore"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
      >
        <Icon name="chevronLeft" size="sm" />
        Explore
      </Link>
      <PlaceDetail place={place} forDate={forDate} />
    </div>
  );
}
