"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { UniqueNameField } from "@/components/forms/unique-name-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState(registerAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <UniqueNameField errors={fieldErrors?.name} />

      <Field label="Email" htmlFor="email" errors={fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required invalid={Boolean(fieldErrors?.email?.length)} aria-describedby={fieldErrors?.email?.length ? "email-error" : undefined} />
      </Field>

      <NewPasswordFields errors={fieldErrors} registration />

      <FormFeedback state={state} />
      <SubmitButton fullWidth pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
