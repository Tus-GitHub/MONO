"use client";

import { useActionState } from "react";
import { PlaceCategory } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { UnsavedGuard } from "@/components/system/unsaved-guard";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { idleState } from "@/lib/utils/result";
import { createCustomPlaceAction, selectPlaceForDateAction } from "@/server/actions/place";

/** Add a place an external provider can't find. Attaches to a Date when `forDate` is set. */
export function CustomPlaceForm({ forDate }: { forDate?: string }) {
  const action = forDate ? selectPlaceForDateAction : createCustomPlaceAction;
  const [state, dispatch] = useActionState(action, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={dispatch} className="space-y-4" noValidate>
      <UnsavedGuard />
      <FormFeedback state={state} />
      {forDate ? (
        <>
          <input type="hidden" name="dateId" value={forDate} />
          <input type="hidden" name="mode" value="custom" />
          <input type="hidden" name="redirectTo" value={`/plan/${forDate}?step=basics`} />
        </>
      ) : null}

      <Field label="Place name" htmlFor="name" errors={fieldErrors?.name}>
        <Input id="name" name="name" required placeholder="The little place on 5th" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue={PlaceCategory.OTHER}>
            {Object.values(PlaceCategory).map((value) => (
              <option key={value} value={value}>
                {PLACE_CATEGORY_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City" htmlFor="city" optional errors={fieldErrors?.city}>
          <Input id="city" name="city" />
        </Field>
      </div>

      <Field label="Address" htmlFor="address" optional errors={fieldErrors?.address}>
        <Input id="address" name="address" />
      </Field>

      <SubmitButton pendingText="Saving…">
        {forDate ? "Use this place" : "Save place"}
      </SubmitButton>
    </form>
  );
}
