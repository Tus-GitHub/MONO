"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { ExpenseFields } from "@/components/dates/expense-fields";
import { FormFeedback } from "@/components/forms/form-feedback";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/utils/result";
import { addDateExpenseAction } from "@/server/actions/expenses";

/** `+ Add expense` — a fast one-line spend the couple can drop in without leaving the date. */
export function QuickExpenseButton({
  dateId,
  currency,
  partnerName = "Partner",
  variant = "secondary",
  size = "md",
  fullWidth = false,
  label = "Add expense",
}: {
  dateId: string;
  currency: string;
  partnerName?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addDateExpenseAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => setOpen(true)}
        leadingIcon={<Icon name="plus" size="sm" />}
      >
        {label}
      </Button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add an expense">
        {/* key forces a fresh, empty form each time the sheet opens */}
        <form action={action} className="space-y-4" noValidate key={open ? "open" : "closed"}>
          <input type="hidden" name="dateId" value={dateId} />
          <input type="hidden" name="currency" value={currency} />

          <FormFeedback state={state} />

          <ExpenseFields fieldErrors={fieldErrors} partnerName={partnerName} currency={currency} />

          <SubmitButton fullWidth pendingText="Saving…">
            Add expense
          </SubmitButton>
        </form>
      </BottomSheet>
    </>
  );
}
