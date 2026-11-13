"use client";

import { useActionState, useState } from "react";

import { EmailFormatField } from "@/components/forms/email-format-field";
import { FormFeedback } from "@/components/forms/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idleState);
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const visibleState = dismissedState === state ? idleState : state;
  const fieldErrors = visibleState.status === "error" ? visibleState.fieldErrors : undefined;
  const done = state.status === "success";

  return (
    <form action={action} onChange={() => setDismissedState(state)} onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      <FormFeedback state={visibleState} />

      {!done ? (
        <>
          <EmailFormatField errors={fieldErrors?.email} />
          <SubmitButton className="w-full" pendingText="Sending…">
            Send reset link
          </SubmitButton>
        </>
      ) : null}
    </form>
  );
}
