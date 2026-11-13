"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { CheckboxField } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, errorState } from "@/lib/utils/result";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ invite, oauthFailed }: { invite?: string; oauthFailed?: boolean }) {
  const [state, action] = useActionState(loginAction, oauthFailed
    ? errorState("Google sign-in couldn't finish. Please try again or sign in with your email.")
    : idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const incorrect = state.status === "error" && state.message === "Incorrect email or password.";

  return (
    <form action={action} className="space-y-4" noValidate>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <Field label="Email" htmlFor="email" errors={fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required invalid={incorrect || Boolean(fieldErrors?.email?.length)} aria-describedby={fieldErrors?.email?.length ? "email-error" : incorrect ? "login-feedback" : undefined} />
      </Field>

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

      <div id="login-feedback"><FormFeedback state={state} /></div>
      <SubmitButton fullWidth pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
