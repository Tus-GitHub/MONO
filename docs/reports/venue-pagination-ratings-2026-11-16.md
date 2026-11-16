# Venue pagination, cards and public visitor ratings

MONO's café/restaurant picker now continues past its first nearby batch, renders photo cards in the existing design, and shows public visitor rating snapshots with their source and count. A 50 km radius is a maximum distance; it does not exclude closer venues.

## Implementation

- Indian café, restaurant and bar category searches use IndiaRestros's documented `radius_m`, `offset` and `next_offset`. No API key, billing account or autopay is required. Photon still resolves areas and serves other categories/regions; empty IndiaRestros searches fall back to Photon, preserving the existing Commons photo path.
- Load more works in the planner and Explore. Saved and external streams advance independently so combining them cannot discard unseen rows. Every page is authenticated, scoped to the current couple and filtered by actual distance. Continuations are bound to that couple and the search filters.
- Changing query/category/location/radius aborts old requests. Load more preserves existing cards on errors, supports retry and prevents overlapping clicks. Reopening the picker keeps loaded pages instead of racing a first-page refresh against Load more. Overlapping provider pages are deduplicated by identity, while same-name outlets remain separate.
- Cards share one component, use existing MONO tokens and controls, and retain source links. Ratings are public venue-data snapshots (e.g. Google or magicpin via IndiaRestros), not MONO couple reviews. Missing ratings/photos are not fabricated.
- The additive `20261116190000_place_public_rating_source` migration stores the canonical listing and rating source with saved venue snapshots. Both saving paths verify provider details on the server.

## Validation

- 63 focused unit checks passed: provider mapping, real pagination parameters, radius bounds, malformed records, rating/photo authenticity, upstream caching/backoff, invalid/stale continuations, deduplication and existing Photon/photo behavior.
- 25 isolated PostgreSQL integration checks passed: migration, search/pagination, partner access, couple isolation, later-page selection through both save paths, rating attribution on saved details, existing explicit-plan save and discovery flows.
- TypeScript, scoped ESLint and the production build passed. Preserved the concurrent e2f6af9 shared-controls release by rebasing; final combined build/deployment checks are in progress.
- Read-only real API checks returned 24 distinct cafés and 24 distinct restaurants on each of the first two pages, with more available. Both later-page details resolved successfully. A named café search returned venues up to 23.7656 km away, all within 50 km.
- One initial real-source request exceeded a 6-second deadline. The provider now allows 10 seconds; the client allows 25 seconds for area resolution plus search, preserves loaded cards and offers retry. The corrected real API run passed.
- The Browser panel is visible, but its control runtime returns `Browser is not available: iab`. The user requires browser testing only in that panel. No substitute browser was run; visual phone/PWA behavior is not verified in this release.

Sources: [IndiaRestros API](https://indiarestros.com/api/docs), [terms](https://indiarestros.com/terms).
