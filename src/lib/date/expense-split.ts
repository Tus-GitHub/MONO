import { ExpensePayer } from "@prisma/client";

/**
 * Who carried what — pure. `paidBy` names the split *mode*; each person's share of one
 * expense is derived, and never assumed to be an even 50/50 (that's only `SHARED`). All maths
 * is done in the canonical OWNER / PARTNER frame; callers translate to "me / them" for display.
 */

export interface ExpenseShareInput {
  amountCents: number;
  paidBy: ExpensePayer;
  /** OWNER's portion when `paidBy = CUSTOM`; ignored otherwise. */
  ownerShareCents: number | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The OWNER role's share of a single expense's cost. */
export function ownerShareOf(expense: ExpenseShareInput): number {
  switch (expense.paidBy) {
    case ExpensePayer.OWNER:
      return expense.amountCents;
    case ExpensePayer.PARTNER:
      return 0;
    case ExpensePayer.SHARED:
      return Math.round(expense.amountCents / 2);
    case ExpensePayer.CUSTOM:
      return clamp(
        expense.ownerShareCents ?? Math.round(expense.amountCents / 2),
        0,
        expense.amountCents,
      );
  }
}

export interface Contributions {
  totalCents: number;
  ownerCents: number;
  partnerCents: number;
}

export function contributionsOf(expenses: ExpenseShareInput[]): Contributions {
  let totalCents = 0;
  let ownerCents = 0;
  for (const expense of expenses) {
    totalCents += expense.amountCents;
    ownerCents += ownerShareOf(expense);
  }
  return { totalCents, ownerCents, partnerCents: totalCents - ownerCents };
}

/**
 * Turn a "me / partner / shared / custom" choice from a form into a stored `paidBy` +
 * `ownerShareCents`, given the acting person's role and (for custom) their own percentage.
 */
export function resolvePayer(input: {
  choice: "me" | "partner" | "shared" | "custom";
  myRole: "OWNER" | "PARTNER";
  amountCents: number;
  /** the acting person's own share, 0–100, when `choice = "custom"`. */
  mySharePct?: number | null;
}): { paidBy: ExpensePayer; ownerShareCents: number | null } {
  const iAmOwner = input.myRole === "OWNER";

  if (input.choice === "shared") return { paidBy: ExpensePayer.SHARED, ownerShareCents: null };
  if (input.choice === "me") {
    return { paidBy: iAmOwner ? ExpensePayer.OWNER : ExpensePayer.PARTNER, ownerShareCents: null };
  }
  if (input.choice === "partner") {
    return { paidBy: iAmOwner ? ExpensePayer.PARTNER : ExpensePayer.OWNER, ownerShareCents: null };
  }

  const myPct = clamp(input.mySharePct ?? 50, 0, 100);
  const myCents = Math.round((input.amountCents * myPct) / 100);
  const ownerShareCents = iAmOwner ? myCents : input.amountCents - myCents;
  return { paidBy: ExpensePayer.CUSTOM, ownerShareCents };
}

/** Viewer-relative label for one expense's split. */
export function payerFacing(
  paidBy: ExpensePayer,
  myRole: "OWNER" | "PARTNER",
): "me" | "partner" | "shared" | "custom" {
  if (paidBy === ExpensePayer.SHARED) return "shared";
  if (paidBy === ExpensePayer.CUSTOM) return "custom";
  const iAmOwner = myRole === "OWNER";
  if (paidBy === ExpensePayer.OWNER) return iAmOwner ? "me" : "partner";
  return iAmOwner ? "partner" : "me";
}
