import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import type { DatePlaceRatings } from "@/server/services/place-rating-service";

export function PlaceRatings({ dateId, places }: { dateId: string; places: DatePlaceRatings }) {
  if (!places.length) return null;
  return <Card className="min-w-0 space-y-4">
    <CardHeader title="Restaurants & cafés" description="Your scores for each place, separate from the date overall." />
    <div className="space-y-3">{places.map((place) => <article key={place.id} className="min-w-0 space-y-3 rounded-xl border border-line bg-paper/60 p-4">
      <Link href={`/places/${place.id}`} className="break-words font-display text-lg font-medium text-ink underline decoration-line underline-offset-4">{place.name}</Link>
      <p className="text-xs text-muted">{[place.category === "CAFE" ? "Café" : "Restaurant", place.city].filter(Boolean).join(" · ")}</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><dt className="text-xs text-muted">You{!place.submitted && place.mine != null ? " · draft" : ""}</dt><dd className="mt-1 text-sm font-medium text-ink">{place.mine != null ? `${place.mine} / 10` : "Not rated"}</dd></div>
        {place.hasPartner ? <div><dt className="text-xs text-muted">Partner</dt><dd className="mt-1 text-sm font-medium text-ink">{place.partner != null ? `${place.partner} / 10` : "Waiting for both"}</dd></div> : null}
        {place.revealed ? <div><dt className="text-xs text-muted">{place.hasPartner ? "Together" : "Place score"}</dt><dd className="mt-1 text-sm font-medium text-primary">{place.average?.toFixed(1)} / 10</dd></div> : null}
      </dl>
      {!place.revealed ? <p className="text-xs text-muted">Both submitted place ratings are needed to reveal the shared score.</p> : null}
    </article>)}</div>
    <LinkButton href={`/dates/${dateId}/review`} variant="secondary" size="sm">{places.some((place) => place.mine == null) ? "Rate your places" : "Edit my ratings"}</LinkButton>
  </Card>;
}
