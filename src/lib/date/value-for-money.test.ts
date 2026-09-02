import { describe, expect, it } from "vitest";

import { valueForMoney } from "@/lib/date/value-for-money";

describe("valueForMoney — spend tied to the revealed 'Value for money' score", () => {
  it("is unknown until both the spend and the revealed value score exist", () => {
    expect(valueForMoney({ spendCents: null, valueScore: 8 }).tier).toBe("unknown");
    expect(valueForMoney({ spendCents: 5000, valueScore: null }).tier).toBe("unknown");
    expect(valueForMoney({ spendCents: null, valueScore: null }).line).toBe("");
  });

  it("8+ => great, 6–7 => fair, below 6 => steep", () => {
    expect(valueForMoney({ spendCents: 5000, valueScore: 8 }).tier).toBe("great");
    expect(valueForMoney({ spendCents: 5000, valueScore: 10 }).tier).toBe("great");
    expect(valueForMoney({ spendCents: 5000, valueScore: 7 }).tier).toBe("fair");
    expect(valueForMoney({ spendCents: 5000, valueScore: 6 }).tier).toBe("fair");
    expect(valueForMoney({ spendCents: 5000, valueScore: 5 }).tier).toBe("steep");
    expect(valueForMoney({ spendCents: 999_999, valueScore: 1 }).tier).toBe("steep");
  });

  it("passes the inputs straight through and never implies a red/negative tone", () => {
    const v = valueForMoney({ spendCents: 12_345, valueScore: 4 });
    expect(v.spendCents).toBe(12_345);
    expect(v.valueScore).toBe(4);
    expect(v.line.toLowerCase()).not.toMatch(/waste|bad|overpaid|ripoff|rip-off/);
  });
});
