"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpensePayer } from "@prisma/client";
import { PlanStepper } from "./plan-stepper";
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
import { PLAN_STEPS, type PlanStep } from "@/lib/date/plan-steps";
import { afterMinutes, withStartTime, planStepErrors } from "@/lib/date/plan-validation";
import { ACTIVITY_PRESETS } from "@/lib/date/activity-palette";
import { saveNewPlanAction } from "@/server/actions/plan";
import type { ActionState } from "@/lib/utils/result";
import type { SavedPlaceOption } from "@/server/services/plan-service";

export function NewPlanEditor({ initial, userId, coupleId, timezone, savedPlaces }: {
  initial: LocalPlan; userId: string; coupleId: string; timezone: string; savedPlaces: SavedPlaceOption[];
}) {
  const storageKey = `mono:new-plan:${userId}:${coupleId}`;
  const { value: draft, setValue, clear } = useDraftState<LocalPlan>(storageKey, initial, localPlanSchema);
  const [step, setStep] = useState<PlanStep>("basics");
  const [pickerOpen, setPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useValidationFocus(formRef, showErrors, step);
  const [custom, setCustom] = useState("");
  const saveKey = useRef("");
  const navigated = useRef<string | null>(null);
  const router = useRouter();
  const [state, save, saving] = useActionState(async (previous: ActionState<{ id: string; href: string }>, form: FormData) => {
    const key = draft.key || saveKey.current || crypto.randomUUID();
    saveKey.current = key;
    const snapshot = { ...draft, key };
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
  const add = (title: string, duration?: number) => {
    if (!title.trim()) return;
    setValue((current) => {
      const last = current.activities.at(-1);
      const startTime = last ? last.endTime || afterMinutes(last.startTime || current.startTime, Number(last.duration) || 60) : current.startTime;
      return { ...current, activities: [...current.activities, { key: crypto.randomUUID(), title: title.trim(), duration: duration ? String(duration) : "", cost: "", savedPlaceId: "", startTime, endTime: startTime ? afterMinutes(startTime, duration ?? 60) : "" }] };
    });
    setCustom("");
  };
  const categoryKey = venueCategoryKey(draft.category || categoryFromPlanTitle(draft.title));
  const index = PLAN_STEPS.indexOf(step);
  const errors = showErrors ? planStepErrors(draft, step, timezone) : {};
  const go = (target: PlanStep) => {
    const targetIndex = PLAN_STEPS.indexOf(target);
    if (targetIndex > index) for (const previous of PLAN_STEPS.slice(0, targetIndex)) {
      if (Object.keys(planStepErrors(draft, previous, timezone)).length) { setStep(previous); setShowErrors(true); return; }
    }
    setShowErrors(false); setStep(target);
  };
  const error = (key: string) => errors[key]?.length ? <p role="alert" className="text-xs text-error">{errors[key].join(" ")}</p> : null;
  const activities = draft.activities.map((activity, sortOrder) => ({ id: activity.key, title: activity.title,
    durationMinutes: Number(activity.duration) || null, costCents: activity.cost ? Math.round(Number(activity.cost) * 100) : null,
    sortOrder, placeId: activity.savedPlaceId || null, placeName: null }));

  return <form ref={formRef} action={save} className="space-y-6" noValidate onSubmit={(event) => {
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "plan") return;
    for (const check of PLAN_STEPS.slice(0, -1)) if (Object.keys(planStepErrors(draft, check, timezone)).length) { event.preventDefault(); setStep(check); setShowErrors(true); return; }
  }}>
    <PendingFields className="space-y-6">
      <PlanStepper dateId="new" current={step} variant="buttons" onStepChange={go} disabled={saving} />
      <div><h1 className="font-display text-2xl font-medium text-ink">{step === "basics" ? "The basics" : step === "budget" ? "Budget" : step === "activities" ? "Events" : "Review your plan"}</h1>
        <p className="mt-1 text-sm text-muted">Not saved yet. Your changes stay on this device until you choose Save draft or Save date.</p></div>
      <FormFeedback state={state} />
      {step === "basics" ? <div className="space-y-5">
        <Field label="What's the plan?" htmlFor="new-title" errors={errors.title}><Input id="new-title" value={draft.title} maxLength={160} invalid={Boolean(errors.title)}
          onChange={(event) => setValue((current) => ({ ...current, title: event.target.value, category: "" }))} placeholder="Give your date a name" /></Field>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type of plan">{PLAN_CATEGORIES.map((category) => <Chip key={category.key}
          selected={draft.category ? draft.category === category.key : categoryKey === category.key}
          onClick={() => setValue((current) => ({ ...current, category: category.key, title: !current.title.trim() || PLAN_CATEGORIES.some((item) => item.label === current.title) ? category.label : current.title }))}>{category.label}</Chip>)}</div>
        <div><p className="mb-2 text-sm font-medium text-ink">First venue</p>
          <Button variant="secondary" fullWidth onClick={() => { setPickerTarget(null); setPicker(true); }}><span className="truncate">{draft.place ? `${draft.place.name} · Change` : "Find a place"}</span></Button>
          {draft.place?.address ? <p className="mt-2 text-xs text-muted">{draft.place.address}</p> : null}
          {draft.place ? <Button variant="link" onClick={() => patch("place", null)}>Remove place</Button> : null}
        </div>
        <div><p className="mb-2 text-sm font-medium text-ink">When?</p><DatePicker value={draft.date} onChange={(value) => { patch("date", value ?? ""); }} timezone={timezone} invalid={Boolean(errors.date)} />{error("date")}</div>
        <div className="grid gap-4 sm:grid-cols-2"><TimeField label="Start time" value={draft.startTime} onChange={(value) => setValue((current) => withStartTime(current, value))} disabled={!draft.date} errors={errors.startTime} />
          <TimeField label="End time" value={draft.endTime} onChange={(value) => patch("endTime", value)} disabled={!draft.date} presets={draft.startTime ? [{ label: "2 hours later", value: afterMinutes(draft.startTime) }] : []} errors={errors.endTime} /></div>
        <Field label="Notes" htmlFor="new-notes" optional errors={errors.notes}><Textarea invalid={Boolean(errors.notes)} id="new-notes" value={draft.notes} onChange={(event) => patch("notes", event.target.value)} rows={3} /></Field>
      </div> : null}
      {step === "budget" ? <div className="space-y-4">
        <Field label="Currency" htmlFor="new-currency" errors={errors.currency}><Select id="new-currency" invalid={Boolean(errors.currency)} value={draft.currency} onChange={(event) => patch("currency", event.target.value)}>
          {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "SGD"].map((currency) => <option key={currency}>{currency}</option>)}</Select></Field>
        {([['expectedTotal', 'Expected total'], ['budgetMin', 'Budget minimum'], ['budgetMax', 'Budget maximum']] as const).map(([key, label]) =>
          <Field key={key} label={label} htmlFor={`new-${key}`} optional errors={errors[key]}><Input invalid={Boolean(errors[key])} id={`new-${key}`} type="number" min="0" step="0.01" value={draft[key]} onChange={(event) => patch(key, event.target.value)} /></Field>)}
        <Field label="Who's paying?" htmlFor="new-split"><Select id="new-split" value={draft.split} onChange={(event) => patch("split", event.target.value as ExpensePayer)}>
          <option value="SHARED">We&apos;ll split it</option><option value="OWNER">I&apos;ve got this one</option><option value="PARTNER">They&apos;ve got this one</option><option value="CUSTOM">We&apos;ll sort it per expense</option>
        </Select></Field>
      </div> : null}
      {step === "activities" ? <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{ACTIVITY_PRESETS.map((preset) => <Chip key={preset.key} onClick={() => add(preset.title, preset.durationMinutes)}>{preset.title}</Chip>)}</div>
        <div className="flex gap-2"><Input className="min-w-0" aria-label="Custom event" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Add an event" />
          <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={() => add(custom)}>Add</Button></div>
        {draft.activities.map((activity, position) => <div key={activity.key} className="space-y-3 min-w-0 rounded-xl border border-line bg-surface p-4">
          <Field label="Event" htmlFor={`activity-${activity.key}`} errors={errors[`activities.${position}.title`]}><Input invalid={Boolean(errors[`activities.${position}.title`])} id={`activity-${activity.key}`} value={activity.title} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, title: event.target.value } : row))} /></Field>
          <div className="grid grid-cols-2 gap-3">{([['duration', 'Minutes'], ['cost', 'Estimated cost']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`${activity.key}-${key}`} optional errors={errors[`activities.${position}.${key === "cost" ? "costCents" : "durationMinutes"}`]}>
            <Input invalid={Boolean(errors[`activities.${position}.${key === "cost" ? "costCents" : "durationMinutes"}`])} id={`${activity.key}-${key}`} type="number" min="0" value={activity[key]} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, [key]: event.target.value } : row))} /></Field>)}</div>
          <div className="space-y-2"><p className="text-sm font-medium text-ink">Venue for this event</p>
            <Button variant="secondary" className="max-w-full" onClick={() => { setPickerTarget(activity.key); setPickerCategory(venueCategoryKey(categoryFromPlanTitle(activity.title))); setPicker(true); }}><span className="truncate">{activity.place?.name ?? savedPlaces.find((place) => place.id === activity.savedPlaceId)?.name ?? "Find a venue"}</span></Button>
            {activity.place?.address ? <p className="text-xs text-muted">{activity.place.address}</p> : null}
            {(activity.place || activity.savedPlaceId) ? <Button variant="link" onClick={() => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, place: null, savedPlaceId: "" } : row))}>Remove venue</Button> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2"><TimeField label="Event start time" value={activity.startTime ?? ""} disabled={!draft.date}
            onChange={(value) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, startTime: value, endTime: !row.endTime || row.endTime === afterMinutes(row.startTime ?? "", Number(row.duration) || 60) ? afterMinutes(value, Number(row.duration) || 60) : row.endTime } : row))} optional errors={errors[`activities.${position}.startTime`]} />
            <TimeField label="Event end time" value={activity.endTime ?? ""} disabled={!draft.date} presets={[]} onChange={(value) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, endTime: value } : row))} optional errors={errors[`activities.${position}.endTime`]} /></div>
          <div className="flex gap-3"><Button variant="ghost" disabled={!position} onClick={() => { const next = [...draft.activities]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; patch("activities", next); }}>Move up</Button>
            <Button variant="ghost" onClick={() => patch("activities", draft.activities.filter((row) => row.key !== activity.key))}>Remove</Button></div>
        </div>)}
      </div> : null}
      {step === "review" ? <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl text-ink">{draft.title || "Untitled plan"}</h2>
        <p className="text-sm text-muted">{draft.date || "Choose a date"}{draft.startTime ? ` · ${draft.startTime}` : ""}</p>
        <p className="text-sm text-ink">{draft.place?.name ?? "No venue selected"}</p>
        {draft.place?.address ? <p className="text-xs text-muted">{draft.place.address}</p> : null}
        <p className="text-sm text-muted">Budget: {draft.expectedTotal ? `${draft.currency} ${draft.expectedTotal}` : "Not set"}</p>
        <ul className="space-y-2 text-sm">{draft.activities.map((activity) => <li key={activity.key}>{activity.title}{activity.place?.name ? ` · ${activity.place.name}` : ""}{activity.startTime ? ` · ${activity.startTime}${activity.endTime ? `–${activity.endTime}` : ""}` : ""}{activity.duration ? ` · ${activity.duration} minutes` : ""}</li>)}</ul>
        {draft.notes ? <p className="whitespace-pre-wrap text-sm text-muted">{draft.notes}</p> : null}
      </div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {index > 0 ? <Button variant="ghost" onClick={() => go(PLAN_STEPS[index - 1])}>Back</Button> : <span />}
        <SubmitButton variant="secondary" name="mode" value="draft" pendingText="Saving…">Save draft</SubmitButton>
        {step === "review" ? <SubmitButton name="mode" value="plan" pendingText="Saving…" disabled={!draft.title.trim() || !draft.date}>Save date</SubmitButton>
          : <Button onClick={() => go(PLAN_STEPS[index + 1])}>Continue</Button>}
      </div>
      {Object.keys(errors).length ? <p role="alert" className="text-sm text-error">Check the highlighted fields before continuing.</p> : null}
    </PendingFields>
    <PlacePickerSheet open={pickerOpen} onClose={() => { setPicker(false); setPickerTarget(null); }} categoryKey={pickerTarget ? pickerCategory : categoryKey}
      onCategoryChange={(key) => { if (pickerTarget) setPickerCategory(key); else patch("category", key ?? "all"); }} activities={activities}
      onChooseLocal={(place) => {
        if (pickerTarget) patch("activities", draft.activities.map((stop) => stop.key === pickerTarget ? { ...stop, place, savedPlaceId: place.selection.mode === "saved" ? place.selection.savedPlaceId : "" } : stop));
        else setValue((current) => ({ ...current, place, activities: current.activities.length ? current.activities : [{ key: crypto.randomUUID(), title: place.name.slice(0, 120), duration: "60", cost: "", savedPlaceId: place.selection.mode === "saved" ? place.selection.savedPlaceId : "", place }] }));
      }} onAddLocalIdea={(title) => add(title)} />
  </form>;
}
