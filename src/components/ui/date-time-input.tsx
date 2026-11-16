"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { InputProps } from "./input";
import { Button } from "./button";
import { Select } from "./select";
import { Icon } from "./icon";
import { controlSize, disabledControl, focusRing } from "./_shared";
import { useBackButton } from "./_dialog-primitives";
import { cn } from "@/lib/utils/cn";

const months = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, month, 1))));
const ymd = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && ymd(new Date(`${value}T12:00:00Z`)) === value;

/** Calendar/clock UI with native values retained for forms, refs and validation. */
export function DateTimeInput({ type, className, uiSize = "md", invalid, compact = false, value, defaultValue, onChange, id: providedId, ref, disabled, readOnly, ...props }: InputProps & { type: "date" | "time" }) {
  const autoId = useId(), id = providedId ?? autoId;
  const native = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [local, setLocal] = useState(String(defaultValue ?? ""));
  const selected = String(value ?? local);
  const lastReported = useRef(selected);
  useEffect(() => { lastReported.current = selected; }, [selected]);
  const [open, setOpen] = useState(false);
  const [validation, setValidation] = useState("");
  const [label, setLabel] = useState(props["aria-label"] ?? (type === "date" ? "Choose a date" : "Choose a time"));
  useBackButton(() => setOpen(false), open);
  useEffect(() => {
    const form = native.current?.form; let frame = 0;
    const reset = () => { frame = requestAnimationFrame(() => { setLocal(native.current?.value ?? ""); setValidation(""); }); };
    form?.addEventListener("reset", reset);
    return () => { form?.removeEventListener("reset", reset); cancelAnimationFrame(frame); };
  }, []);
  const choose = (next: string, close = true) => {
    const input = native.current;
    if (!input || input.matches(":disabled") || readOnly) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (close) setOpen(false);
  };
  const display = type === "date" && validDate(selected) ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${selected}T12:00:00Z`)) : selected;
  const reportChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const next = event.currentTarget.value;
    if (lastReported.current === next) return;
    lastReported.current = next;
    setValidation(""); setLocal(next);
    // Date/time inputs do not consistently reach React's change-event plugin when
    // updated by a picker. The input event has the same input target and event API.
    onChange?.(event as ChangeEvent<HTMLInputElement>);
  };
  return <div className="relative min-w-0">
    <input {...props} type={type} id={`${id}-native`} disabled={disabled} readOnly={readOnly} aria-invalid={!!validation || invalid || props["aria-invalid"] || undefined} value={value} defaultValue={defaultValue}
      className="mono-native-control" tabIndex={-1} aria-hidden="true"
      ref={(node) => { native.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }}
      onFocus={() => trigger.current?.focus()}
      onInvalid={(event) => { event.preventDefault(); setValidation(event.currentTarget.validationMessage); trigger.current?.focus(); props.onInvalid?.(event); }}
      onInput={(event) => { reportChange(event); props.onInput?.(event); }}
      onChange={reportChange} />
    <Popover.Root open={open} onOpenChange={(next) => { if (next) setLabel(props["aria-label"] ?? trigger.current?.labels?.[0]?.textContent?.trim() ?? label); setOpen(next); }}>
      <Popover.Trigger asChild><button ref={trigger} id={id} type="button" disabled={disabled || readOnly}
        aria-invalid={!!validation || invalid || props["aria-invalid"] || undefined}
        aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={[props["aria-describedby"], validation && `${id}-validation`].filter(Boolean).join(" ") || undefined}
        className={cn("flex w-full min-w-0 items-center rounded-xl border border-line bg-surface text-left text-ink shadow-xs transition-colors hover:border-primary/50 data-[state=open]:border-primary aria-[invalid=true]:border-error aria-[invalid=true]:hover:border-error aria-[invalid=true]:data-[state=open]:border-error", compact ? "gap-2 px-3" : "gap-3 px-3.5", controlSize[uiSize], focusRing, disabledControl, className)}>
        {!compact ? <Icon name={type === "date" ? "calendar" : "clock"} size="sm" className="shrink-0 text-primary" /> : null}
        <span className={cn("min-w-0 flex-1 truncate", !display && "text-muted")}>{display || props.placeholder || (type === "date" ? "Choose a date" : "Choose a time")}</span>
        <Icon name="chevronDown" size="sm" className="shrink-0 text-muted" />
      </button></Popover.Trigger>
      <Popover.Portal><Popover.Content aria-label={label} align="start" sideOffset={8} collisionPadding={12} className="mono-date-menu rounded-2xl border border-line bg-elevated p-4 text-ink shadow-xl" onEscapeKeyDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3"><p className="font-display text-lg">{label}</p><Popover.Close asChild><Button variant="ghost" size="icon" aria-label="Close picker"><Icon name="x" size="sm" /></Button></Popover.Close></div>
        {type === "date" ? <Calendar value={selected} min={String(props.min ?? "")} max={String(props.max ?? "")} onChoose={choose} />
          : <Clock value={selected} onChoose={choose} />}
        {selected && !props.required ? <Button variant="ghost" fullWidth className="mt-3" onClick={() => choose("")}>Clear {type === "date" ? "date" : "time"}</Button> : null}
      </Popover.Content></Popover.Portal>
    </Popover.Root>
    {validation ? <p role="alert" id={`${id}-validation`} className="mt-1.5 text-xs text-error">{validation}</p> : null}
  </div>;
}

function Calendar({ value, min, max, onChoose }: { value: string; min: string; max: string; onChoose: (value: string) => void }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const anchor = validDate(value) ? value : validDate(min) && today < min ? min : validDate(max) && today > max ? max : today;
  const [view, setView] = useState(() => new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`));
  const [focused, setFocused] = useState(anchor);
  const grid = useRef<HTMLDivElement>(null);
  const year = view.getUTCFullYear(), month = view.getUTCMonth();
  const firstYear = validDate(min) ? Number(min.slice(0, 4)) : Math.min(1900, year);
  const lastYear = validDate(max) ? Number(max.slice(0, 4)) : Math.max(now.getFullYear() + 20, year);
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(), offset = view.getUTCDay();
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);
  const move = (delta: number) => setView(new Date(Date.UTC(year, month + delta, 1, 12)));
  const keyboardDate = (date: string, key: string) => {
    const next = new Date(`${date}T12:00:00Z`);
    if (key === "PageUp" || key === "PageDown") next.setUTCMonth(next.getUTCMonth() + (key === "PageUp" ? -1 : 1), 1);
    else next.setUTCDate(next.getUTCDate() + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -next.getUTCDay(), End: 6 - next.getUTCDay() }[key] ?? 0));
    const target = ymd(next); if (!allowed(target)) return;
    setView(new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), 1, 12))); setFocused(target);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus());
  };
  return <div className="space-y-3">
    <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
      <Select aria-label="Month" value={month} onChange={(event) => setView(new Date(Date.UTC(year, Number(event.target.value), 1, 12)))}>{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</Select>
      <Select aria-label="Year" value={year} onChange={(event) => setView(new Date(Date.UTC(Number(event.target.value), month, 1, 12)))}>{Array.from({length:Math.max(1,lastYear-firstYear+1)},(_,i)=><option key={firstYear+i}>{firstYear+i}</option>)}</Select>
    </div>
    <div className="flex items-center justify-between gap-2"><Button variant="ghost" size="icon" aria-label="Previous month" disabled={!!min && ymd(new Date(Date.UTC(year, month, 0))) < min} onClick={() => move(-1)}><Icon name="chevronLeft" size="sm" /></Button><span className="text-sm text-muted">{months[month]} {year}</span><Button variant="ghost" size="icon" aria-label="Next month" disabled={!!max && ymd(new Date(Date.UTC(year, month + 1, 1))) > max} onClick={() => move(1)}><Icon name="chevronRight" size="sm" /></Button></div>
    <div ref={grid} role="grid" aria-label={`${months[month]} ${year}`}>
      <div role="row" className="mb-1 grid grid-cols-7 text-center text-xs text-muted">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(day=><span key={day} role="columnheader" className="py-2">{day}</span>)}</div>
      {Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => <div role="row" className="grid grid-cols-7 gap-1" key={week}>
        {Array.from({ length: 7 }, (_, weekday) => {
          const day = week * 7 + weekday - offset + 1;
          if (day < 1 || day > days) return <span role="gridcell" key={weekday} />;
          const date = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const firstAllowed = min && min.startsWith(`${year}-${String(month+1).padStart(2,"0")}`) ? min : `${year}-${String(month+1).padStart(2,"0")}-01`;
          const focusDate = allowed(focused) && focused.startsWith(`${year}-${String(month+1).padStart(2,"0")}`) ? focused : firstAllowed;
          return <button type="button" role="gridcell" data-date={date} key={day} disabled={!allowed(date)} aria-selected={date===value} tabIndex={date===focusDate?0:-1}
            aria-label={new Intl.DateTimeFormat("en",{dateStyle:"full",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`))}
            onFocus={() => setFocused(date)} onKeyDown={(event)=>{if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key)){event.preventDefault();keyboardDate(date,event.key);}}}
            onClick={() => onChoose(date)} className={cn("mono-calendar-day grid aspect-square place-items-center rounded-xl text-sm transition-colors hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-25",date===value?"bg-primary font-semibold text-primary-fg hover:bg-primary-hover":date===today?"bg-primary-tint font-semibold text-primary":"text-ink")}>{day}</button>;
        })}
      </div>)}
    </div>
    <Button variant="secondary" fullWidth disabled={!allowed(today)} onClick={() => onChoose(today)}>Today</Button>
  </div>;
}
function Clock({ value, onChoose }: { value: string; onChoose: (value: string) => void }) {
  const [hour, setHour] = useState(value.slice(0, 2) || "19"), [minute, setMinute] = useState(value.slice(3, 5) || "00");
  return <div className="space-y-4"><p className="rounded-2xl bg-primary-tint py-5 text-center font-display text-4xl tabular-nums text-primary">{hour}<span className="px-1 text-primary/50">:</span>{minute}</p>
    <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-sm text-muted">Hour · 24h<Select aria-label="Hour" value={hour} onChange={(event)=>setHour(event.target.value)}>{Array.from({length:24},(_,i)=><option key={i}>{String(i).padStart(2,"0")}</option>)}</Select></label><label className="space-y-2 text-sm text-muted">Minute<Select aria-label="Minute" value={minute} onChange={(event)=>setMinute(event.target.value)}>{Array.from({length:60},(_,i)=><option key={i}>{String(i).padStart(2,"0")}</option>)}</Select></label></div>
    <Button fullWidth onClick={()=>onChoose(`${hour}:${minute}`)}><Icon name="check" size="sm" />Set time</Button>
  </div>;
}
