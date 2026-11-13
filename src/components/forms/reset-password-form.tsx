"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { useFormValidity } from "@/lib/hooks/use-form-validity";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idleState);
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const visibleState = dismissedState === state ? idleState : state;
  const fieldErrors = visibleState.status === "error" ? visibleState.fieldErrors : undefined;
  const { formRef, valid, validate } = useFormValidity(resetPasswordSchema);

  return (
    <form ref={formRef} action={action}
      onInput={validate} onFocus={validate} onChange={() => { setDismissedState(state); validate(); }}
      onSubmit={(event) => { if (!valid) event.preventDefault(); }}
      onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      <FormFeedback state={visibleState} />
      <input type="hidden" name="token" value={token} />

      <NewPasswordFields errors={fieldErrors} />

      <SubmitButton fullWidth disabled={!valid} pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
