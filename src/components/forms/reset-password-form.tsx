"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      <input type="hidden" name="token" value={token} />

      <NewPasswordFields errors={fieldErrors} />

      <SubmitButton fullWidth pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
