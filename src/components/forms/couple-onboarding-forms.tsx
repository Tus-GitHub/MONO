"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { createCoupleAction, joinCoupleAction } from "@/server/actions/couple";

/** Minimal "create our space" — no fields; name/date are set in the couple-setup step. */
export function CreateSpaceButton() {
  const [state, action] = useActionState(createCoupleAction, idleState);
  return (
    <form action={action}>
      <FormFeedback state={state} />
      <SubmitButton fullWidth pendingText="Creating…" className="mt-1">
        Create our space
      </SubmitButton>
    </form>
  );
}

export function CreateCoupleForm() {
  const [state, action] = useActionState(createCoupleAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />

      <Field
        label="Space name"
        htmlFor="name"
        hint="Optional — e.g. your names or a nickname."
        errors={fieldErrors?.name}
      >
        <Input id="name" name="name" placeholder="Us" />
      </Field>

      <Field label="Anniversary" htmlFor="anniversaryAt" hint="Optional." errors={fieldErrors?.anniversaryAt}>
        <Input id="anniversaryAt" name="anniversaryAt" type="date" />
      </Field>

      <SubmitButton className="w-full" pendingText="Creating…">
        Create our space
      </SubmitButton>
    </form>
  );
}

export function JoinCoupleForm() {
  const [state, action] = useActionState(joinCoupleAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />

      <Field
        label="Invite code"
        htmlFor="inviteCode"
        hint="The code your partner sees after creating the space."
        errors={fieldErrors?.inviteCode}
      >
        <Input
          id="inviteCode"
          name="inviteCode"
          autoCapitalize="characters"
          placeholder="ABC-1234"
          required
        />
      </Field>

      <SubmitButton className="w-full" pendingText="Joining…">
        Join with code
      </SubmitButton>
    </form>
  );
}
