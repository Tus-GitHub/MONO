import type { VenuePhoto } from "@/lib/places/venue-photo";

export function PhotoCredit({ photo }: { photo?: VenuePhoto | null }) {
  if (!photo) return null;
  return (
    <p className="wrap-anywhere text-2xs leading-relaxed text-faint">
      Photo: {photo.author}{" · "}
      <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{photo.license}</a>
      {" · "}<a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Wikimedia Commons</a>
      {" · Cropped to fit"}
    </p>
  );
}
