"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { nameSchema } from "@/lib/validation/name";

export function NameField({ initial = "", errors, onValidityChange }: {
  initial?: string;
  errors?: string[];
  onValidityChange?: (valid: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const [edited, setEdited] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<string[] | undefined>();
  const parsed = nameSchema.safeParse(value);
  const messages = edited && !parsed.success ? parsed.error.issues.map((issue) => issue.message)
    : errors !== dismissedErrors ? errors : undefined;
  const ready = parsed.success && !messages?.length;
  useEffect(() => { onValidityChange?.(ready); }, [onValidityChange, ready]);
  return <Field label="Name" htmlFor="name" errors={messages}>
    <Input id="name" name="name" value={value} onChange={(event) => {
      onValidityChange?.(nameSchema.safeParse(event.target.value).success);
      setValue(event.target.value); setEdited(true); setDismissedErrors(errors);
    }}
      onBlur={() => setEdited(true)} autoComplete="name" required maxLength={80}
      invalid={Boolean(messages?.length)} aria-describedby={messages?.length ? "name-error" : undefined} />
  </Field>;
}
