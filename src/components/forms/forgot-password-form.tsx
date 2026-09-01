"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const done = state.status === "success";

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />

      {!done ? (
        <>
          <Field label="Email" htmlFor="email" errors={fieldErrors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton className="w-full" pendingText="Sending…">
            Send reset link
          </SubmitButton>
        </>
      ) : null}
    </form>
  );
}
