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
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}

      <Field label="Name" htmlFor="name" errors={fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required invalid={Boolean(fieldErrors?.name?.length)} aria-describedby={fieldErrors?.name?.length ? "name-error" : undefined} />
      </Field>

      <Field label="Email" htmlFor="email" errors={fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required invalid={Boolean(fieldErrors?.email?.length)} aria-describedby={fieldErrors?.email?.length ? "email-error" : undefined} />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        errors={fieldErrors?.password}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={200}
          showStrength
          invalid={Boolean(fieldErrors?.password?.length)}
          aria-describedby={fieldErrors?.password?.length ? "password-error" : undefined}
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirmPassword" errors={fieldErrors?.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          invalid={Boolean(fieldErrors?.confirmPassword?.length)}
          aria-describedby={fieldErrors?.confirmPassword?.length ? "confirmPassword-error" : undefined}
        />
      </Field>

      <FormFeedback state={state} />
      <SubmitButton fullWidth pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
