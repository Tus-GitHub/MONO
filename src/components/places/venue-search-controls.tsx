"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search";
import { Select } from "@/components/ui/select";
import { NEARBY_RADII_KM } from "@/lib/places/types";
import type { VenueSearchState } from "@/lib/hooks/use-venue-search";

export function VenueSearchControls({ search, disabled = false }: { search: VenueSearchState; disabled?: boolean }) {
  const id = useId();
  return <div className="space-y-3">
    <SearchInput value={search.q} onValueChange={search.setQ} placeholder="Venue name, e.g. SOCIAL" />
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <Field label="City or area" htmlFor={`${id}-city`} optional>
        <Input id={`${id}-city`} value={search.city} onChange={(event) => search.changeCity(event.target.value)} placeholder="Enter your city" />
      </Field>
      <Field label="Search radius" htmlFor={`${id}-radius`}>
        <Select id={`${id}-radius`} value={search.radiusKm} onChange={(event) => search.setRadius(Number(event.target.value))}>
          {NEARBY_RADII_KM.map((radius) => <option key={radius} value={radius}>{radius} km</option>)}
        </Select>
      </Field>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" loading={search.locating} disabled={disabled || search.locating}
        leadingIcon={<Icon name="mapPin" size="sm" />} onClick={() => void search.locate()}>
        {search.locating ? "Finding your location…" : "Use my location"}
      </Button>
      {search.locating ? <Button variant="ghost" size="sm" onClick={search.clearLocation}>Cancel location</Button>
        : search.near ? <Button variant="ghost" size="sm" onClick={search.clearLocation}>Use city instead</Button> : null}
    </div>
    <p role="status" className="text-xs text-muted">{search.near
      ? `Using your approximate location · Within ${search.radiusKm} km.`
      : "Choose a city or allow browser location. Radius applies around your location or the city centre."}</p>
    {search.locationError ? <p role="alert" className="text-sm text-error">{search.locationError}</p> : null}
  </div>;
}
