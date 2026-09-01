"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
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
  );
}
