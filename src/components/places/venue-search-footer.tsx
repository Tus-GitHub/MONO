import { Button } from "@/components/ui/button";
import type { VenueSearchState } from "@/lib/hooks/use-venue-search";

export function VenueSearchFooter({ search, disabled = false }: { search: VenueSearchState; disabled?: boolean }) {
  if (search.loading || search.error) return null;
  return <div className="space-y-2 py-2 text-center">
    <p role="status" aria-live="polite" className="text-xs text-muted">
      {search.results.length} {search.results.length === 1 ? "place" : "places"} shown
      {search.hasMore ? " · More places available" : ""}
    </p>
    {search.moreError ? <p role="alert" className="text-sm text-error">{search.moreError}</p> : null}
    {search.hasMore ? <Button variant="secondary" className="w-full sm:w-auto" disabled={disabled || search.loadingMore}
      loading={search.loadingMore} onClick={() => void search.loadMore()}>
      {search.moreError ? "Try loading more" : "Load more"}
    </Button> : null}
    {search.hasMore && (search.near || search.city.trim()) ? <p className="text-xs text-faint">Keep browsing for more places within your selected radius.</p> : null}
  </div>;
}
