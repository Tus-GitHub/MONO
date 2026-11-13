"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/link-button";
import { PasswordInput } from "@/components/ui/password-input";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { useAsyncTask } from "@/lib/hooks/use-async-task";
import { settingsRequest } from "@/lib/settings/request";
import { changePasswordSchema } from "@/lib/validation/password";
import { useFormValidity } from "@/lib/hooks/use-form-validity";

type PasswordField = "currentPassword" | "password" | "confirmPassword";

export function PasswordSettingsForm({ hasPassword }: { hasPassword: boolean }) {
  const task = useAsyncTask<unknown, "password">();
  const pending = task.state.status === "pending" || task.state.status === "success";
  const error = task.state.status === "error" ? task.state.message : null;
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PasswordField, string[]>>>({});
  const { formRef, valid, validate } = useFormValidity(changePasswordSchema);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !valid) return;
    const form = event.currentTarget;
    const input = changePasswordSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!input.success) {
      const errors = input.error.flatten().fieldErrors;
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setFieldErrors({});
    const outcome = await task.run("password", (signal) => settingsRequest("/api/account/password", input.data, signal));
    if (outcome) {
      form.reset();
      window.location.replace("/login?reset=1");
    }
  }

  if (!hasPassword) return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <Alert title="You sign in with Google">
        Your Google password is managed by Google. To add a MONO password, use the password
        reset flow when email delivery is available.
      </Alert>
      <LinkButton href="/forgot-password" variant="secondary">Reset password</LinkButton>
    </div>
  );

  return (
    <form ref={formRef} onSubmit={submit} onInput={validate} onFocus={validate}
      onChange={() => { validate(); task.reset(); setFieldErrors({}); }}
      className="space-y-5 rounded-xl border border-line bg-surface p-5" noValidate>
      <p className="text-sm text-muted">
        Changing your password signs you out on every device, including this one.
        You&apos;ll sign in again with your new password.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <Field label="Current password" htmlFor="currentPassword" errors={fieldErrors.currentPassword}>
          <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password"
            required maxLength={200} invalid={Boolean(fieldErrors.currentPassword)}
            aria-describedby={fieldErrors.currentPassword ? "currentPassword-error" : undefined} />
        </Field>
        <NewPasswordFields errors={fieldErrors} />
        <Button type="submit" loading={pending} disabled={!valid}>{pending ? "Updating…" : "Update password"}</Button>
      </fieldset>
    </form>
  );
}
