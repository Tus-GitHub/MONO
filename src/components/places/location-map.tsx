"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/places/types";

export default function LocationMap({ point, radius, onChange }: { point: GeoPoint | null; radius: number; onChange: (point: GeoPoint) => void }) {
  const root = useRef<HTMLDivElement | null>(null), map = useRef<L.Map | null>(null), marker = useRef<L.Marker | null>(null), circle = useRef<L.Circle | null>(null);
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!root.current) return;
    const instance = L.map(root.current, { scrollWheelZoom: false, worldCopyJump: true }).setView([20, 0], 2); map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(instance);
    const choose = (latlng: L.LatLng) => callback.current({ latitude: Math.max(-85, Math.min(85, latlng.lat)), longitude: latlng.wrap().lng });
    instance.on("click", (event: L.LeafletMouseEvent) => choose(event.latlng));
    const resize = new ResizeObserver(() => instance.invalidateSize()); resize.observe(root.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; marker.current = null; circle.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current; if (!instance || !point) return;
    const latlng: L.LatLngTuple = [point.latitude, point.longitude];
    if (!marker.current) {
      marker.current = L.marker(latlng, { draggable: true, title: "Selected location. Drag to move.", icon: L.divIcon({ className: "mono-map-pin", html: '<span aria-hidden="true">●</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(instance);
      marker.current.on("dragend", () => { const next = marker.current!.getLatLng().wrap(); callback.current({ latitude: next.lat, longitude: next.lng }); });
      circle.current = L.circle(latlng, { radius: radius * 1000, color: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(), weight: 2, fillOpacity: 0.12 }).addTo(instance);
    }
    marker.current.setLatLng(latlng); circle.current!.setLatLng(latlng).setRadius(radius * 1000);
    instance.fitBounds(circle.current!.getBounds(), { padding: [20, 20], maxZoom: 15, animate: false });
  }, [point, radius]);
  return <div className="space-y-2"><div ref={root} role="region" aria-label="Location map. Use arrow keys to move, then select map centre." className="relative z-0 h-72 w-full rounded-xl border border-line sm:h-80" />
    <button type="button" className="min-h-10 text-sm text-primary underline" onClick={() => { const next = map.current?.getCenter().wrap(); if (next) onChange({ latitude: next.lat, longitude: next.lng }); }}>Use map centre</button></div>;
}
