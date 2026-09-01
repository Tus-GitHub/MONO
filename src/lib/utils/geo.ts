/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

/** 0–4 → "Free" / "$" … "$$$$". */
export function priceLevelLabel(level: number | null | undefined): string {
  if (level == null) return "";
  if (level <= 0) return "Free";
  return "$".repeat(Math.min(level, 4));
}

/** A Google Maps deep link that works without an API key. */
export function mapsLink(place: {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}): string {
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const query = encodeURIComponent([place.name, place.address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
