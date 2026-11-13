"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** The submitted snapshot owns the form until its action settles; later edits cannot be lost. */
export function PendingFields({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className={`contents ${className}`}>{children}</fieldset>;
}
