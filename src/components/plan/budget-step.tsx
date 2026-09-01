"use client";

import { useActionState } from "react";
import { ExpensePayer } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { saveStepAction } from "@/server/actions/plan";
import type { PlanDateDTO } from "@/server/services/plan-service";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "SGD"];

const SPLIT_LABEL: Record<ExpensePayer, string> = {
  SHARED: "We'll split it",
  OWNER: "I've got this one",
  PARTNER: "They've got this one",
  CUSTOM: "We'll sort it per expense",
};

function dollars(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toString();
}

function MoneyInput({
  name,
  defaultValue,
  placeholder,
  id,
}: {
  name: string;
  defaultValue: string;
  placeholder?: string;
  id: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
        $
      </span>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-7"
      />
    </div>
  );
}

export function BudgetStep({ plan }: { plan: PlanDateDTO }) {
  const [state, action] = useActionState(saveStepAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const hasRange = plan.budgetMinCents != null || plan.budgetMaxCents != null;

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="dateId" value={plan.id} />
      <input type="hidden" name="step" value="budget" />

      <PlanStepper dateId={plan.id} current="budget" variant="buttons" />

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-medium text-ink">
          How much are we planning to spend?
        </h1>
        <p className="text-sm text-muted">
          A rough number is fine — this is just so it&apos;s not a surprise later.
        </p>
      </div>

      <FormFeedback state={state} />

      <div className="rounded-xl border border-line bg-surface/70 p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field label="Expected total" htmlFor="expectedTotal" optional errors={fieldErrors?.expectedTotal}>
            <MoneyInput
              id="expectedTotal"
              name="expectedTotal"
              defaultValue={dollars(plan.expectedTotalCents)}
              placeholder="0"
            />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={plan.currency}>
              {CURRENCIES.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </Select>
          </Field>
        </div>

        <details className="mt-3" open={hasRange}>
          <summary className="cursor-pointer text-sm font-medium text-muted">
            Add a range instead
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Low end" htmlFor="budgetMin" optional errors={fieldErrors?.budgetMin}>
              <MoneyInput
                id="budgetMin"
                name="budgetMin"
                defaultValue={dollars(plan.budgetMinCents)}
              />
            </Field>
            <Field label="High end" htmlFor="budgetMax" optional errors={fieldErrors?.budgetMax}>
              <MoneyInput
                id="budgetMax"
                name="budgetMax"
                defaultValue={dollars(plan.budgetMaxCents)}
              />
            </Field>
          </div>
        </details>

        <div className="mt-4">
          <Field label="Who's paying?" htmlFor="split" optional>
            <Select id="split" name="split" defaultValue={plan.budgetSplit}>
              {(Object.keys(SPLIT_LABEL) as ExpensePayer[]).map((key) => (
                <option key={key} value={key}>
                  {SPLIT_LABEL[key]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <SubmitButton name="goto" value="basics" variant="ghost" pendingText="Saving…">
          Back
        </SubmitButton>
        <div className="flex gap-2">
          <SubmitButton name="goto" value="exit" variant="ghost" pendingText="Saving…">
            Save &amp; exit
          </SubmitButton>
          <SubmitButton name="goto" value="activities" pendingText="Saving…">
            Continue
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
