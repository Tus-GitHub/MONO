"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ButtonProps, "type" | "loading"> {
  pendingText?: string;
}

/** Submit button that reflects the enclosing form action's pending state. */
export function SubmitButton({ children, pendingText, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={disabled} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
