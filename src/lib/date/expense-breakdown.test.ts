import { ExpenseCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { budgetDelta, categoryBreakdown } from "@/lib/date/expense-breakdown";

describe("categoryBreakdown", () => {
  it("groups, computes percentages, and sorts by spend", () => {
    const slices = categoryBreakdown([
      { category: ExpenseCategory.FOOD, amountCents: 6000 },
      { category: ExpenseCategory.FOOD, amountCents: 2000 },
      { category: ExpenseCategory.TICKETS, amountCents: 2000 },
    ]);
    expect(slices.map((s) => s.category)).toEqual([ExpenseCategory.FOOD, ExpenseCategory.TICKETS]);
    expect(slices[0].cents).toBe(8000);
    expect(slices[0].pct).toBe(80);
    expect(slices[1].pct).toBe(20);
  });

  it("returns nothing for no spend", () => {
    expect(categoryBreakdown([])).toEqual([]);
  });
});

describe("budgetDelta — gentle, never a telling-off", () => {
  it("is 'unknown' with a missing side", () => {
    expect(budgetDelta(null, 5000).state).toBe("unknown");
    expect(budgetDelta(5000, null).state).toBe("unknown");
  });

  it("treats within 5% / $5 as right on budget", () => {
    expect(budgetDelta(10000, 10300).state).toBe("on"); // 3% over
    expect(budgetDelta(10000, 9600).state).toBe("on"); // 4% under
    expect(budgetDelta(200, 600).state).toBe("on"); // within the $5 floor
  });

  it("flags a real under/over with a friendly label and no error tone", () => {
    const under = budgetDelta(10000, 8000);
    expect(under.state).toBe("under");
    expect(under.deltaCents).toBe(-2000);
    expect(under.label).toMatch(/under$/);

    const over = budgetDelta(10000, 13000);
    expect(over.state).toBe("over");
    expect(over.deltaCents).toBe(3000);
    expect(over.label).toMatch(/over$/);
  });
});
