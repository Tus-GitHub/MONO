"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { EmailFormatField } from "@/components/forms/email-format-field";
import { FormFeedback } from "@/components/forms/form-feedback";
import { CheckboxField } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, errorState } from "@/lib/utils/result";
import { useFormValidity } from "@/lib/hooks/use-form-validity";
import { loginSchema } from "@/lib/validation/auth";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ invite, oauthFailed }: { invite?: string; oauthFailed?: boolean }) {
  const [state, action] = useActionState(loginAction, oauthFailed
    ? errorState("Google sign-in couldn't finish. Please try again or sign in with your email.")
    : idleState);
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const visibleState = dismissedState === state ? idleState : state;
  const fieldErrors = visibleState.status === "error" ? visibleState.fieldErrors : undefined;
  const incorrect = visibleState.status === "error" && visibleState.message === "Incorrect email or password.";
  const { formRef, valid, validate } = useFormValidity(loginSchema);

  return (
    <form ref={formRef} action={action}
      onInput={validate} onFocus={validate} onChange={() => { setDismissedState(state); validate(); }}
      onSubmit={(event) => { if (!valid) event.preventDefault(); }}
      onReset={(event) => event.preventDefault()} className="space-y-4" noValidate>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <EmailFormatField errors={fieldErrors?.email} incorrect={incorrect} feedbackId="login-feedback" />

      <Field label="Password" htmlFor="password" errors={fieldErrors?.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          invalid={incorrect || Boolean(fieldErrors?.password?.length)}
          aria-describedby={fieldErrors?.password?.length ? "password-error" : incorrect ? "login-feedback" : undefined}
        />
      </Field>

      <div className="flex items-center justify-between">
        <CheckboxField name="remember" value="on" defaultChecked label="Remember me" />
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Forgot password?
        </Link>
      </div>

      <div id="login-feedback"><FormFeedback state={visibleState} /></div>
      <SubmitButton fullWidth disabled={!valid} pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
