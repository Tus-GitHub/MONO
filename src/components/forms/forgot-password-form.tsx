"use client";

import { PendingFields } from "@/components/forms/pending-fields";

import { useActionState, useState } from "react";

import { EmailFormatField } from "@/components/forms/email-format-field";
import { FormFeedback } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { useFormValidity } from "@/lib/hooks/use-form-validity";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idleState);
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const visibleState = dismissedState === state ? idleState : state;
  const fieldErrors = visibleState.status === "error" ? visibleState.fieldErrors : undefined;
  const done = state.status === "success";
  const { formRef, valid, validate } = useFormValidity(requestPasswordResetSchema);

  return (
    <form ref={formRef} action={action}
      onInput={validate} onFocus={validate} onChange={() => { setDismissedState(state); validate(); }}
      onSubmit={(event) => { if (!valid) event.preventDefault(); }}
      onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      <PendingFields className="space-y-4">
        <FormFeedback state={visibleState} />

        {!done ? (
          <>
            <EmailFormatField errors={fieldErrors?.email} />
            <SubmitButton className="w-full" disabled={!valid} pendingText="Sending…">
              Send reset link
            </SubmitButton>
          </>
        ) : null}
      </PendingFields>
    </form>
  );
}
