"use client";

import { useEffect, useState } from "react";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { emailSchema } from "@/lib/validation/common";

export function RegistrationEmailField({ errors, onValidityChange }: {
  errors?: string[];
  onValidityChange?: (valid: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<string[] | undefined>();
  const [result, setResult] = useState<{ email: string; status: "available" | "taken" | "unavailable" } | null>(null);
  const email = value.trim().toLowerCase();
  const valid = emailSchema.safeParse(value).success;
  const status = valid ? result?.email === email ? result.status : "checking" : "idle";
  const messages = touched && !valid ? ["Enter a valid email address."]
    : status === "taken" ? ["This email is already registered. Sign in or use another email."]
    : errors !== dismissedErrors ? errors : undefined;
  const ready = valid && status === "available" && !messages?.length;
  useEffect(() => { onValidityChange?.(ready); }, [onValidityChange, ready]);

  useEffect(() => {
    if (!emailSchema.safeParse(email).success) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/email-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!controller.signal.aborted) setResult({ email, status: response.ok && typeof data.available === "boolean" ? data.available ? "available" : "taken" : "unavailable" });
      } catch {
        if (!controller.signal.aborted) setResult({ email, status: "unavailable" });
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [email]);

  const hint = status === "checking" ? "Checking email…" : status === "available" ? "This email is available."
    : status === "unavailable" ? onValidityChange ? "Email check unavailable. Edit the address to try again." : "We’ll check this email when you submit." : undefined;

  return <Field label="Email" htmlFor="email" errors={messages}>
    <Input id="email" name="email" type="email" autoComplete="email" required maxLength={320} value={value}
      onChange={(event) => {
        if (event.target.value.trim().toLowerCase() !== email) onValidityChange?.(false);
        setValue(event.target.value); setTouched(true); setDismissedErrors(errors);
      }}
      onBlur={() => setTouched(true)} invalid={Boolean(messages?.length)}
      aria-describedby={messages?.length ? "email-error" : hint ? "email-status" : undefined} />
    {!messages?.length && hint ? <p id="email-status" role="status" className={`text-xs ${status === "available" ? "text-success" : "text-muted"}`}>{hint}</p> : null}
  </Field>;
}
