"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "./date-picker";
import { TimeField } from "./time-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PendingFields } from "@/components/forms/pending-fields";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useDraftState } from "@/lib/hooks/use-draft-state";
import { localPlanSchema, type LocalPlan } from "@/lib/validation/new-plan";
import { dateBasicsSchema } from "@/lib/validation/date";
import { todayYmdInTimeZone } from "@/lib/utils/timezone";
import { afterMinutes, withStartTime } from "@/lib/date/plan-validation";
import { formatMoney } from "@/lib/utils/format";
import { saveNewPlanAction } from "@/server/actions/plan";
import type { ActionState } from "@/lib/utils/result";

/** Everything except the new schedule is a read-only snapshot and is reloaded on the server. */
export function RecreatePlanEditor({ initial, sourceId, userId, coupleId, timezone }: {
  initial: LocalPlan; sourceId: string; userId: string; coupleId: string; timezone: string;
}) {
  const { value: draft, setValue, clear } = useDraftState<LocalPlan>(`mono:recreate:${userId}:${coupleId}:${sourceId}`, initial, localPlanSchema);
  const router = useRouter();
  const saveKey = useRef("");
  const navigated = useRef(false);
  const [state, save] = useActionState(async (previous: ActionState<{ id: string; href: string }>, form: FormData) => {
    const key = draft.key || saveKey.current || crypto.randomUUID();
    saveKey.current = key;
    const snapshot = { ...draft, key };
    setValue(snapshot);
    form.set("payload", JSON.stringify(snapshot));
    form.set("recreateSource", sourceId);
    return saveNewPlanAction(previous, form);
  }, { status: "idle" });
  useEffect(() => {
    if (state.status === "success" && state.data && !navigated.current) {
      navigated.current = true; clear(); router.replace(state.data.href);
    }
  }, [state, clear, router]);
  const valid = Boolean(draft.startTime && draft.endTime && draft.date && draft.date >= todayYmdInTimeZone(timezone)
    && dateBasicsSchema.safeParse({ title: initial.title, date: draft.date, startTime: draft.startTime, endTime: draft.endTime }).success);
  const patch = (key: "date" | "startTime" | "endTime", value: string) => setValue((current) => ({ ...current, [key]: value }));
  return <form action={save} className="space-y-6" noValidate>
    <PendingFields className="space-y-6">
      <div><h1 className="font-display text-2xl font-medium text-ink">Recreate your first date</h1>
        <p className="mt-1 text-sm text-muted">The same places and moments. Just choose a new day and time.</p></div>
      <FormFeedback state={state} />
      <section className="space-y-3 wrap-anywhere rounded-xl border border-line bg-surface p-5" aria-label="Original date details">
        <h2 className="font-display text-xl text-ink">{initial.title}</h2>
        {initial.place ? <div><p className="text-sm font-medium text-ink">{initial.place.name}</p><p className="text-xs text-muted">{initial.place.address ?? initial.place.city}</p></div> : null}
        <ol className="space-y-3 text-sm">{initial.activities.map((stop, index) => <li key={stop.key}>
          <p className="font-medium text-ink">{index + 1}. {stop.title}</p>
          {stop.place ? <p className="text-muted">{stop.place.name}{stop.place.address ? ` · ${stop.place.address}` : ""}</p> : null}
          {stop.duration ? <p className="text-xs text-muted">{stop.duration} minutes</p> : null}
          {stop.description ? <p className="text-xs text-muted">{stop.description}</p> : null}
        </li>)}</ol>
        {initial.expectedTotal ? <p className="text-sm text-muted">Budget: {formatMoney(Math.round(Number(initial.expectedTotal) * 100), initial.currency)}</p> : null}
        {initial.notes ? <p className="whitespace-pre-wrap text-sm text-muted">{initial.notes}</p> : null}
      </section>
      <div><p className="mb-2 text-sm font-medium text-ink">When?</p><DatePicker value={draft.date || null} onChange={(value) => patch("date", value ?? "")} timezone={timezone} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><TimeField label="Start time" value={draft.startTime} onChange={(value) => setValue((current) => withStartTime(current, value))} disabled={!draft.date} optional />
        <TimeField label="End time" value={draft.endTime} onChange={(value) => patch("endTime", value)} disabled={!draft.date} presets={draft.startTime ? [{ label: "2 hours later", value: afterMinutes(draft.startTime) }] : []} optional /></div>
      <p className="text-xs text-muted">Stop times move with the start time. The original date stays in your memories.</p>
      <div className="flex justify-end border-t border-line pt-5"><SubmitButton name="mode" value="plan" disabled={!valid} pendingText="Saving…">Save date</SubmitButton></div>
    </PendingFields>
  </form>;
}
