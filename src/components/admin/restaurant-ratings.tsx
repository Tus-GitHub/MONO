import Link from "next/link";
import type { AdminRestaurantRatings } from "@/server/services/admin-restaurant-ratings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWallDate } from "@/lib/utils/format";

export function RestaurantRatings({ data }: { data: AdminRestaurantRatings }) {
  const pageLink = (page: number) => `/admin?${new URLSearchParams({ view: "ratings", venueQuery: data.query.venueQuery, page: String(page) })}`;
  return <section className="space-y-5" aria-labelledby="ratings-heading">
    <div className="space-y-2">
      <h2 id="ratings-heading" className="font-display text-2xl text-ink">Restaurant ratings</h2>
      <p className="text-sm text-muted">Scores for the whole date, with its restaurants and cafés. Reviews appear after both partners submit, or after a solo submission.</p>
    </div>
    <form className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end" method="get">
      <input type="hidden" name="view" value="ratings" />
      <div className="min-w-0 flex-1 space-y-2"><label htmlFor="venue-query" className="text-sm text-ink">Find a restaurant, café or account</label>
        <Input key={data.query.venueQuery} id="venue-query" name="venueQuery" defaultValue={data.query.venueQuery} maxLength={120} placeholder="Venue, city, account or couple ID" />
      </div>
      <Button type="submit" variant="secondary">Search ratings</Button>
      {data.query.venueQuery ? <Link href="/admin?view=ratings" className="py-3 text-center text-sm text-primary underline">Clear</Link> : null}
    </form>
    <p className="text-sm text-muted" role="status">{data.count.toLocaleString()} reviewed {data.count === 1 ? "date" : "dates"}{data.query.venueQuery ? " matching your search" : " with a restaurant or café"}</p>
    {data.rows.length === 0 ? <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
      {data.query.venueQuery ? "No matching ratings. Try a different venue, city or ID." : "No revealed restaurant or café ratings yet. Completed dates with submitted reviews will appear here."}
    </div> : null}
    {data.rows.map((date) => <article key={date.id} className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <ul className="min-w-0 flex-1 space-y-3">{date.venues.map((venue) => <li key={venue.id} className="space-y-1">
          <h3 className="break-words font-display text-lg font-medium text-ink">{venue.name}</h3>
          <p className="text-xs text-muted">{venue.category === "CAFE" ? "Café" : "Restaurant"} · {venue.recorded ? "Recorded venue" : "Planned venue"}</p>
          {venue.address || venue.city ? <p className="break-words text-sm text-muted">{[venue.address, venue.city].filter(Boolean).join(" · ")}</p> : null}
        </li>)}</ul>
        <div className="shrink-0 self-start rounded-lg bg-primary-tint px-3 py-2 text-primary"><p className="text-xs">Combined date score</p><p className="font-display text-2xl">{date.average?.toFixed(1)}<span className="text-sm"> / 10</span></p></div>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{date.reviews.map((review) => <div key={review.accountId} className="min-w-0 rounded-lg bg-paper p-3">
        <p className="text-xs text-muted">Account</p><Link className="break-all font-mono text-xs text-primary underline" href={`/admin?view=accounts&query=${encodeURIComponent(review.accountId)}`}>{review.accountId}</Link>
        <p className="mt-2 text-sm text-ink">Date score <strong>{review.score} / 10</strong></p>
        <p className="mt-1 text-xs text-muted">Updated {formatWallDate(review.updatedAt.toISOString().slice(0, 10), "medium")}</p>
      </div>)}</div>
      <div className="space-y-1 border-t border-line pt-3 text-xs text-muted">
        {date.completedAt ? <p>Completed {formatWallDate(date.completedAt.toISOString().slice(0, 10), "medium")}</p> : null}
        <p className="break-all">Couple <Link className="font-mono text-primary underline" href={`/admin?view=couples&query=${encodeURIComponent(date.coupleId)}`}>{date.coupleId}</Link></p>
        <p className="break-all">Date <span className="font-mono">{date.id}</span></p>
      </div>
    </article>)}
    {data.pageCount > 1 ? <nav aria-label="Restaurant ratings pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {data.query.page > 1 ? <Link className="py-2 text-primary underline" href={pageLink(data.query.page - 1)}>Previous page</Link> : <span />}
      <span className="text-muted">Page {data.query.page} of {data.pageCount}</span>
      {data.query.page < data.pageCount ? <Link className="py-2 text-primary underline" href={pageLink(data.query.page + 1)}>Next page</Link> : <span />}
    </nav> : null}
  </section>;
}
