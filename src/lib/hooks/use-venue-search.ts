"use client";

import { useCallback, useEffect, useState } from "react";
import { useAsyncTask } from "./use-async-task";
import { getBrowserLocation } from "@/lib/places/browser-location";
import type { GeoPoint } from "@/lib/places/types";
import type { PlaceSearchResult } from "@/server/services/place-search-service";

export function useVenueSearch({ active = true, categoryKey, initialQuery = "" }: {
  active?: boolean; categoryKey: string | null; initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [city, setCity] = useState("");
  const [near, setNear] = useState<GeoPoint | null>(null);
  const [radiusKm, setRadius] = useState(5);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState<{ key: string; results: PlaceSearchResult[]; error?: string }>({ key: "", results: [] });
  const location = useAsyncTask<GeoPoint, "locating">();
  const { reset } = location;
  const key = JSON.stringify([q, city, near, radiusKm, categoryKey, attempt]);
  const current = search.key === key;

  useEffect(() => {
    if (!active) return;
    let live = true;
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      deadline = setTimeout(() => controller.abort(), 15_000);
      try {
        const params = new URLSearchParams({ radius: String(radiusKm) });
        if (q.trim()) params.set("q", q.trim());
        if (city.trim()) params.set("city", city.trim());
        if (categoryKey) params.set("category", categoryKey);
        if (near) { params.set("lat", String(near.latitude)); params.set("lng", String(near.longitude)); }
        const response = await fetch(`/api/places/search?${params}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Couldn't load places. Try again.");
        if (live) setSearch({ key, results: body.results ?? [] });
      } catch {
        if (live) setSearch({ key, results: [], error: !navigator.onLine ? "You're offline. Reconnect to search." : "Couldn't load places in time. Try again or change the city." });
      } finally { clearTimeout(deadline); }
    }, 450);
    return () => { live = false; clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [active, q, city, near, radiusKm, categoryKey, key]);

  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const changeCity = useCallback((value: string) => { reset(); setNear(null); setCity(value); }, [reset]);
  const clearLocation = useCallback(() => { reset(); setNear(null); }, [reset]);
  const locate = async () => {
    const result = await location.run("locating", getBrowserLocation);
    if (result) { setCity(""); setNear(result.data); }
  };
  return {
    q, setQ, city, changeCity, near, radiusKm, setRadius, locate, clearLocation,
    locating: location.state.status === "pending",
    locationError: location.state.status === "error" ? location.state.message : null,
    results: current ? search.results : [], loading: active && !current,
    error: current ? search.error : undefined, retry: () => setAttempt((value) => value + 1),
  };
}
export type VenueSearchState = ReturnType<typeof useVenueSearch>;
