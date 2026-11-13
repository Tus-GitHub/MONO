"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { emailSchema } from "@/lib/validation/common";

/** Format-only feedback for sign-in/recovery; never queries account availability. */
export function EmailFormatField({ errors, incorrect = false, feedbackId }: {
  errors?: string[];
  incorrect?: boolean;
  feedbackId?: string;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = emailSchema.safeParse(value).success;
  const messages = touched ? valid ? undefined : ["Enter a valid email address."] : errors;

  return <Field label="Email" htmlFor="email" errors={messages}>
    <Input id="email" name="email" type="email" autoComplete="email" required maxLength={320}
      value={value} onChange={(event) => { setValue(event.target.value); setTouched(true); }}
      onBlur={() => setTouched(true)} invalid={incorrect || Boolean(messages?.length)}
      aria-describedby={messages?.length ? "email-error" : incorrect ? feedbackId : undefined} />
  </Field>;
}
