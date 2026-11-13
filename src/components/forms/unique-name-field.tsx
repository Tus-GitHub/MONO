"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { nameSchema } from "@/lib/validation/name";

export function UniqueNameField({ initial = "", errors, onValidityChange }: {
  initial?: string;
  errors?: string[];
  onValidityChange?: (valid: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const [edited, setEdited] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<string[] | undefined>();
  const [result, setResult] = useState<{ name: string; status: "available" | "taken" | "unavailable" } | null>(null);
  const name = value.trim();
  const parsed = nameSchema.safeParse(value);
  const status = parsed.success ? result?.name === name ? result.status : "checking" : "idle";
  const messages = edited && !parsed.success ? parsed.error.issues.map((issue) => issue.message)
    : status === "taken" ? ["That exact name is already in use. Try another spelling or capitalization."] : errors !== dismissedErrors ? errors : undefined;
  const ready = parsed.success && status === "available" && !messages?.length;
  useEffect(() => { onValidityChange?.(ready); }, [onValidityChange, ready]);
  useEffect(() => {
    if (!nameSchema.safeParse(name).success) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/name-availability?${new URLSearchParams({ name })}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!controller.signal.aborted) setResult({ name, status: response.ok && typeof data.available === "boolean" ? data.available ? "available" : "taken" : "unavailable" });
      } catch { if (!controller.signal.aborted) setResult({ name, status: "unavailable" }); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [name]);
  return <Field label="Name" htmlFor="name" errors={messages}>
    <Input id="name" name="name" value={value} onChange={(event) => {
      if (event.target.value.trim() !== name) onValidityChange?.(false);
      setValue(event.target.value); setEdited(true); setDismissedErrors(errors);
    }}
      onBlur={() => setEdited(true)} autoComplete="name" required maxLength={80}
      invalid={Boolean(messages?.length)} aria-describedby={messages?.length ? "name-error" : "name-status"} />
    {!messages?.length ? <p id="name-status" role="status" className={`text-xs ${status === "available" ? "text-success" : "text-muted"}`}>
      {status === "checking" ? "Checking name…" : status === "available" ? "This exact name is available." : status === "unavailable" ? onValidityChange ? "Name check unavailable. Edit the name to try again." : "We’ll check this name when you submit." : "Names are case-sensitive."}
    </p> : null}
  </Field>;
}
