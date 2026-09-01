"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { DatePicker } from "@/components/plan/date-picker";
import { PlaceField } from "@/components/plan/place-field";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { TimeField } from "@/components/plan/time-field";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { saveStepAction } from "@/server/actions/plan";
import type { PlanDateDTO } from "@/server/services/plan-service";

export function BasicsStep({ plan }: { plan: PlanDateDTO }) {
  const [state, action] = useActionState(saveStepAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const [date, setDate] = useState<string | null>(plan.date);
  const [startTime, setStartTime] = useState(plan.startTime ?? "");
  const [endTime, setEndTime] = useState(plan.endTime ?? "");

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="dateId" value={plan.id} />
      <input type="hidden" name="step" value="basics" />
      <input type="hidden" name="date" value={date ?? ""} />
      <input type="hidden" name="startTime" value={date ? startTime : ""} />
      <input type="hidden" name="endTime" value={date ? endTime : ""} />

      <PlanStepper dateId={plan.id} current="basics" variant="buttons" />

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-medium text-ink">The basics</h1>
        <p className="text-sm text-muted">
          Everything here saves as you go — you won&apos;t lose it moving between steps.
        </p>
      </div>

      <FormFeedback state={state} />

      <Field label="What's the plan?" htmlFor="title" errors={fieldErrors?.title}>
        <Input
          id="title"
          name="title"
          defaultValue={plan.title}
          placeholder="Friday night out"
          maxLength={160}
        />
      </Field>

      <PlaceField dateId={plan.id} place={plan.place} />

      <div>
        <p className="mb-2 text-sm font-medium text-ink">When?</p>
        <DatePicker value={date} onChange={setDate} />
        {fieldErrors?.date ? (
          <p className="mt-1.5 text-xs text-error">{fieldErrors.date.join(" ")}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TimeField
          label="Start time"
          value={startTime}
          onChange={setStartTime}
          disabled={!date}
          optional
        />
        <TimeField
          label="End time"
          value={endTime}
          onChange={setEndTime}
          disabled={!date}
          optional
        />
      </div>
      {fieldErrors?.endTime ? (
        <p className="-mt-3 text-xs text-error">{fieldErrors.endTime.join(" ")}</p>
      ) : null}

      <Field label="Notes" htmlFor="notes" optional errors={fieldErrors?.notes}>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={plan.notes ?? ""}
          rows={3}
          placeholder="Anything to remember while planning."
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <SubmitButton name="goto" value="exit" variant="ghost" pendingText="Saving…">
          Save draft &amp; exit
        </SubmitButton>
        <SubmitButton name="goto" value="budget" pendingText="Saving…">
          Save &amp; continue
        </SubmitButton>
      </div>
    </form>
  );
}
