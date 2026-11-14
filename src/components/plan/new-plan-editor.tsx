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
import { encodeDraft } from "@/lib/utils/draft";
import { localPlanSchema, type LocalPlan } from "@/lib/validation/new-plan";
import { PLAN_CATEGORIES, categoryFromPlanTitle, venueCategoryKey } from "@/lib/date/plan-discovery";
import { PLAN_STEPS, type PlanStep } from "@/lib/date/plan-steps";
import { ACTIVITY_PRESETS } from "@/lib/date/activity-palette";
import { saveNewPlanAction } from "@/server/actions/plan";
import type { ActionState } from "@/lib/utils/result";
import type { SavedPlaceOption } from "@/server/services/plan-service";

export function NewPlanEditor({ initial, userId, coupleId, timezone, savedPlaces }: {
  initial: LocalPlan; userId: string; coupleId: string; timezone: string; savedPlaces: SavedPlaceOption[];
}) {
  const storageKey = `mono:new-plan:${userId}:${coupleId}`;
  const { value: draft, setValue, clear } = useDraftState(storageKey, initial, localPlanSchema);
  const [step, setStep] = useState<PlanStep>("basics");
  const [pickerOpen, setPicker] = useState(false);
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
    setValue((current) => ({ ...current, activities: [...current.activities, { key: crypto.randomUUID(), title: title.trim(), duration: duration ? String(duration) : "", cost: "", savedPlaceId: "" }] }));
    setCustom("");
  };
  const categoryKey = venueCategoryKey(draft.category || categoryFromPlanTitle(draft.title));
  const index = PLAN_STEPS.indexOf(step);
  const activities = draft.activities.map((activity, sortOrder) => ({ id: activity.key, title: activity.title,
    durationMinutes: Number(activity.duration) || null, costCents: activity.cost ? Math.round(Number(activity.cost) * 100) : null,
    sortOrder, placeId: activity.savedPlaceId || null, placeName: null }));

  return <form action={save} className="space-y-6" noValidate>
    <PendingFields className="space-y-6">
      <PlanStepper dateId="new" current={step} variant="buttons" onStepChange={setStep} disabled={saving} />
      <div><h1 className="font-display text-2xl font-medium text-ink">{step === "basics" ? "The basics" : step === "budget" ? "Budget" : step === "activities" ? "Activities" : "Review your plan"}</h1>
        <p className="mt-1 text-sm text-muted">Not saved yet. Your changes stay on this device until you choose Save draft or Save date.</p></div>
      <FormFeedback state={state} />
      {step === "basics" ? <div className="space-y-5">
        <Field label="What's the plan?" htmlFor="new-title"><Input id="new-title" value={draft.title} maxLength={160}
          onChange={(event) => setValue((current) => ({ ...current, title: event.target.value, category: "" }))} placeholder="Give your date a name" /></Field>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type of plan">{PLAN_CATEGORIES.map((category) => <Chip key={category.key}
          selected={draft.category ? draft.category === category.key : categoryKey === category.key}
          onClick={() => setValue((current) => ({ ...current, category: category.key, title: !current.title.trim() || PLAN_CATEGORIES.some((item) => item.label === current.title) ? category.label : current.title }))}>{category.label}</Chip>)}</div>
        <div><p className="mb-2 text-sm font-medium text-ink">Where?</p>
          <Button variant="secondary" fullWidth onClick={() => setPicker(true)}>{draft.place ? `${draft.place.name} · Change` : "Find a place"}</Button>
          {draft.place?.address ? <p className="mt-2 text-xs text-muted">{draft.place.address}</p> : null}
          {draft.place ? <Button variant="link" onClick={() => patch("place", null)}>Remove place</Button> : null}
        </div>
        <div><p className="mb-2 text-sm font-medium text-ink">When?</p><DatePicker value={draft.date} onChange={(value) => patch("date", value ?? "")} timezone={timezone} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><TimeField label="Start time" value={draft.startTime} onChange={(value) => patch("startTime", value)} disabled={!draft.date} optional />
          <TimeField label="End time" value={draft.endTime} onChange={(value) => patch("endTime", value)} disabled={!draft.date} optional /></div>
        <Field label="Notes" htmlFor="new-notes" optional><Textarea id="new-notes" value={draft.notes} onChange={(event) => patch("notes", event.target.value)} rows={3} /></Field>
      </div> : null}
      {step === "budget" ? <div className="space-y-4">
        <Field label="Currency" htmlFor="new-currency"><Select id="new-currency" value={draft.currency} onChange={(event) => patch("currency", event.target.value)}>
          {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "SGD"].map((currency) => <option key={currency}>{currency}</option>)}</Select></Field>
        {([['expectedTotal', 'Expected total'], ['budgetMin', 'Budget minimum'], ['budgetMax', 'Budget maximum']] as const).map(([key, label]) =>
          <Field key={key} label={label} htmlFor={`new-${key}`} optional><Input id={`new-${key}`} type="number" min="0" step="0.01" value={draft[key]} onChange={(event) => patch(key, event.target.value)} /></Field>)}
        <Field label="Who's paying?" htmlFor="new-split"><Select id="new-split" value={draft.split} onChange={(event) => patch("split", event.target.value as ExpensePayer)}>
          <option value="SHARED">We&apos;ll split it</option><option value="OWNER">I&apos;ve got this one</option><option value="PARTNER">They&apos;ve got this one</option><option value="CUSTOM">We&apos;ll sort it per expense</option>
        </Select></Field>
      </div> : null}
      {step === "activities" ? <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{ACTIVITY_PRESETS.map((preset) => <Chip key={preset.key} onClick={() => add(preset.title, preset.durationMinutes)}>{preset.title}</Chip>)}</div>
        <div className="flex gap-2"><Input aria-label="Custom activity" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Add an activity" />
          <Button variant="secondary" onClick={() => add(custom)}>Add</Button></div>
        {draft.activities.map((activity, position) => <div key={activity.key} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <Field label="Activity" htmlFor={`activity-${activity.key}`}><Input id={`activity-${activity.key}`} value={activity.title} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, title: event.target.value } : row))} /></Field>
          <div className="grid grid-cols-2 gap-3">{([['duration', 'Minutes'], ['cost', 'Estimated cost']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`${activity.key}-${key}`} optional>
            <Input id={`${activity.key}-${key}`} type="number" min="0" value={activity[key]} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, [key]: event.target.value } : row))} /></Field>)}</div>
          <Field label="Venue" htmlFor={`${activity.key}-place`} optional><Select id={`${activity.key}-place`} value={activity.savedPlaceId} onChange={(event) => patch("activities", draft.activities.map((row) => row.key === activity.key ? { ...row, savedPlaceId: event.target.value } : row))}>
            <option value="">No separate venue</option>{savedPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</Select></Field>
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
        <ul className="space-y-2 text-sm">{draft.activities.map((activity) => <li key={activity.key}>{activity.title}{activity.duration ? ` · ${activity.duration} minutes` : ""}</li>)}</ul>
        {draft.notes ? <p className="whitespace-pre-wrap text-sm text-muted">{draft.notes}</p> : null}
      </div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {index > 0 ? <Button variant="ghost" onClick={() => setStep(PLAN_STEPS[index - 1])}>Back</Button> : <span />}
        <SubmitButton variant="secondary" name="mode" value="draft" pendingText="Saving…">Save draft</SubmitButton>
        {step === "review" ? <SubmitButton name="mode" value="plan" pendingText="Saving…" disabled={!draft.title.trim() || !draft.date}>Save date</SubmitButton>
          : <Button onClick={() => setStep(PLAN_STEPS[index + 1])}>Continue</Button>}
      </div>
    </PendingFields>
    <PlacePickerSheet open={pickerOpen} onClose={() => setPicker(false)} categoryKey={categoryKey}
      onCategoryChange={(key) => patch("category", key ?? "all")} activities={activities}
      onChooseLocal={(place) => patch("place", place)} onAddLocalIdea={(title) => add(title)} />
  </form>;
}
