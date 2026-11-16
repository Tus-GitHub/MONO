"use client";

import { PendingFields } from "@/components/forms/pending-fields";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { RegistrationEmailField } from "@/components/forms/registration-email-field";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { NameField } from "@/components/forms/name-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { useFormValidity } from "@/lib/hooks/use-form-validity";
import { registerSchema } from "@/lib/validation/auth";
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState(registerAction, idleState);
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const [nameValid, setNameValid] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const { formRef, valid, validate } = useFormValidity(registerSchema);
  const canSubmit = valid && nameValid && emailAvailable;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action}
      onInput={validate} onFocus={validate} onChange={() => { setDismissedState(state); validate(); }}
      onSubmit={(event) => { if (!canSubmit) event.preventDefault(); }}
      onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      <PendingFields className="space-y-4">
        {invite ? <input type="hidden" name="invite" value={invite} /> : null}

        <NameField errors={fieldErrors?.name} onValidityChange={setNameValid} />

        <RegistrationEmailField errors={fieldErrors?.email} onValidityChange={setEmailAvailable} />

        <NewPasswordFields errors={fieldErrors} registration />

        <FormFeedback state={dismissedState === state ? idleState : state} />
        <SubmitButton fullWidth disabled={!canSubmit} pendingText="Creating account…">
          Create account
        </SubmitButton>
      </PendingFields>
    </form>
  );
}
