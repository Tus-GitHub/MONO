import { ExpensePayer } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  contributionsOf,
  ownerShareOf,
  payerFacing,
  resolvePayer,
} from "@/lib/date/expense-split";

describe("ownerShareOf — one expense", () => {
  it("SHARED splits evenly (rounded), never assumed elsewhere", () => {
    expect(ownerShareOf({ amountCents: 6000, paidBy: ExpensePayer.SHARED, ownerShareCents: null })).toBe(3000);
    expect(ownerShareOf({ amountCents: 5001, paidBy: ExpensePayer.SHARED, ownerShareCents: null })).toBe(2501);
  });
  it("OWNER / PARTNER assign the whole line", () => {
    expect(ownerShareOf({ amountCents: 4200, paidBy: ExpensePayer.OWNER, ownerShareCents: null })).toBe(4200);
    expect(ownerShareOf({ amountCents: 4200, paidBy: ExpensePayer.PARTNER, ownerShareCents: null })).toBe(0);
  });
  it("CUSTOM uses the explicit owner share, clamped to the amount", () => {
    expect(ownerShareOf({ amountCents: 5000, paidBy: ExpensePayer.CUSTOM, ownerShareCents: 1500 })).toBe(1500);
    expect(ownerShareOf({ amountCents: 5000, paidBy: ExpensePayer.CUSTOM, ownerShareCents: 9999 })).toBe(5000);
    expect(ownerShareOf({ amountCents: 5000, paidBy: ExpensePayer.CUSTOM, ownerShareCents: -5 })).toBe(0);
  });
  it("CUSTOM with no explicit share falls back to half", () => {
    expect(ownerShareOf({ amountCents: 5000, paidBy: ExpensePayer.CUSTOM, ownerShareCents: null })).toBe(2500);
  });
});

describe("contributionsOf — a list of expenses", () => {
  it("$60 SHARED → 30 / 30", () => {
    const c = contributionsOf([{ amountCents: 6000, paidBy: ExpensePayer.SHARED, ownerShareCents: null }]);
    expect(c).toEqual({ totalCents: 6000, ownerCents: 3000, partnerCents: 3000 });
  });
  it("$50 CUSTOM (owner $15) → owner 15 / partner 35", () => {
    const c = contributionsOf([{ amountCents: 5000, paidBy: ExpensePayer.CUSTOM, ownerShareCents: 1500 }]);
    expect(c).toEqual({ totalCents: 5000, ownerCents: 1500, partnerCents: 3500 });
  });
  it("mixed modes sum independently", () => {
    const c = contributionsOf([
      { amountCents: 4000, paidBy: ExpensePayer.OWNER, ownerShareCents: null },
      { amountCents: 2000, paidBy: ExpensePayer.SHARED, ownerShareCents: null },
      { amountCents: 1000, paidBy: ExpensePayer.PARTNER, ownerShareCents: null },
    ]);
    expect(c.totalCents).toBe(7000);
    expect(c.ownerCents).toBe(5000);
    expect(c.partnerCents).toBe(2000);
  });
});

describe("resolvePayer — viewer-relative form choice → stored columns", () => {
  it("OWNER filling 'me' stores OWNER", () => {
    expect(resolvePayer({ choice: "me", myRole: "OWNER", amountCents: 1000 })).toEqual({
      paidBy: ExpensePayer.OWNER,
      ownerShareCents: null,
    });
  });
  it("PARTNER filling 'me' stores PARTNER", () => {
    expect(resolvePayer({ choice: "me", myRole: "PARTNER", amountCents: 1000 })).toEqual({
      paidBy: ExpensePayer.PARTNER,
      ownerShareCents: null,
    });
  });
  it("PARTNER filling 'partner' means the OWNER paid", () => {
    expect(resolvePayer({ choice: "partner", myRole: "PARTNER", amountCents: 1000 }).paidBy).toBe(
      ExpensePayer.OWNER,
    );
  });
  it("custom 40% by the PARTNER → ownerShareCents is the remainder", () => {
    const r = resolvePayer({ choice: "custom", myRole: "PARTNER", amountCents: 5000, mySharePct: 40 });
    expect(r.paidBy).toBe(ExpensePayer.CUSTOM);
    expect(r.ownerShareCents).toBe(3000); // 5000 − 2000
  });
  it("round-trips through payerFacing for each viewer", () => {
    expect(payerFacing(ExpensePayer.OWNER, "OWNER")).toBe("me");
    expect(payerFacing(ExpensePayer.OWNER, "PARTNER")).toBe("partner");
    expect(payerFacing(ExpensePayer.SHARED, "PARTNER")).toBe("shared");
    expect(payerFacing(ExpensePayer.CUSTOM, "OWNER")).toBe("custom");
  });
});
