"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, showStrength = false, onChange, onBlur, onKeyUp, onKeyDown, value, defaultValue, ...props }: Omit<InputProps, "type"> & { showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState(String(value ?? defaultValue ?? ""));
  const [capsLock, setCapsLock] = useState(false);
  const strengthId = `${props.id ?? props.name ?? "password"}-strength`;
  const capsId = `${props.id ?? props.name ?? "password"}-caps`;
  const describedBy = [props["aria-describedby"], showStrength ? strengthId : null, capsLock ? capsId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
        value={value ?? (showStrength ? typed : undefined)}
        defaultValue={showStrength ? undefined : defaultValue}
        aria-describedby={describedBy}
        onChange={(event) => { setTyped(event.currentTarget.value); onChange?.(event); }}
        onKeyDown={(event) => { setCapsLock(event.getModifierState("CapsLock")); onKeyDown?.(event); }}
        onKeyUp={(event) => { setCapsLock(event.getModifierState("CapsLock")); onKeyUp?.(event); }}
        onBlur={(event) => { setCapsLock(false); onBlur?.(event); }}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:text-ink"
      >
        <Icon name={visible ? "eyeOff" : "eye"} size="sm" />
      </button>
    </div>
    {capsLock ? <p id={capsId} role="status" className="text-xs text-warning">Caps Lock is on.</p> : null}
    {showStrength ? <PasswordStrength id={strengthId} value={value == null ? typed : String(value)} /> : null}
    </div>
  );
}
