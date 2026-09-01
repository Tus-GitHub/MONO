"use client";

import { useState } from "react";
import { ExpenseCategory } from "@prisma/client";

import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { fieldBase, Input } from "@/components/ui/input";
import {
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_CATEGORY_ORDER,
  type PayerFacing,
} from "@/lib/date/expense-labels";
import type { FieldErrors } from "@/lib/errors";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface ExpenseDefaults {
  description: string;
  amount: string; // dollars, as entered
  category: ExpenseCategory;
  payer: PayerFacing;
  mySharePct: number;
  note: string;
  spentAtLocal: string; // "YYYY-MM-DDTHH:MM" or ""
}

export const EMPTY_EXPENSE: ExpenseDefaults = {
  description: "",
  amount: "",
  category: ExpenseCategory.FOOD,
  payer: "shared",
  mySharePct: 50,
  note: "",
  spentAtLocal: "",
};

const PAYER_CHIPS: { value: PayerFacing; label: string }[] = [
  { value: "me", label: "You paid" },
  { value: "partner", label: "Partner paid" },
  { value: "shared", label: "Split evenly" },
  { value: "custom", label: "Custom split" },
];

/** The shared, fast expense form body — used by quick-add and the edit row. */
export function ExpenseFields({
  defaults = EMPTY_EXPENSE,
  fieldErrors,
  partnerName = "Partner",
  currency = "USD",
}: {
  defaults?: ExpenseDefaults;
  fieldErrors?: FieldErrors;
  partnerName?: string;
  currency?: string;
}) {
  const [amount, setAmount] = useState(defaults.amount);
  const [category, setCategory] = useState<ExpenseCategory>(defaults.category);
  const [payer, setPayer] = useState<PayerFacing>(defaults.payer);
  const [pct, setPct] = useState(defaults.mySharePct);
  const [more, setMore] = useState(Boolean(defaults.note || defaults.spentAtLocal));

  const amountCents = (() => {
    const value = Number(amount);
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  })();
  const mineCustom = amountCents != null ? Math.round((amountCents * pct) / 100) : null;

  return (
    <div className="space-y-4">
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="payer" value={payer} />
      {payer === "custom" ? <input type="hidden" name="mySharePct" value={pct} /> : null}

      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <Field label="Amount" htmlFor="ef-amount" errors={fieldErrors?.amount}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
              $
            </span>
            <Input
              id="ef-amount"
              name="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              className="pl-7"
              invalid={Boolean(fieldErrors?.amount)}
            />
          </div>
        </Field>
        <Field label="What was it?" htmlFor="ef-desc" errors={fieldErrors?.description}>
          <Input
            id="ef-desc"
            name="description"
            defaultValue={defaults.description}
            placeholder="Dinner, cab, tickets…"
            autoComplete="off"
            required
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Kind</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORY_ORDER.map((key) => (
            <Chip key={key} size="sm" selected={category === key} onClick={() => setCategory(key)}>
              {EXPENSE_CATEGORY_LABEL[key]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Who paid?</p>
        <div className="flex flex-wrap gap-1.5">
          {PAYER_CHIPS.map((choice) => (
            <Chip
              key={choice.value}
              size="sm"
              selected={payer === choice.value}
              onClick={() => setPayer(choice.value)}
            >
              {choice.value === "partner" ? `${partnerName} paid` : choice.label}
            </Chip>
          ))}
        </div>
        {payer === "custom" ? (
          <div className="mt-2 rounded-lg border border-line bg-surface/60 p-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Your share</span>
              <span className="tabular-nums text-ink">{pct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct}
              onChange={(event) => setPct(Number(event.target.value))}
              aria-label="Your share of this expense"
              className="mt-1 w-full accent-primary"
            />
            {mineCustom != null ? (
              <p className="mt-1 text-xs text-muted">
                You {formatMoney(mineCustom, currency)} · {partnerName}{" "}
                {formatMoney((amountCents ?? 0) - mineCustom, currency)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setMore((value) => !value)}
        className="text-xs font-medium text-muted transition-colors hover:text-ink"
      >
        {more ? "Fewer details" : "Add a note or time"}
      </button>

      {more ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Note" htmlFor="ef-note" optional>
            <Input
              id="ef-note"
              name="note"
              defaultValue={defaults.note}
              placeholder="Anything worth remembering"
              maxLength={500}
            />
          </Field>
          <Field label="When" htmlFor="ef-when" optional>
            <input
              id="ef-when"
              name="spentAt"
              type="datetime-local"
              defaultValue={defaults.spentAtLocal}
              className={cn(fieldBase, "h-11 px-3.5 text-sm")}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
