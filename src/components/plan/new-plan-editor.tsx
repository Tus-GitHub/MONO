"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpensePayer } from "@prisma/client";
import { Icon } from "@/components/ui/icon";
import { itineraryPlan, scheduleItinerary } from "@/lib/date/itinerary";
import { PlacePickerSheet } from "./place-picker-sheet";
import { DatePicker } from "./date-picker";
import { TimeField } from "./time-field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { PendingFields } from "@/components/forms/pending-fields";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useDraftState } from "@/lib/hooks/use-draft-state";
import { useValidationFocus } from "@/lib/hooks/use-validation-focus";
import { encodeDraft } from "@/lib/utils/draft";
import { localPlanSchema, type LocalPlan } from "@/lib/validation/new-plan";
import { PLAN_CATEGORIES, categoryFromPlanTitle, venueCategoryKey } from "@/lib/date/plan-discovery";

import { afterMinutes, planStepErrors } from "@/lib/date/plan-validation";
import { AddStopSheet, STOP_CHOICES } from "./add-stop-sheet";
import { saveNewPlanAction } from "@/server/actions/plan";
import type { ActionState } from "@/lib/utils/result";
import type { SavedPlaceOption } from "@/server/services/plan-service";

export function NewPlanEditor({ initial, userId, coupleId, timezone, savedPlaces }: {
  initial: LocalPlan; userId: string; coupleId: string; timezone: string; savedPlaces: SavedPlaceOption[];
}) {
  const storageKey = `mono:new-plan:${userId}:${coupleId}`;
  const { value: draft, setValue, clear } = useDraftState<LocalPlan>(storageKey, initial, localPlanSchema);
  const plan = itineraryPlan(draft);
  const [pickerOpen, setPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useValidationFocus(formRef, showErrors, "itinerary");
  const [addingStop, setAddingStop] = useState(false);
  const [editingStop, setEditingStop] = useState<string | null>(null);
  const [changingDay, setChangingDay] = useState(false);
  const saveKey = useRef("");
  const navigated = useRef<string | null>(null);
  const router = useRouter();
  const [state, save] = useActionState(async (previous: ActionState<{ id: string; href: string }>, form: FormData) => {
    const key = draft.key || saveKey.current || crypto.randomUUID();
    saveKey.current = key;
    const snapshot = { ...itineraryPlan(draft), key };
    setValue(snapshot);
    try { localStorage.setItem(storageKey, encodeDraft(JSON.stringify(initial), snapshot)); } catch { /* Editing still works without storage. */ }
    form.set("payload", JSON.stringify(snapshot));
    return saveNewPlanAction(previous, form);
  }, { status: "idle" });
  useEffect(() => {
    if (state.status === "success" && state.data && navigated.current !== state.data.id) {
      navigated.current = state.data.id;
      clear();
      router.replace(state.data.href);
    }
  }, [state, clear, router]);

  const patch = <K extends keyof LocalPlan>(key: K, value: LocalPlan[K]) => setValue((current) => ({ ...current, [key]: value }));
  const add = (title: string, duration?: number, findVenue = false) => {
    if (!title.trim() || draft.activities.length >= 40) return;
    const key = crypto.randomUUID();
    setValue((current) => {
      const last = current.activities.at(-1);
      const startTime = last ? afterMinutes(last.endTime || afterMinutes(last.startTime || current.startTime, Number(last.duration) || 60), 15) : current.startTime;
      return { ...current, activities: [...current.activities, { key, title: title.trim(), duration: duration ? String(duration) : "", cost: "", savedPlaceId: !last && current.place?.selection.mode === "saved" ? current.place.selection.savedPlaceId : "", place: !last ? current.place : null, startTime, endTime: startTime ? afterMinutes(startTime, duration ?? 60) : "" }] };
    });
    if (findVenue) { setPickerTarget(key); setPickerCategory(venueCategoryKey(categoryFromPlanTitle(title))); setPicker(true); }
  };
  const categoryKey = venueCategoryKey(draft.category || categoryFromPlanTitle(draft.title));
  const errors = showErrors ? planStepErrors(plan, "review", timezone) : {};
  const error = (key: string) => errors[key]?.length ? <p role="alert" className="text-xs text-error">{errors[key].join(" ")}</p> : null;
  const activities = draft.activities.map((activity, sortOrder) => ({ id: activity.key, title: activity.title,
    durationMinutes: Number(activity.duration) || null, costCents: activity.cost ? Math.round(Number(activity.cost) * 100) : null,
    sortOrder, placeId: activity.savedPlaceId || null, placeName: null }));

  return <form ref={formRef} action={save} className="space-y-6" noValidate onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }} onSubmit={(event) => {
    const mode = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    if (mode !== "plan" && mode !== "draft") { event.preventDefault(); return; }
    if (mode === "draft") return;
    if (Object.keys(planStepErrors(plan, "review", timezone)).length) { event.preventDefault(); setShowErrors(true); }
  }}>
    <PendingFields className="space-y-6">
      <header className="space-y-3 rounded-2xl border border-primary/25 bg-primary-tint p-5 sm:p-7">
        <p className="flex items-center gap-2 text-sm text-primary"><Icon name="heart" size="sm" /> A little adventure for two</p>
        <h1 className="font-display text-3xl text-ink">Make a day of it.</h1>
        <p className="text-sm text-muted">Pick your places. Connect the moments. Make it yours.</p>
        <div aria-label="Your date route" className="flex flex-wrap items-center gap-2 text-sm">{(draft.activities.length ? draft.activities.map((stop) => stop.title) : ["Café", "Arcade", "Movie", "Hotel"]).map((title, index) => <span key={index} className="inline-flex items-center gap-2">{index ? <Icon name="arrowRight" size="sm" /> : null}<span className="rounded-full border border-line bg-paper px-3 py-1">{title}</span></span>)}</div>
      </header>
      <FormFeedback state={state} />
      <div className="space-y-5">
        <div><p className="mb-2 text-sm font-medium text-ink">When?</p>
          {draft.date && !changingDay && !errors.date ? <Button variant="secondary" fullWidth onClick={() => setChangingDay(true)}><Icon name="calendar" size="sm" />{new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${draft.date}T12:00:00Z`))}<span className="text-muted">· Change day</span></Button>
            : <DatePicker value={draft.date} onChange={(value) => { patch("date", value ?? ""); if (value) setChangingDay(false); }} timezone={timezone} invalid={Boolean(errors.date)} />}
          {error("date")}
        </div>
      </div>
      <section aria-label="Date itinerary" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-xl">Your little route · {draft.activities.length} stops</h2>{draft.activities.length > 1 ? <Button variant="ghost" size="sm" disabled={!draft.activities[0].startTime} onClick={() => patch("activities", scheduleItinerary(draft.activities, draft.activities[0].startTime!))}><Icon name="clock" size="sm" /> Arrange times · 15 min between stops</Button> : null}</div>
        {draft.activities.map((activity, position) => <div key={activity.key} className="mono-itinerary-stop relative ml-4 min-w-0 space-y-3 rounded-2xl border border-line border-l-primary bg-surface p-4 pl-6">
          <span className="absolute -left-4 top-4 grid size-8 place-items-center rounded-full border border-primary/25 bg-paper text-sm font-semibold text-primary">{position + 1}</span>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary"><Icon name={STOP_CHOICES.find((choice) => choice.title === activity.title)?.icon ?? "heart"} /></span>
            <div className="min-w-0 flex-1"><h3 className="font-medium text-ink">{activity.title}</h3>
              <p className="truncate text-sm text-muted">{activity.place?.name ?? savedPlaces.find((place) => place.id === activity.savedPlaceId)?.name ?? "A place to discover"}</p>
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-primary" onClick={() => setEditingStop(activity.key)}><Icon name="clock" size="sm" />{activity.startTime ? `${activity.startTime}–${activity.endTime || "…"}` : "Set a time"}{activity.duration ? ` · ${activity.duration} min` : ""}</button>
            </div>
            <Button variant="ghost" size="icon" aria-label={`Edit stop ${position + 1}`} aria-expanded={editingStop === activity.key} onClick={() => setEditingStop(editingStop === activity.key ? null : activity.key)}><Icon name={editingStop === activity.key ? "chevronUp" : "chevronDown"} size="sm" /></Button>
          </div>
          {!activity.place && !activity.savedPlaceId && editingStop !== activity.key ? <Button variant="secondary" size="sm" onClick={() => { setPickerTarget(activity.key); setPickerCategory(venueCategoryKey(categoryFromPlanTitle(activity.title))); setPicker(true); }}><Icon name="mapPin" size="sm" />Find a venue</Button> : null}
          {editingStop === activity.key || Object.keys(errors).some((key) => key.startsWith(`activities.${position}.`)) ? <div className="space-y-3 border-t border-line pt-4">
          <Field label={`Stop ${position + 1}`} htmlFor={`activity-${activity.key}`} errors={errors[`activities.${position}.title`]}><Input invalid={Boolean(errors[`activities.${position}.title`])} id={`activity-${activity.key}`} value={activity.title} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, title: event.target.value } : row))} /></Field>
          <div className="space-y-2"><p className="text-sm font-medium text-ink">Venue for this stop</p>
            <Button variant="secondary" className="max-w-full" onClick={() => { setPickerTarget(activity.key); setPickerCategory(venueCategoryKey(categoryFromPlanTitle(activity.title))); setPicker(true); }}><span className="truncate">{activity.place?.name ?? savedPlaces.find((place) => place.id === activity.savedPlaceId)?.name ?? "Find a venue"}</span></Button>
            {activity.place?.address ? <p className="text-xs text-muted">{activity.place.address}</p> : null}
            {(activity.place || activity.savedPlaceId) ? <Button variant="link" onClick={() => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, place: null, savedPlaceId: "" } : row))}>Remove venue</Button> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2"><TimeField label={`Stop ${position + 1} start`} value={activity.startTime ?? ""} disabled={!draft.date}
            onChange={(value) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, startTime: value, endTime: !row.endTime || row.endTime === afterMinutes(row.startTime ?? "", Number(row.duration) || 60) ? afterMinutes(value, Number(row.duration) || 60) : row.endTime } : row))} optional errors={errors[`activities.${position}.startTime`]} />
            <TimeField label={`Stop ${position + 1} end`} value={activity.endTime ?? ""} disabled={!draft.date} presets={[]} onChange={(value) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, endTime: value } : row))} optional errors={errors[`activities.${position}.endTime`]} /></div>
          <details className="text-sm"><summary className="cursor-pointer text-muted">Duration & estimated cost</summary><div className="mt-3">          <div className="grid grid-cols-2 gap-3">{([['duration', 'Minutes'], ['cost', 'Estimated cost']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`${activity.key}-${key}`} optional errors={errors[`activities.${position}.${key === "cost" ? "costCents" : "durationMinutes"}`]}>
            <Input invalid={Boolean(errors[`activities.${position}.${key === "cost" ? "costCents" : "durationMinutes"}`])} id={`${activity.key}-${key}`} type="number" min="0" value={activity[key]} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, [key]: event.target.value } : row))} /></Field>)}</div>
</div></details>
          <div className="flex gap-3"><Button variant="ghost" disabled={!position} onClick={() => { const next = [...draft.activities]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; patch("activities", next); }}>Move up</Button>
            <Button variant="ghost" onClick={() => patch("activities", draft.activities.filter((row) => row.key !== activity.key))}>Remove</Button></div>
          <Button variant="secondary" fullWidth onClick={() => setEditingStop(null)}>Done editing</Button>
          </div> : null}
        </div>)}
        <Button variant="secondary" fullWidth className="border-dashed py-6" disabled={draft.activities.length >= 40} onClick={() => setAddingStop(true)}><Icon name="plus" size="sm" />{draft.activities.length ? "Add a stop" : "Add your first stop"}</Button>
        {!draft.activities.length ? <p className="text-center text-sm text-muted">A coffee, a movie, a little detour. Start with one.</p> : null}
        <p className="text-xs text-faint">Times are in {timezone}. Tap a stop to adjust its details.</p>
      </section>
      <details className="rounded-xl border border-line p-4" open={showErrors || undefined}><summary className="cursor-pointer font-medium text-muted">Name, budget & a note for us · optional</summary><div className="mt-4 space-y-4">
        <Field label="Date name" htmlFor="new-title" errors={errors.title}><Input id="new-title" value={draft.title} maxLength={160} invalid={Boolean(errors.title)}
          onChange={(event) => setValue((current) => ({ ...current, title: event.target.value, category: "" }))} placeholder="Our day out" /></Field>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type of plan">{PLAN_CATEGORIES.map((category) => <Chip key={category.key}
          selected={draft.category ? draft.category === category.key : categoryKey === category.key}
          onClick={() => setValue((current) => ({ ...current, category: category.key, title: !current.title.trim() || PLAN_CATEGORIES.some((item) => item.label === current.title) ? category.label : current.title }))}>{category.label}</Chip>)}</div>

        <Field label="Notes" htmlFor="new-notes" optional errors={errors.notes}><Textarea id="new-notes" value={draft.notes} maxLength={4000} onChange={(event) => patch("notes", event.target.value)} rows={2} /></Field>
      <div className="space-y-4">
        <Field label="Currency" htmlFor="new-currency" errors={errors.currency}><Select id="new-currency" invalid={Boolean(errors.currency)} value={draft.currency} onChange={(event) => patch("currency", event.target.value)}>
          {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "SGD"].map((currency) => <option key={currency}>{currency}</option>)}</Select></Field>
        {([['expectedTotal', 'Expected total'], ['budgetMin', 'Budget minimum'], ['budgetMax', 'Budget maximum']] as const).map(([key, label]) =>
          <Field key={key} label={label} htmlFor={`new-${key}`} optional errors={errors[key]}><Input invalid={Boolean(errors[key])} id={`new-${key}`} type="number" min="0" step="0.01" value={draft[key]} onChange={(event) => patch(key, event.target.value)} /></Field>)}
        <Field label="Who's paying?" htmlFor="new-split"><Select id="new-split" value={draft.split} onChange={(event) => patch("split", event.target.value as ExpensePayer)}>
          <option value="SHARED">We&apos;ll split it</option><option value="OWNER">I&apos;ve got this one</option><option value="PARTNER">They&apos;ve got this one</option><option value="CUSTOM">We&apos;ll sort it per expense</option>
        </Select></Field>
      </div></div></details>
      <div className="above-bottom-nav sticky z-10 space-y-3 rounded-xl border border-line bg-paper p-4 lg:bottom-0">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{plan.date || "Choose your day"}{plan.startTime ? ` · ${plan.startTime}–${plan.endTime || "…"}` : ""}</p><div className="flex gap-2"><SubmitButton variant="secondary" name="mode" value="draft" pendingText="Saving…">Save draft</SubmitButton><SubmitButton name="mode" value="plan" pendingText="Saving…" disabled={!draft.activities.length}>Save date</SubmitButton></div></div>
        <p className="text-xs text-faint">Only saved when you choose Save. Adding a venue does not book it.</p>
      </div>
      {Object.keys(errors).length ? <p role="alert" className="text-sm text-error">{Object.values(errors).flat().join(" ")}</p> : null}
    </PendingFields>
    {addingStop ? <AddStopSheet onClose={() => setAddingStop(false)} onChoose={(title, minutes) => add(title, minutes, true)} /> : null}
    <PlacePickerSheet open={pickerOpen} onClose={() => { setPicker(false); setPickerTarget(null); }} categoryKey={pickerTarget ? pickerCategory : categoryKey}
      onCategoryChange={(key) => { if (pickerTarget) setPickerCategory(key); else patch("category", key ?? "all"); }} activities={activities}
      onChooseLocal={(place) => {
        if (pickerTarget) patch("activities", draft.activities.map((stop) => stop.key === pickerTarget ? { ...stop, place, savedPlaceId: place.selection.mode === "saved" ? place.selection.savedPlaceId : "" } : stop));
        else setValue((current) => ({ ...current, place, activities: current.activities.length ? current.activities.map((stop, index) => index ? stop : { ...stop, place, savedPlaceId: place.selection.mode === "saved" ? place.selection.savedPlaceId : "" }) : [{ key: crypto.randomUUID(), title: place.name.slice(0, 120), duration: "60", cost: "", savedPlaceId: place.selection.mode === "saved" ? place.selection.savedPlaceId : "", place }] }));
      }} onAddLocalIdea={(title) => add(title)} />
  </form>;
}
