import type { GeoPoint } from "./types";

/** Called only by the location button. Keep coordinates in this picker, with bounded waiting. */
export function getBrowserLocation(signal: AbortSignal): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location isn't available in this browser. Enter a city or area instead."));
      return;
    }
    if (signal.aborted) { reject(new DOMException("Location request cancelled", "AbortError")); return; }
    let settled = false;
    const finish = (work: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      work();
    };
    const cancel = () => finish(() => reject(new DOMException("Location request cancelled", "AbortError")));
    const timeout = "Your browser hasn't supplied a location. Check location permission and device location services, or enter a city or area.";
    const timer = setTimeout(() => finish(() => reject(new Error(timeout))), 30_000);
    signal.addEventListener("abort", cancel, { once: true });
    try {
      const request = (highAccuracy: boolean) => {
        if (settled || signal.aborted) return;
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            finish(() => reject(new Error("Couldn't determine your location. Enter a city or area instead.")));
            return;
          }
          // Roughly a city-block precision is sufficient for venue discovery.
          finish(() => resolve({ latitude: Math.round(latitude * 1_000) / 1_000, longitude: Math.round(longitude * 1_000) / 1_000 }));
        }, (error) => {
          if (!highAccuracy && (error.code === 2 || error.code === 3)) { request(true); return; }
          finish(() => reject(new Error(error.code === 1
            ? "Location permission was denied. Enter a city or area instead."
            : timeout)));
        }, { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15_000 : 10_000, maximumAge: 60_000 });
      };
      request(false);
    } catch {
      finish(() => reject(new Error("Location isn't available here. Enter a city or area instead.")));
    }
  });
}
