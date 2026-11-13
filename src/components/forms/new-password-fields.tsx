"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { passwordSchema } from "@/lib/validation/password";

export function NewPasswordFields({ errors, registration = false }: {
  errors?: Partial<Record<"password" | "confirmPassword", string[]>>;
  registration?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState({ password: false, confirmation: false });
  const parsed = passwordSchema.safeParse(password);
  const passwordErrors = touched.password ? parsed.success ? undefined : parsed.error.issues.map((issue) => issue.message) : errors?.password;
  const confirmationErrors = touched.confirmation ? !confirmation ? ["Confirm your password."]
    : confirmation !== password ? ["Passwords do not match."] : undefined : errors?.confirmPassword;
  const matches = confirmation.length > 0 && confirmation === password;

  return <>
    <Field label={registration ? "Password" : "New password"} htmlFor="password" errors={passwordErrors}>
      <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={6} maxLength={200} showStrength
        value={password} onChange={(event) => { setPassword(event.target.value); setTouched((current) => ({ ...current, password: true })); }}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        invalid={Boolean(passwordErrors?.length)} aria-describedby={passwordErrors?.length ? "password-error" : undefined} />
    </Field>
    <Field label={registration ? "Confirm password" : "Confirm new password"} htmlFor="confirmPassword" errors={confirmationErrors}>
      <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required maxLength={200}
        value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setTouched((current) => ({ ...current, confirmation: true })); }}
        onBlur={() => setTouched((current) => ({ ...current, confirmation: true }))}
        invalid={Boolean(confirmationErrors?.length)} aria-describedby={confirmationErrors?.length ? "confirmPassword-error" : matches ? "confirmPassword-match" : undefined} />
      {matches ? <p id="confirmPassword-match" role="status" className="text-xs text-success">Passwords match.</p> : null}
    </Field>
  </>;
}
