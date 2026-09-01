"use client";

import { QuickExpenseButton } from "@/components/dates/quick-expense-button";
import { ExpenseRow, type ExpenseView } from "@/components/dates/expense-row";
import type { BudgetDelta, CategorySlice } from "@/lib/date/expense-breakdown";
import { EXPENSE_CATEGORY_COLOR } from "@/lib/date/expense-labels";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface SpendingView {
  currency: string;
  totalCents: number;
  expenseCount: number;
  actualSpendCents: number | null;
  effectiveSpendCents: number | null;
  plannedTotalCents: number | null;
  plannedMinCents: number | null;
  plannedMaxCents: number | null;
  delta: BudgetDelta;
  categories: CategorySlice[];
  contributions: { mineCents: number; partnerCents: number; partnerName: string };
}

const DELTA_TONE: Record<BudgetDelta["state"], string> = {
  under: "bg-success-tint text-success",
  on: "bg-line/60 text-muted",
  over: "bg-warning-tint text-warning",
  unknown: "",
};

export function DateSpending({
  dateId,
  spending,
  expenses,
  partnerName,
}: {
  dateId: string;
  spending: SpendingView;
  expenses: ExpenseView[];
  partnerName: string;
}) {
  const { currency } = spending;
  const planned = spending.plannedTotalCents;
  const spent = spending.effectiveSpendCents;
  const contrib = spending.contributions;
  const contribTotal = contrib.mineCents + contrib.partnerCents;

  return (
    <section id="spending" className="scroll-mt-20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium text-ink">
          Spending
          {spending.totalCents > 0 ? (
            <span className="text-muted"> · {formatMoney(spending.totalCents, currency)}</span>
          ) : null}
        </h2>
        <QuickExpenseButton
          dateId={dateId}
          currency={currency}
          partnerName={partnerName}
          size="sm"
        />
      </div>

      {/* Budget vs actual */}
      {planned != null || spent != null ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-faint">Planned</p>
              <p className="text-sm font-medium text-ink">
                {planned != null
                  ? spending.plannedMinCents != null || spending.plannedMaxCents != null
                    ? `${formatMoney(spending.plannedMinCents ?? planned, currency)}–${formatMoney(
                        spending.plannedMaxCents ?? planned,
                        currency,
                      )}`
                    : formatMoney(planned, currency)
                  : "none set"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xs font-medium uppercase tracking-wide text-faint">Spent</p>
              <p className="text-sm font-semibold text-ink">
                {spent != null ? formatMoney(spent, currency) : "—"}
              </p>
            </div>
          </div>

          {planned != null && spent != null ? (
            <>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={cn(
                    "h-full rounded-full",
                    spending.delta.state === "over" ? "bg-warning" : "bg-success",
                  )}
                  style={{ width: `${Math.min(100, Math.round((spent / Math.max(planned, 1)) * 100))}%` }}
                />
              </div>
              {spending.delta.state !== "unknown" ? (
                <p className="mt-2 text-xs">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      DELTA_TONE[spending.delta.state],
                    )}
                  >
                    {spending.delta.label}
                  </span>
                  {spending.delta.state === "over" ? (
                    <span className="ml-1.5 text-faint">no drama</span>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : planned == null ? (
            <p className="mt-2 text-xs text-muted">No budget was set for this one.</p>
          ) : null}
        </div>
      ) : null}

      {/* Category breakdown */}
      {spending.categories.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">Where it went</p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
            {spending.categories.map((slice) => (
              <span
                key={slice.category}
                className={cn("h-full", EXPENSE_CATEGORY_COLOR[slice.category])}
                style={{ width: `${slice.pct}%` }}
                title={`${slice.label} ${slice.pct}%`}
              />
            ))}
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {spending.categories.map((slice) => (
              <li key={slice.category} className="flex items-center gap-2 text-xs">
                <span
                  className={cn("size-2 shrink-0 rounded-full", EXPENSE_CATEGORY_COLOR[slice.category])}
                />
                <span className="flex-1 text-muted">{slice.label}</span>
                <span className="tabular-nums text-ink">
                  {formatMoney(slice.cents, currency)}
                </span>
                <span className="w-8 text-right tabular-nums text-faint">{slice.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Who paid */}
      {contribTotal > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">Each of you put in</p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
            <span
              className="h-full bg-primary"
              style={{ width: `${Math.round((contrib.mineCents / contribTotal) * 100)}%` }}
            />
            <span
              className="h-full bg-accent"
              style={{ width: `${Math.round((contrib.partnerCents / contribTotal) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span>
              <span className="mr-1 inline-block size-2 rounded-full bg-primary align-middle" />
              You <span className="tabular-nums text-ink">{formatMoney(contrib.mineCents, currency)}</span>
            </span>
            <span>
              <span className="mr-1 inline-block size-2 rounded-full bg-accent align-middle" />
              {contrib.partnerName}{" "}
              <span className="tabular-nums text-ink">
                {formatMoney(contrib.partnerCents, currency)}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {/* Lines */}
      {expenses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">
          No expenses logged. Add them as you go — it stays quick.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              dateId={dateId}
              expense={expense}
              partnerName={partnerName}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
