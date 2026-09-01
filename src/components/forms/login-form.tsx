"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { CheckboxField } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState(loginAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <Field label="Email" htmlFor="email" errors={fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" htmlFor="password" errors={fieldErrors?.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
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

      <SubmitButton fullWidth pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
