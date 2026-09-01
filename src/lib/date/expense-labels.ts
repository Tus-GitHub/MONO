import { ExpenseCategory, ExpensePayer } from "@prisma/client";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  FOOD: "Food",
  DRINKS: "Drinks",
  TRANSPORT: "Travel",
  TICKETS: "Tickets",
  SHOPPING: "Shopping",
  ACCOMMODATION: "Stay",
  GIFTS: "Gifts",
  ACTIVITY: "Activity",
  OTHER: "Other",
};

/** The quick-add order — most common first. */
export const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  ExpenseCategory.FOOD,
  ExpenseCategory.DRINKS,
  ExpenseCategory.TICKETS,
  ExpenseCategory.ACTIVITY,
  ExpenseCategory.TRANSPORT,
  ExpenseCategory.SHOPPING,
  ExpenseCategory.ACCOMMODATION,
  ExpenseCategory.GIFTS,
  ExpenseCategory.OTHER,
];

/** Solid token class for the breakdown bar / legend dot. */
export const EXPENSE_CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  FOOD: "bg-primary",
  DRINKS: "bg-accent",
  TICKETS: "bg-success",
  ACTIVITY: "bg-rating",
  TRANSPORT: "bg-warning",
  SHOPPING: "bg-primary/55",
  ACCOMMODATION: "bg-accent/55",
  GIFTS: "bg-success/55",
  OTHER: "bg-line-strong",
};

/** Canonical labels (owner's frame). Forms use viewer-relative "me / partner" instead. */
export const EXPENSE_PAYER_LABEL: Record<ExpensePayer, string> = {
  SHARED: "Split evenly",
  OWNER: "One of you",
  PARTNER: "The other",
  CUSTOM: "Custom split",
};

export type PayerFacing = "me" | "partner" | "shared" | "custom";

export const PAYER_FACING_LABEL: Record<PayerFacing, string> = {
  me: "You",
  partner: "Partner",
  shared: "Split",
  custom: "Custom",
};
