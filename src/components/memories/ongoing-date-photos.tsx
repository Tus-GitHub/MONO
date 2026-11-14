import Link from "@/components/ui/app-link";
import { PhotoGallery } from "@/components/dates/photo-gallery";
import type { getOngoingMemoryDates } from "@/server/services/memory-service";

export function OngoingDatePhotos({ dates }: { dates: Awaited<ReturnType<typeof getOngoingMemoryDates>> }) {
  if (!dates.length) return null;
  return <section className="space-y-4" aria-label="Ongoing date photos">
    <h2 className="font-display text-lg font-medium text-ink">Happening now</h2>
    {dates.map((date) => <div key={date.id} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <Link href={`/dates/${date.id}`} className="wrap-anywhere font-display text-lg font-medium text-primary hover:text-primary-hover">{date.title}</Link>
      <p className="text-sm text-muted">Add photos while you&apos;re together. They stay attached to this date.</p>
      <PhotoGallery dateId={date.id} photos={date.photos} anchorId={`ongoing-${date.id}`} />
    </div>)}
  </section>;
}
