"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { NEARBY_RADII_KM, type GeoPoint } from "@/lib/places/types";
import { getBrowserLocation } from "@/lib/places/browser-location";
import { coordinateLabel, getLocationLabel } from "@/lib/places/location-label";
import { togetherFetch, errorMessage } from "@/lib/together/client";
const LocationMap = dynamic(() => import("./location-map"), { ssr: false, loading: () => <p className="grid h-72 place-content-center text-sm text-muted">Loading map…</p> });

export function LocationPicker({ initial, initialQuery, radiusKm, onClose, onChoose }: { initial: GeoPoint | null; initialQuery: string; radiusKm: number; onClose: () => void; onChoose: (point: GeoPoint, radius: number) => void }) {
  const [point, setPoint] = useState(initial), [query, setQuery] = useState(initialQuery), [radius, setRadius] = useState(radiusKm);
  const [results, setResults] = useState<(GeoPoint & { label: string })[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [searched, setSearched] = useState(false), [locating, setLocating] = useState(false);
  const locationRequest = useRef<AbortController | null>(null);
  useEffect(() => () => locationRequest.current?.abort(), []);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopImmediatePropagation(); onClose(); } }; document.addEventListener("keydown", escape, true); return () => document.removeEventListener("keydown", escape, true); }, [onClose]);
  useEffect(() => { if (!initialQuery.trim() || initial) return; const controller = new AbortController(); void togetherFetch<{ results: (GeoPoint & { label: string })[] }>(`/api/places/locations?q=${encodeURIComponent(initialQuery)}`, { signal: controller.signal }).then((value) => { setResults(value.results); setSearched(true); }).catch(() => {}); return () => controller.abort(); }, [initial, initialQuery]);
  const search = async () => {
    if (busy || query.trim().length < 2) return; setBusy(true); setError("");
    try { const value = await togetherFetch<{ results: (GeoPoint & { label: string })[] }>(`/api/places/locations?q=${encodeURIComponent(query)}`); setResults(value.results); setSearched(true); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <BottomSheet open onClose={onClose} title="Find your starting point" footer={<Button fullWidth disabled={!point} onClick={() => { if (point) onChoose(point, radius); }}>Search within {radius} km of this pin</Button>}>
    <div className="space-y-4"><p className="text-sm text-muted">Search a city, area or landmark. Choose a result or tap the map, then adjust your radius.</p>
      <div className="flex gap-2"><Input className="min-w-0" aria-label="City, area or landmark" placeholder="Gaur City Mall, Greater Noida" value={query} onChange={(event) => { locationRequest.current?.abort(); setLocating(false); setQuery(event.target.value); setSearched(false); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} /><Button variant="secondary" loading={busy} disabled={query.trim().length < 2} onClick={() => void search()}>Search</Button></div>
      {results.length ? <ul className="max-h-40 overflow-y-auto divide-y divide-line rounded-lg border border-line">{results.map((result, index) => <li key={index}><button type="button" className="w-full px-3 py-3 text-left text-sm hover:bg-primary-tint" onClick={() => { locationRequest.current?.abort(); setLocating(false); setPoint({ latitude: result.latitude, longitude: result.longitude }); setQuery(result.label); setResults([]); setSearched(false); }}><Icon name="mapPin" size="sm" className="mr-2 inline" />{result.label}</button></li>)}</ul> : searched ? <p role="status" className="text-sm text-muted">No map match yet. Try adding the city, a different spelling, or place the pin yourself.</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-3"><Button size="sm" variant="secondary" loading={locating} onClick={async () => { if (locating) return; const controller = new AbortController(); locationRequest.current = controller; setLocating(true); setError(""); try { const next = await getBrowserLocation(controller.signal); if (!controller.signal.aborted) { setPoint(next); setQuery(coordinateLabel(next)); setResults([]); setSearched(false); const label = await getLocationLabel(next, controller.signal); if (!controller.signal.aborted) setQuery(label); } } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); } finally { if (!controller.signal.aborted) setLocating(false); } }}><Icon name="mapPin" size="sm" />Use my location</Button>
        <label className="space-y-1 text-sm">Search radius<Select aria-label="Map search radius" value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{NEARBY_RADII_KM.map((value) => <option key={value} value={value}>{value} km</option>)}</Select></label></div>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}<LocationMap point={point} radius={radius} onChange={(next) => { locationRequest.current?.abort(); setLocating(false); setPoint(next); setQuery(coordinateLabel(next)); }} />
      <p className="text-xs text-muted">{point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} · ${radius} km around your selected pin` : "No location selected. The map does not use your device location until you ask."}</p>
      <p className="text-xs text-faint">Map © OpenStreetMap contributors · Search by Photon. Location queries and map tiles use these services.</p>
    </div>
  </BottomSheet>;
}
