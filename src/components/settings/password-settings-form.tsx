"use client";

import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/link-button";
import { PasswordInput } from "@/components/ui/password-input";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { settingsErrorMessage, settingsRequest } from "@/lib/settings/request";
import { changePasswordSchema } from "@/lib/validation/password";

type PasswordField = "currentPassword" | "password" | "confirmPassword";

export function PasswordSettingsForm({ hasPassword }: { hasPassword: boolean }) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PasswordField, string[]>>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const input = changePasswordSchema.safeParse(Object.fromEntries(new FormData(form)));
    setError(null);
    if (!input.success) {
      const errors = input.error.flatten().fieldErrors;
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setFieldErrors({});
    busy.current = true; setPending(true);
    try {
      await settingsRequest("/api/account/password", input.data);
      form.reset();
      // Reload after cookie revocation so cached authenticated pages are discarded.
      window.location.replace("/login?reset=1");
    } catch (failure) {
      setError(settingsErrorMessage(failure));
      busy.current = false; setPending(false);
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
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-surface p-5" noValidate>
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
        <Button type="submit" loading={pending}>{pending ? "Updating…" : "Update password"}</Button>
      </fieldset>
    </form>
  );
}
