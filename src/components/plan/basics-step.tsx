"use client";

import { PendingFields } from "@/components/forms/pending-fields";
import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { DatePicker } from "@/components/plan/date-picker";
import { PlaceField } from "@/components/plan/place-field";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { TimeField } from "@/components/plan/time-field";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useLocalDraft } from "@/lib/hooks/use-local-draft";
import { UnsavedGuard } from "@/components/system/unsaved-guard";
import { idleState } from "@/lib/utils/result";
import { saveStepAction } from "@/server/actions/plan";
import { Chip } from "@/components/ui/chip";
import { PLAN_CATEGORIES, categoryFromPlanTitle, venueCategoryKey } from "@/lib/date/plan-discovery";
import type { PlanDateDTO } from "@/server/services/plan-service";

export function BasicsStep({ plan, userId }: { plan: PlanDateDTO; userId: string }) {
  const [state, action] = useActionState(saveStepAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const prefix = `mono:plan:${userId}:${plan.id}`;
  const { value: date, setValue: setDate } = useLocalDraft(`${prefix}:date`, plan.date ?? "");
  const { value: startTime, setValue: setStartTime } = useLocalDraft(`${prefix}:start`, plan.startTime ?? "");
  const { value: endTime, setValue: setEndTime } = useLocalDraft(`${prefix}:end`, plan.endTime ?? "");
  const title = useLocalDraft(`${prefix}:title`, plan.title);
  const notes = useLocalDraft(`${prefix}:notes`, plan.notes ?? "");
  const category = useLocalDraft(`${prefix}:category`, plan.discoveryCategory ?? "");
  const categoryKey = venueCategoryKey(category.value || categoryFromPlanTitle(title.value));

  return (
    <form action={action} className="space-y-6" noValidate>
      <PendingFields className="space-y-6">
        <UnsavedGuard state={state} valueKey={JSON.stringify([date, startTime, endTime])} />
        <input type="hidden" name="dateId" value={plan.id} />
        <input type="hidden" name="version" value={plan.version} />
        <input type="hidden" name="step" value="basics" />
        <input type="hidden" name="discoveryCategory" value={category.value} />
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
            value={title.value}
            onChange={(e) => { title.setValue(e.target.value); category.setValue(""); }}
            placeholder="Friday night out"
            maxLength={160}
          />
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Type of plan">
            {PLAN_CATEGORIES.map((choice) => <Chip key={choice.key} size="sm"
              selected={category.value ? category.value === choice.key : categoryFromPlanTitle(title.value) === choice.key}
              onClick={() => {
                category.setValue(choice.key);
                if (!title.value.trim() || PLAN_CATEGORIES.some((item) => item.label === title.value)) title.setValue(choice.label);
              }}>{choice.label}</Chip>)}
          </div>
        </Field>

        <PlaceField dateId={plan.id} place={plan.place} categoryKey={categoryKey}
          onCategoryChange={(key) => category.setValue(key ?? "all")} activities={plan.activities} />

        <div>
          <p className="mb-2 text-sm font-medium text-ink">When?</p>
          <DatePicker value={date} onChange={(value) => setDate(value ?? "")} timezone={plan.timezone} />
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
            value={notes.value}
            onChange={(e) => notes.setValue(e.target.value)}
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
      </PendingFields>
    </form>
  );
}
