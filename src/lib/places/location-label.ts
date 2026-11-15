import type { GeoPoint } from "./types";

export const coordinateLabel = (point: GeoPoint) => `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`;

/** Keep the usable pin if the optional human-readable address lookup is unavailable. */
export async function getLocationLabel(point: GeoPoint, signal: AbortSignal): Promise<string> {
  try {
    const params = new URLSearchParams({ lat: String(point.latitude), lng: String(point.longitude) });
    const response = await fetch(`/api/places/locations?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), cache: "no-store",
    });
    if (response.ok) {
      const body = await response.json();
      if (typeof body.label === "string" && body.label.trim()) return body.label.trim().slice(0, 160);
    }
  } catch { /* Coordinates still support nearby search when naming the area fails. */ }
  return coordinateLabel(point);
}
