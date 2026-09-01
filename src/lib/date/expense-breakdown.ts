import { ExpenseCategory } from "@prisma/client";

import { EXPENSE_CATEGORY_LABEL } from "@/lib/date/expense-labels";

/** Spending breakdown + a gentle budget verdict — pure, framed to never feel like a telling-off. */

export interface CategorySlice {
  category: ExpenseCategory;
  label: string;
  cents: number;
  /** share of the total, 0–100 */
  pct: number;
}

export function categoryBreakdown(
  expenses: { category: ExpenseCategory; amountCents: number }[],
): CategorySlice[] {
  const total = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  if (total === 0) return [];

  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amountCents);
  }

  return [...byCategory.entries()]
    .map(([category, cents]) => ({
      category,
      label: EXPENSE_CATEGORY_LABEL[category],
      cents,
      pct: Math.round((cents / total) * 100),
    }))
    .sort((a, b) => b.cents - a.cents);
}

export type BudgetState = "under" | "over" | "on" | "unknown";

export interface BudgetDelta {
  plannedCents: number | null;
  actualCents: number | null;
  deltaCents: number | null; // actual − planned
  state: BudgetState;
  /** short, friendly: "£12 under", "right on", "£8 over" */
  label: string;
}

export function budgetDelta(
  plannedCents: number | null,
  actualCents: number | null,
  currency = "USD",
): BudgetDelta {
  if (plannedCents == null || actualCents == null) {
    return { plannedCents, actualCents, deltaCents: null, state: "unknown", label: "" };
  }
  const deltaCents = actualCents - plannedCents;
  const tolerance = Math.max(500, Math.round(plannedCents * 0.05));
  const money = (cents: number) => formatShort(cents, currency);

  if (Math.abs(deltaCents) <= tolerance) {
    return { plannedCents, actualCents, deltaCents, state: "on", label: "right on budget" };
  }
  if (deltaCents < 0) {
    return { plannedCents, actualCents, deltaCents, state: "under", label: `${money(-deltaCents)} under` };
  }
  return { plannedCents, actualCents, deltaCents, state: "over", label: `${money(deltaCents)} over` };
}

function formatShort(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}
