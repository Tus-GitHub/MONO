/**
 * Shapes the UI consumes for date photos. Pure and client-safe — every URL is an app-relative
 * `/media/...` path that the media route authorizes per request; there are no public URLs.
 */

export interface PhotoView {
  id: string;
  /** ~480px — grids, cards. */
  thumbUrl: string;
  /** ~1400px — gallery, lightbox default. */
  displayUrl: string;
  /** The (capped, EXIF-stripped) full image — loaded only on zoom. */
  fullUrl: string;
  blurDataUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  isBest: boolean;
  isFavorite: boolean;
}

/** A photo shown outside its date — the couple photo wall, Our Favorites. Carries date context. */
export interface WallPhoto extends PhotoView {
  dateId: string;
  dateTitle: string;
  dateYmd: string | null;
  placeLabel: string | null;
}

/** The one image that represents a date across cards, memory, home, timeline and stats. */
export interface CoverImage {
  thumbUrl: string;
  displayUrl: string;
  fullUrl: string;
  blurDataUrl: string | null;
  width: number | null;
  height: number | null;
}

export function coverFromPhoto(photo: PhotoView): CoverImage {
  return {
    thumbUrl: photo.thumbUrl,
    displayUrl: photo.displayUrl,
    fullUrl: photo.fullUrl,
    blurDataUrl: photo.blurDataUrl,
    width: photo.width,
    height: photo.height,
  };
}
