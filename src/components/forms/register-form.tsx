"use client";

import { useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState(registerAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <Field label="Name" htmlFor="name" errors={fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>

      <Field label="Email" htmlFor="email" errors={fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Password"
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

      <Field label="Confirm password" htmlFor="confirmPassword" errors={fieldErrors?.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton fullWidth pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
