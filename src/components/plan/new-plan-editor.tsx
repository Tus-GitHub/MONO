"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpensePayer, type CoupleMemberRole } from "@prisma/client";
import Link from "@/components/ui/app-link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { PendingFields } from "@/components/forms/pending-fields";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useDraftState } from "@/lib/hooks/use-draft-state";
import { useValidationFocus } from "@/lib/hooks/use-validation-focus";
import { encodeDraft } from "@/lib/utils/draft";
import { formatMoney } from "@/lib/utils/format";
import { todayYmdInTimeZone } from "@/lib/utils/timezone";
import { localPlanSchema, type LocalPlan } from "@/lib/validation/new-plan";
import { categoryFromPlanTitle, venueCategoryKey } from "@/lib/date/plan-discovery";
import { withStartTime } from "@/lib/date/plan-validation";
import { minutesLabel, nextEventTimes, orderedEvents, planAllocation, plannerErrors } from "@/lib/date/plan-allocation";
import { PlacePickerSheet } from "./place-picker-sheet";
import { AddStopSheet } from "./add-stop-sheet";
import { PlanEventCard } from "./plan-event-card";
import { saveEditedPlanAction, saveNewPlanAction } from "@/server/actions/plan";
import type { ActionState } from "@/lib/utils/result";
import type { SavedPlaceOption } from "@/server/services/plan-service";

export function NewPlanEditor({ initial, userId, coupleId, myRole, timezone, savedPlaces, existing }: {
  initial: LocalPlan; userId: string; coupleId: string; timezone: string; savedPlaces: SavedPlaceOption[];
  myRole: CoupleMemberRole;
  existing?: { id: string; version: number; status: string };
}) {
  const storageKey = existing ? `mono:edit-plan:${userId}:${coupleId}:${existing.id}:${existing.version}` : `mono:new-plan:${userId}:${coupleId}`;
  const { value: draft, setValue, clear, restored } = useDraftState<LocalPlan>(storageKey, initial, localPlanSchema);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [eventNotice, setEventNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useValidationFocus(formRef, showErrors, "planner");
  const saveKey = useRef("");
  const navigated = useRef<ActionState<{ id: string; href: string }> | null>(null);
  const router = useRouter();
  const firstEvent = draft.activities[0];
  const firstPlace = firstEvent?.place ?? (firstEvent?.savedPlaceId ? {
    name: savedPlaces.find((place) => place.id === firstEvent.savedPlaceId)?.name ?? "Saved place",
    selection: { mode: "saved" as const, savedPlaceId: firstEvent.savedPlaceId },
  } : null);
  const plan = { ...draft, place: firstEvent ? firstPlace : draft.place };
  const [state, save] = useActionState(async (previous: ActionState<{ id: string; href: string }>, form: FormData) => {
    const key = draft.key || saveKey.current || crypto.randomUUID();
    saveKey.current = key;
    const snapshot = { ...plan, key };
    setValue(snapshot);
    try { localStorage.setItem(storageKey, encodeDraft(JSON.stringify(initial), snapshot)); } catch { /* Storage is optional. */ }
    form.set("payload", JSON.stringify(snapshot));
    if (existing) {
      form.set("dateId", existing.id); form.set("version", String(existing.version));
      return saveEditedPlanAction(previous, form);
    }
    return saveNewPlanAction(previous, form);
  }, { status: "idle" });
  useEffect(() => {
    if (state.status === "success" && state.data && navigated.current !== state) {
      navigated.current = state; clear(); router.replace(state.data.href);
    }
  }, [state, clear, router]);

  const patch = <K extends keyof LocalPlan>(key: K, value: LocalPlan[K]) => setValue((current) => ({ ...current, [key]: value }));
  const touch = (key: string) => setTouched((current) => ({ ...current, [key]: true }));
  const allErrors = plannerErrors(plan, timezone);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([key]) => {
    if (showErrors || touched[key]) return true;
    const match = /^activities\.(\d+)\.(.+)$/.exec(key);
    if (match) {
      const field = match[2] === "costCents" ? "cost" : match[2] === "durationMinutes" ? "duration" : match[2];
      return Boolean(draft.activities[Number(match[1])]?.[field as keyof LocalPlan["activities"][number]]);
    }
    return key !== "activities" && Boolean(draft[key as keyof LocalPlan]);
  }));
  const totals = planAllocation(plan);
  const overviewReady = Object.keys(plannerErrors(plan, timezone, true)).length === 0;
  const availableSlot = nextEventTimes(plan, 5);
  const complete = Object.keys(allErrors).length === 0;
  const editEvent = (key: string, values: Partial<LocalPlan["activities"][number]>) => setValue((current) => ({ ...current,
    activities: current.activities.map((event) => event.key === key ? { ...event, ...values } : event) }));
  const findVenue = (key: string, title: string) => {
    setPickerCategory(venueCategoryKey(categoryFromPlanTitle(title))); setPickerTarget(key);
  };
  const addEvent = (title: string, minutes: number) => {
    const times = nextEventTimes(plan, minutes);
    if (!times || draft.activities.length >= 40) return;
    const key = crypto.randomUUID();
    const place = draft.activities.length ? null : draft.place;
    patch("activities", orderedEvents([...draft.activities, { key, title, duration: times.duration, cost: "", startTime: times.startTime,
      endTime: times.endTime, place, savedPlaceId: place?.selection.mode === "saved" ? place.selection.savedPlaceId : "" }]));
    setEditingEvent(key);
    setEventNotice(times.shortened ? `${title} has ${minutesLabel(Number(times.duration))} available. You can extend the date’s end time if you need longer.` : "");
    if (!place) findVenue(key, title);
  };
  const doneEditing = (key: string) => {
    const activities = orderedEvents(draft.activities);
    const index = activities.findIndex((event) => event.key === key);
    const nextErrors = plannerErrors({ ...plan, activities }, timezone);
    patch("activities", activities);
    if (Object.keys(nextErrors).some((field) => field.startsWith(`activities.${index}.`)) || nextErrors.allocation) {
      setShowErrors(true); return;
    }
    setEditingEvent(null); setEventNotice("");
  };
  const inputErrors = (key: string) => ({ invalid: Boolean(errors[key]), "aria-describedby": errors[key] ? `plan-${key}-error` : undefined, onBlur: () => touch(key) });

  return <form ref={formRef} action={save} className="min-w-0 space-y-6" noValidate
    onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }}
    onSubmit={(event) => {
      const mode = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      if (mode !== "draft" && mode !== "plan") { event.preventDefault(); return; }
      if (mode === "plan" && !complete) { event.preventDefault(); setShowErrors(true); }
    }}>
    <PendingFields className="min-w-0 space-y-6">
      <header className="space-y-2">
        <Link href="/plan" className="inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-primary"><Icon name="chevronLeft" size="sm" /> All plans</Link>
        <h1 className="font-display text-3xl text-ink">{existing ? "Edit your date" : "Plan a date"}</h1>
        <p className="text-sm text-muted">One day, a few favourite things. Make time for both of you.</p>
      </header>
      <FormFeedback state={state} />
      {restored ? <p role="status" className="text-xs text-muted">Your unfinished plan has been restored on this device.</p> : null}
      <section aria-labelledby="date-overview" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-3 border-b border-line bg-primary-tint px-4 py-3 sm:px-5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-fg">1</span>
          <h2 id="date-overview" className="font-display text-lg text-ink">The date</h2>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <Field label="Give your date a name" htmlFor="plan-title" errors={errors.title}>
            <Input id="plan-title" value={draft.title} maxLength={160} placeholder="Coffee, a movie & us" {...inputErrors("title")} onChange={(event) => patch("title", event.target.value)} />
          </Field>
          <Field label="Day" htmlFor="plan-date" errors={errors.date}>
            <Input id="plan-date" type="date" min={todayYmdInTimeZone(timezone)} value={draft.date} {...inputErrors("date")} onChange={(event) => patch("date", event.target.value)} />
          </Field>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <Field label="Starts at" htmlFor="plan-startTime" errors={errors.startTime} className="min-w-0">
              <Input id="plan-startTime" type="time" compact value={draft.startTime} {...inputErrors("startTime")} onChange={(event) => setValue((current) => withStartTime(current, event.target.value))} />
            </Field>
            <Field label="Ends at" htmlFor="plan-endTime" errors={errors.endTime} className="min-w-0">
              <Input id="plan-endTime" type="time" compact value={draft.endTime} {...inputErrors("endTime")} onChange={(event) => patch("endTime", event.target.value)} />
            </Field>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><Icon name="clock" size="sm" />
            {totals.totalMinutes ? `${minutesLabel(totals.totalMinutes)} together` : "Choose your overall time"}<span>· {timezone.replaceAll("_", " ")}</span>
          </p>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
            <Field label="Total budget" htmlFor="plan-expectedTotal" errors={errors.expectedTotal} className="min-w-0">
              <Input id="plan-expectedTotal" type="number" min="0" step="0.01" max="1000000" placeholder="e.g. 2500" value={draft.expectedTotal} {...inputErrors("expectedTotal")} onChange={(event) => patch("expectedTotal", event.target.value)} />
            </Field>
            <Field label="Currency" htmlFor="plan-currency" errors={errors.currency}>
              <Select id="plan-currency" value={draft.currency} {...inputErrors("currency")} onChange={(event) => patch("currency", event.target.value)}>
                {[...new Set([draft.currency, "INR", "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD"])].map((currency) => <option key={currency}>{currency}</option>)}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted">For all events together. A free date? Enter 0.</p>
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer text-sm font-medium text-muted">Notes & payment</summary>
            <div className="mt-4 space-y-4">
              <Field label="A note for us" htmlFor="plan-notes" optional errors={errors.notes}><Textarea id="plan-notes" rows={2} value={draft.notes} maxLength={4000} onChange={(event) => patch("notes", event.target.value)} /></Field>
              <Field label="Who's paying?" htmlFor="plan-split"><Select id="plan-split" value={draft.split} onChange={(event) => patch("split", event.target.value as ExpensePayer)}>
                <option value="SHARED">We&apos;ll split it</option><option value="OWNER">{myRole === "OWNER" ? "I’ll pay" : "My partner will pay"}</option><option value="PARTNER">{myRole === "PARTNER" ? "I’ll pay" : "My partner will pay"}</option><option value="CUSTOM">Decide per expense</option>
              </Select></Field>
              {draft.budgetMin || draft.budgetMax ? <div className="grid grid-cols-2 gap-3">{(["budgetMin", "budgetMax"] as const).map((field) => <Field key={field} label={field === "budgetMin" ? "Budget minimum" : "Budget maximum"} htmlFor={`plan-${field}`} optional errors={errors[field]}><Input id={`plan-${field}`} type="number" min="0" step="0.01" value={draft[field]} {...inputErrors(field)} onChange={(event) => patch(field, event.target.value)} /></Field>)}</div> : null}
            </div>
          </details>
        </div>
      </section>
      <section aria-labelledby="date-events" className="min-w-0 space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-tint text-sm font-semibold text-primary">2</span>
          <div className="min-w-0 flex-1"><h2 id="date-events" className="font-display text-xl text-ink">Your events</h2><p className="text-xs text-muted">Café, then a movie? Add them here in order.</p></div>
          <span className="shrink-0 text-xs text-muted">{draft.activities.length} / 40</span>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-paper p-3" aria-live="polite" aria-atomic="true">
          <div className="min-w-0"><p className="text-xs text-muted">Free time</p><p className="mt-1 font-medium text-ink">{totals.totalMinutes ? minutesLabel(Math.max(0, totals.freeMinutes)) : "Set your times"}</p><p className="mt-1 text-xs text-muted">Between your events</p></div>
          <div className="min-w-0 border-l border-line pl-3"><p className="text-xs text-muted">{totals.remainingCents != null && totals.remainingCents < 0 ? "Over budget" : "Budget left"}</p><p className={`mt-1 break-words font-medium ${totals.remainingCents != null && totals.remainingCents < 0 ? "text-error" : "text-primary"}`}>{totals.remainingCents == null ? "Set your budget" : formatMoney(Math.abs(totals.remainingCents), draft.currency)}</p><p className="mt-1 text-xs text-muted">{formatMoney(totals.usedCents, draft.currency)} allocated</p></div>
        </div>
        {allErrors.allocation ? <p role="alert" className="text-sm text-error">{allErrors.allocation[0]}</p> : null}
        {eventNotice ? <p role="status" className="rounded-lg bg-primary-tint p-3 text-sm text-ink">{eventNotice}</p> : null}
        <ol className="space-y-3">
          {draft.activities.map((event, index) => <li key={event.key} className="min-w-0"><PlanEventCard event={event} index={index} currency={draft.currency}
            savedPlaceName={savedPlaces.find((place) => place.id === event.savedPlaceId)?.name} expanded={editingEvent === event.key}
            errors={errors} onToggle={() => setEditingEvent(editingEvent === event.key ? null : event.key)} onChange={(values) => editEvent(event.key, values)}
            onTouch={touch} onFindVenue={() => findVenue(event.key, event.title)} onDone={() => doneEditing(event.key)}
            onRemove={() => { patch("activities", draft.activities.filter((item) => item.key !== event.key)); if (editingEvent === event.key) setEditingEvent(null); setEventNotice(""); }} /></li>)}
        </ol>
        {!draft.activities.length ? <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-center"><Icon name="calendarPlus" className="mx-auto text-primary" /><p className="mt-2 text-sm font-medium text-ink">A whole day, one simple plan</p><p className="mt-1 text-xs text-muted">Set the details above, then add your first event.</p></div> : null}
        <Button variant="secondary" fullWidth disabled={!overviewReady || !availableSlot || draft.activities.length >= 40} onClick={() => setAddingEvent(true)}><Icon name="plus" size="sm" />{draft.activities.length ? "Add another event" : "Add first event"}</Button>
        {!overviewReady ? <p className="text-xs text-muted">Add a name, day, time and budget to begin.</p> : !availableSlot ? <p className="text-xs text-muted">Your time is filled. Extend the date or shorten an event to add another.</p> : null}
        {errors.activities ? <p role="alert" className="text-sm text-error">{errors.activities[0]}</p> : null}
      </section>
      <div className="above-bottom-nav sticky z-10 space-y-2 rounded-xl border border-line bg-paper p-3 shadow-sm lg:bottom-0">
        <div className={existing && existing.status !== "DRAFT" ? "grid" : "grid grid-cols-2 gap-2"}>
          {!existing || existing.status === "DRAFT" ? <SubmitButton variant="secondary" name="mode" value="draft" pendingText="Saving…" className="min-w-0">Save draft</SubmitButton> : null}
          <SubmitButton name="mode" value="plan" pendingText="Saving…" disabled={!complete} className="min-w-0">{existing && existing.status !== "DRAFT" ? "Save changes" : "Save date"}</SubmitButton>
        </div>
        <p className="text-center text-xs text-muted">{complete ? "Ready to share with your partner." : "Complete the details and event estimates to save your date."}</p>
      </div>
      <p className="text-center text-xs text-faint">Your plan is shared when you save. Selecting a place doesn&apos;t make a booking.</p>
    </PendingFields>
    {addingEvent ? <AddStopSheet onClose={() => setAddingEvent(false)} onChoose={addEvent} /> : null}
    <PlacePickerSheet open={pickerTarget !== null} onClose={() => setPickerTarget(null)} categoryKey={pickerCategory} onCategoryChange={setPickerCategory}
      activities={[]} showIdeas={false} autoLocationKey={pickerTarget ?? undefined}
      onChooseLocal={(place) => { if (pickerTarget) editEvent(pickerTarget, { place, savedPlaceId: place.selection.mode === "saved" ? place.selection.savedPlaceId : "" }); }} />
  </form>;
}
