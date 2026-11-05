import { afterEach, expect, it } from "vitest";
import { dateTimeInTimeZone, isValidLocalDateTime, localDateTimeToUtc } from "@/lib/utils/timezone";
import { dateExpenseSchema } from "@/lib/validation/date";

const originalZone = process.env.TZ;
afterEach(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });

it("formats an expense instant in the couple timezone rather than truncating its UTC timestamp", () => {
  expect(dateTimeInTimeZone(new Date("2026-11-05T12:15:47.123Z"), "Asia/Kolkata")).toBe("2026-11-05T17:45");
});

it.each([
  ["Asia/Kolkata", "2026-11-06T00:15", "2026-11-05T18:45:00.000Z"],
  ["Asia/Kathmandu", "2026-11-06T00:15", "2026-11-05T18:30:00.000Z"],
  ["Australia/Lord_Howe", "2026-07-01T09:00", "2026-06-30T22:30:00.000Z"],
  ["UTC", "2026-11-06T00:15", "2026-11-06T00:15:00.000Z"],
])("converts a local expense time in %s to a real UTC instant", (zone, local, instant) => {
  expect(localDateTimeToUtc(local, zone).toISOString()).toBe(instant);
});

it.each([
  ["America/New_York", "2026-03-08T02:30"],
  ["Australia/Lord_Howe", "2026-10-04T02:15"],
])("rejects a non-existent local clock time in %s", (zone, local) => {
  expect(() => localDateTimeToUtc(local, zone)).toThrow("does not exist");
});

it.each([
  ["America/New_York", "2026-11-01T01:30", "2026-11-01T05:30:00.000Z"],
  ["Europe/Berlin", "2026-10-25T02:30", "2026-10-25T00:30:00.000Z"],
])("chooses the earlier occurrence of a repeated local clock time in %s", (zone, local, instant) => {
  expect(localDateTimeToUtc(local, zone).toISOString()).toBe(instant);
});

it.each(["2026-02-30T12:00", "2026-13-01T12:00", "2026-01-01T25:00", "2026-01-01T12:00Z"])("rejects invalid local datetime %s", (value) => {
  expect(isValidLocalDateTime(value)).toBe(false);
});

it("does not silently replace an invalid timezone with UTC", () => {
  expect(() => localDateTimeToUtc("2026-11-05T18:00", "Not/AZone")).toThrow();
});

it("produces the same instant across server timezones", () => {
  for (const serverZone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
    process.env.TZ = serverZone;
    expect(localDateTimeToUtc("2026-11-06T00:15", "Asia/Kolkata").toISOString()).toBe("2026-11-05T18:45:00.000Z");
  }
});

const form = { description: "Dinner", amount: "12.50" };
it("accepts a valid wall-clock field without prematurely coercing it into the server timezone", () => {
  expect(dateExpenseSchema.parse({ ...form, spentAtLocal: "2024-02-29T18:30" }).spentAtLocal).toBe("2024-02-29T18:30");
});
it("keeps explicit instant API input compatible", () => {
  expect(dateExpenseSchema.parse({ ...form, spentAt: "2026-11-05T18:00:00+05:30" }).spentAt?.toISOString()).toBe("2026-11-05T12:30:00.000Z");
});
it("keeps Date-valued service input compatible", () => {
  const instant = new Date("2026-11-05T12:30:00Z");
  expect(dateExpenseSchema.parse({ ...form, spentAt: instant }).spentAt).toEqual(instant);
});
it("rejects ambiguous offset-free input in the instant field", () => {
  expect(dateExpenseSchema.safeParse({ ...form, spentAt: "2026-11-05T18:00" }).success).toBe(false);
});
it("rejects a rolled-over calendar date in the local field", () => {
  expect(dateExpenseSchema.safeParse({ ...form, spentAtLocal: "2026-02-30T18:00" }).success).toBe(false);
});
it("rejects two conflicting representations of the time", () => {
  expect(dateExpenseSchema.safeParse({ ...form, spentAt: new Date(), spentAtLocal: "2026-11-05T18:00" }).success).toBe(false);
});
it("allows an omitted time so creation can use now and editing can preserve the stored instant", () => {
  expect(dateExpenseSchema.parse({ ...form, spentAtLocal: "" }).spentAtLocal).toBeUndefined();
});
