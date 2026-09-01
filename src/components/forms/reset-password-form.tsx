"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      <input type="hidden" name="token" value={token} />

      <Field
        label="New password"
        htmlFor="password"
        hint="At least 10 characters, with an uppercase letter and a number."
        errors={fieldErrors?.password}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" errors={fieldErrors?.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton fullWidth pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
