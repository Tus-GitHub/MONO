"use client";

import { startTransition, useActionState, useState } from "react";
import { ExpenseCategory } from "@prisma/client";

import { ExpenseFields, type ExpenseDefaults } from "@/components/dates/expense-fields";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  EXPENSE_CATEGORY_COLOR,
  EXPENSE_CATEGORY_LABEL,
  type PayerFacing,
} from "@/lib/date/expense-labels";
import { formatMoney } from "@/lib/utils/format";
import { idleState, type ActionState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import { deleteDateExpenseAction, updateDateExpenseAction } from "@/server/actions/expenses";

export interface ExpenseView {
  id: string;
  description: string;
  amountCents: number;
  currency: string;
  category: ExpenseCategory;
  note: string | null;
  spentAt: string;
  payer: PayerFacing;
  mineShareCents: number;
  partnerShareCents: number;
  recordedByName: string;
}

const PAYER_TEXT: Record<PayerFacing, string> = {
  me: "You paid",
  partner: "Partner paid",
  shared: "Split evenly",
  custom: "Custom split",
};

function toDefaults(expense: ExpenseView): ExpenseDefaults {
  const pct =
    expense.amountCents > 0
      ? Math.round(((expense.mineShareCents / expense.amountCents) * 100) / 5) * 5
      : 50;
  return {
    description: expense.description,
    amount: String(expense.amountCents / 100),
    category: expense.category,
    payer: expense.payer,
    mySharePct: Math.min(100, Math.max(0, pct)),
    note: expense.note ?? "",
    spentAtLocal: expense.spentAt.slice(0, 16),
  };
}

export function ExpenseRow({
  dateId,
  expense,
  partnerName,
}: {
  dateId: string;
  expense: ExpenseView;
  partnerName: string;
}) {
  const confirm = useConfirm();
  const [editState, editAction] = useActionState(updateDateExpenseAction, idleState);
  const [, deleteAction, deleting] = useActionState(deleteDateExpenseAction, idleState);
  const [editing, setEditing] = useState(false);
  const [lastSeen, setLastSeen] = useState<ActionState>(idleState);

  if (editState !== lastSeen) {
    setLastSeen(editState);
    if (editState.status === "success" && editing) setEditing(false);
  }
  const fieldErrors = editState.status === "error" ? editState.fieldErrors : undefined;

  const remove = async () => {
    if (deleting) return;
    const ok = await confirm({
      title: "Remove this expense?",
      description: `${expense.description} · ${formatMoney(expense.amountCents, expense.currency)}`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("expenseId", expense.id);
    startTransition(() => deleteAction(fd));
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-primary/30 bg-surface p-3">
        <form action={editAction} className="space-y-4" noValidate>
          <input type="hidden" name="dateId" value={dateId} />
          <input type="hidden" name="expenseId" value={expense.id} />
          <input type="hidden" name="currency" value={expense.currency} />
          <FormFeedback state={editState} />
          <ExpenseFields
            defaults={toDefaults(expense)}
            fieldErrors={fieldErrors}
            partnerName={partnerName}
            currency={expense.currency}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" pendingText="Saving…">
              Save
            </SubmitButton>
          </div>
        </form>
      </li>
    );
  }

  const splitHint =
    expense.payer === "custom" || expense.payer === "shared"
      ? `You ${formatMoney(expense.mineShareCents, expense.currency)} · ${partnerName} ${formatMoney(
          expense.partnerShareCents,
          expense.currency,
        )}`
      : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          EXPENSE_CATEGORY_COLOR[expense.category],
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{expense.description}</p>
        <p className="truncate text-xs text-muted">
          {EXPENSE_CATEGORY_LABEL[expense.category]} · {PAYER_TEXT[expense.payer]}
          {expense.note ? ` · ${expense.note}` : ""}
        </p>
        {splitHint ? <p className="truncate text-2xs text-faint">{splitHint}</p> : null}
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
        {formatMoney(expense.amountCents, expense.currency)}
      </span>
      <button
        type="button"
        aria-label="Edit expense"
        disabled={deleting}
        onClick={() => setEditing(true)}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-40"
      >
        <Icon name="pencil" size="sm" />
      </button>
      <button
        type="button"
        aria-label="Remove expense"
        disabled={deleting}
        onClick={remove}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-error-tint hover:text-error disabled:opacity-40"
      >
        <Icon name={deleting ? "clock" : "trash"} size="sm" />
      </button>
    </li>
  );
}
