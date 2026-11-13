"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { RegistrationEmailField } from "@/components/forms/registration-email-field";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { UniqueNameField } from "@/components/forms/unique-name-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState(registerAction, idleState);
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} onChange={() => setDismissedState(state)} onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <UniqueNameField errors={fieldErrors?.name} />

      <RegistrationEmailField errors={fieldErrors?.email} />

      <NewPasswordFields errors={fieldErrors} registration />

      <FormFeedback state={dismissedState === state ? idleState : state} />
      <SubmitButton fullWidth pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
