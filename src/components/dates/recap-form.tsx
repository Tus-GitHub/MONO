"use client";

import { useActionState, useState } from "react";

import { MoneyInput } from "@/components/dates/money-input";
import { FormFeedback } from "@/components/forms/form-feedback";
import { TimeField } from "@/components/plan/time-field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { fieldBase, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { UnsavedGuard } from "@/components/system/unsaved-guard";
import { idleState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import { recordActualsAction } from "@/server/actions/date";

interface RecapPlan {
  placeName: string | null;
  dateYmd: string | null;
  startTime: string | null;
  endTime: string | null;
  budgetCents: number | null;
}
interface RecapActual {
  placeId: string | null;
  locationText: string | null;
  dateYmd: string | null;
  startTime: string | null;
  endTime: string | null;
  spendCents: number | null;
  notes: string | null;
}

export function RecapForm({
  dateId,
  plan,
  actual,
  savedPlaces,
}: {
  dateId: string;
  plan: RecapPlan;
  actual: RecapActual;
  savedPlaces: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(recordActualsAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const [mode, setMode] = useState<"saved" | "text">(
    actual.placeId ? "saved" : "text",
  );
  const [savedId, setSavedId] = useState(actual.placeId ?? "");
  const [locationText, setLocationText] = useState(actual.locationText ?? "");
  const [day, setDay] = useState(actual.dateYmd ?? plan.dateYmd ?? "");
  const [start, setStart] = useState(actual.startTime ?? "");
  const [end, setEnd] = useState(actual.endTime ?? "");

  const fillFromPlan = () => {
    if (plan.dateYmd) setDay(plan.dateYmd);
    if (plan.startTime) setStart(plan.startTime);
    if (plan.endTime) setEnd(plan.endTime);
    if (savedPlaces.length === 0 || mode === "text") {
      setMode("text");
      if (plan.placeName) setLocationText(plan.placeName);
    }
  };

  return (
    <form action={action} className="space-y-6" noValidate>
      <UnsavedGuard />
      <input type="hidden" name="dateId" value={dateId} />
      <input type="hidden" name="actualStartTime" value={start} />
      <input type="hidden" name="actualEndTime" value={end} />
      {mode === "saved" ? (
        <input type="hidden" name="actualSavedPlaceId" value={savedId} />
      ) : (
        <input type="hidden" name="actualLocationText" value={locationText} />
      )}

      <FormFeedback state={state} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Fill in whatever you remember — none of it is required.</p>
        {(plan.dateYmd || plan.startTime || plan.placeName) && (
          <Button type="button" variant="ghost" size="sm" onClick={fillFromPlan}>
            Same as the plan
          </Button>
        )}
      </div>

      {/* Where you actually ended up */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Where did you actually go?</span>
          {savedPlaces.length > 0 ? (
            <div className="flex gap-1.5">
              <Chip size="sm" selected={mode === "saved"} onClick={() => setMode("saved")}>
                From your list
              </Chip>
              <Chip size="sm" selected={mode === "text"} onClick={() => setMode("text")}>
                Somewhere else
              </Chip>
            </div>
          ) : null}
        </div>
        {mode === "saved" && savedPlaces.length > 0 ? (
          <Select
            value={savedId}
            onChange={(event) => setSavedId(event.target.value)}
            aria-label="Actual place"
          >
            <option value="">Pick a place…</option>
            {savedPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={locationText}
            onChange={(event) => setLocationText(event.target.value)}
            placeholder={plan.placeName ?? "The place you ended up"}
            aria-label="Actual place"
          />
        )}
      </div>

      {/* When */}
      <Field label="What day was it?" htmlFor="actualDate" errors={fieldErrors?.actualDate} optional>
        <input
          id="actualDate"
          name="actualDate"
          type="date"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          className={cn(fieldBase, "h-11 px-3.5 text-sm")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <TimeField label="Started" value={start} onChange={setStart} optional />
        <TimeField label="Ended" value={end} onChange={setEnd} optional />
      </div>
      {fieldErrors?.actualEndTime ? (
        <p className="text-xs text-error">{fieldErrors.actualEndTime[0]}</p>
      ) : null}

      {/* Spend */}
      <Field label="What did it actually cost?" htmlFor="actualSpend" optional errors={fieldErrors?.actualSpend}>
        <MoneyInput
          id="actualSpend"
          name="actualSpend"
          defaultValue={actual.spendCents != null ? String(actual.spendCents / 100) : ""}
        />
      </Field>

      {/* Notes */}
      <Field label="How did it actually go?" htmlFor="actualNotes" optional>
        <Textarea
          id="actualNotes"
          name="actualNotes"
          rows={4}
          defaultValue={actual.notes ?? ""}
          placeholder="What you'll want to remember — a moment, a surprise, how it felt."
        />
      </Field>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <SubmitButton pendingText="Saving…">Save what happened</SubmitButton>
      </div>
    </form>
  );
}
