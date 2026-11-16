"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { afterMinutes } from "@/lib/date/plan-validation";
import { amountCents, minutesLabel, timeSpan } from "@/lib/date/plan-allocation";
import { formatMoney } from "@/lib/utils/format";
import type { LocalPlan } from "@/lib/validation/new-plan";
import { STOP_CHOICES } from "./add-stop-sheet";

type Event = LocalPlan["activities"][number];
export function PlanEventCard({ event, index, currency, savedPlaceName, expanded, errors, onToggle, onChange, onTouch, onFindVenue, onDone, onRemove }: {
  event: Event; index: number; currency: string; savedPlaceName?: string; expanded: boolean; errors: Record<string, string[]>;
  onToggle: () => void; onChange: (values: Partial<Event>) => void; onTouch: (key: string) => void;
  onFindVenue: () => void; onDone: () => void; onRemove: () => void;
}) {
  const prefix = `activities.${index}.`;
  const venue = event.place?.name ?? savedPlaceName;
  const duration = timeSpan(event.startTime, event.endTime);
  const hasErrors = Object.keys(errors).some((key) => key.startsWith(prefix));
  const field = (key: string) => ({ invalid: Boolean(errors[prefix + key]), "aria-describedby": errors[prefix + key] ? `${event.key}-${key}-error` : undefined, onBlur: () => onTouch(prefix + key) });
  const changeTime = (key: "startTime" | "endTime", value: string) => {
    const startTime = key === "startTime" ? value : event.startTime ?? "";
    const endTime = key === "endTime" ? value : afterMinutes(value, duration || Number(event.duration) || 60);
    onChange({ startTime, endTime, duration: String(timeSpan(startTime, endTime) || "") });
  };
  return <article className={`min-w-0 overflow-hidden rounded-xl border bg-surface ${hasErrors ? "border-error" : expanded ? "border-primary/40" : "border-line"}`}>
    <button type="button" className="flex w-full min-w-0 items-start gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-primary" aria-expanded={expanded} aria-controls={`event-${event.key}`} onClick={onToggle}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary"><Icon name={STOP_CHOICES.find((choice) => choice.title === event.title)?.icon ?? "heart"} size="sm" /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-primary">Event {index + 1} · {event.startTime || "…"}–{event.endTime || "…"}</span>
        <span className="mt-1 block break-words font-medium text-ink [overflow-wrap:anywhere]">{event.title || "Name your event"}</span>
        <span className="mt-0.5 block break-words text-sm text-muted [overflow-wrap:anywhere]">{venue || "Choose a venue, or leave it open"}</span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"><span>{duration ? minutesLabel(duration) : "Set a time"}</span><span>{event.cost.trim() ? formatMoney(amountCents(event.cost), currency) : "Add cost estimate"}</span></span>
      </span><Icon name={expanded ? "chevronUp" : "chevronDown"} size="sm" className="mt-1 shrink-0 text-muted" />
    </button>
    {expanded ? <div id={`event-${event.key}`} className="space-y-4 border-t border-line p-4">
      <Field label="Event name" htmlFor={`${event.key}-title`} errors={errors[prefix + "title"]}><Input id={`${event.key}-title`} maxLength={120} value={event.title} {...field("title")} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <div className="space-y-2"><p className="text-sm font-medium text-ink">Where <span className="font-normal text-faint">· optional</span></p>
        <Button variant="secondary" fullWidth className="justify-start text-left" onClick={onFindVenue}><Icon name="mapPin" size="sm" /><span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{venue ? `Change ${venue}` : "Find a place near me"}</span><Icon name="chevronRight" size="sm" /></Button>
        {event.place?.address ? <p className="text-xs text-muted [overflow-wrap:anywhere]">{event.place.address}</p> : null}
        {venue ? <Button variant="link" size="sm" onClick={() => onChange({ place: null, savedPlaceId: "" })}>Remove venue</Button> : <p className="text-xs text-muted">Current location is selected when available. You can change the area.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts at" htmlFor={`${event.key}-startTime`} errors={errors[prefix + "startTime"]} className="min-w-0"><Input id={`${event.key}-startTime`} type="time" compact value={event.startTime ?? ""} {...field("startTime")} onChange={(e) => changeTime("startTime", e.target.value)} /></Field>
        <Field label="Ends at" htmlFor={`${event.key}-endTime`} errors={errors[prefix + "endTime"]} className="min-w-0"><Input id={`${event.key}-endTime`} type="time" compact value={event.endTime ?? ""} {...field("endTime")} onChange={(e) => changeTime("endTime", e.target.value)} /></Field>
      </div>
      <Field label={`Estimated cost (${currency})`} htmlFor={`${event.key}-costCents`} errors={errors[prefix + "costCents"]} hint="For this event, for both of you. Enter 0 if it is free."><Input id={`${event.key}-costCents`} type="number" min="0" step="0.01" max="1000000" placeholder="e.g. 600" value={event.cost} {...field("costCents")} onChange={(e) => onChange({ cost: e.target.value })} /></Field>
      <details><summary className="cursor-pointer text-xs text-muted">Event note</summary><Field className="mt-3" label="Remember to…" htmlFor={`${event.key}-description`} optional><Textarea id={`${event.key}-description`} rows={2} maxLength={2000} value={event.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} /></Field></details>
      <div className="grid grid-cols-2 gap-2"><Button variant="ghost" onClick={onRemove}>Remove event</Button><Button variant="secondary" onClick={onDone}>Done</Button></div>
    </div> : hasErrors ? <p className="px-4 pb-3 text-xs text-error">Open this event to check its details.</p> : null}
  </article>;
}
