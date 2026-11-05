import { describe, expect, it } from "vitest";

import { minutesInTimeZone, planTimeToInstant, todayYmdInTimeZone, zonedTimeToUtc } from "@/lib/utils/timezone";

describe("zonedTimeToUtc — the day-of reminder is 09:00 *local*, not 09:00 UTC", () => {
  it("UTC zone: 09:00 stays 09:00Z", () => {
    expect(zonedTimeToUtc("2026-03-10", 9, 0, "UTC").toISOString()).toBe("2026-03-10T09:00:00.000Z");
  });

  it("New York (winter, UTC−5): 09:00 local = 14:00Z", () => {
    expect(zonedTimeToUtc("2026-01-15", 9, 0, "America/New_York").toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("New York (summer DST, UTC−4): 09:00 local = 13:00Z", () => {
    expect(zonedTimeToUtc("2026-07-15", 9, 0, "America/New_York").toISOString()).toBe(
      "2026-07-15T13:00:00.000Z",
    );
  });

  it("Kolkata (UTC+5:30): 09:00 local = 03:30Z", () => {
    expect(zonedTimeToUtc("2026-06-01", 9, 0, "Asia/Kolkata").toISOString()).toBe(
      "2026-06-01T03:30:00.000Z",
    );
  });

  it("falls back to treating the wall time as UTC for an unknown zone", () => {
    expect(zonedTimeToUtc("2026-06-01", 9, 0, "Not/AZone").toISOString()).toBe(
      "2026-06-01T09:00:00.000Z",
    );
  });
});

describe("plan wall clock to actual instant", () => {
  it("converts a Kolkata 19:00 plan without mutating its stored wall clock", () => {
    const stored = new Date("2026-11-06T19:00:00Z");
    expect(planTimeToInstant(stored, "Asia/Kolkata")?.toISOString()).toBe("2026-11-06T13:30:00.000Z");
    expect(stored.toISOString()).toBe("2026-11-06T19:00:00.000Z");
  });
  it("converts local midnight even when the UTC instant is the preceding day", () => {
    expect(planTimeToInstant(new Date("2026-11-06T00:00:00Z"), "Asia/Kolkata")?.toISOString()).toBe("2026-11-05T18:30:00.000Z");
    expect(planTimeToInstant(null, "UTC")).toBeNull();
  });
  it("tracks daylight savings on both sides of the transition", () => {
    expect(planTimeToInstant(new Date("2026-03-07T19:00:00Z"), "America/New_York")?.toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(planTimeToInstant(new Date("2026-03-08T19:00:00Z"), "America/New_York")?.toISOString()).toBe("2026-03-08T23:00:00.000Z");
  });
  it("day mode uses the couple's local clock rather than the device zone", () => {
    const now = new Date("2026-11-06T13:30:00Z");
    expect(minutesInTimeZone("Asia/Kolkata", now)).toBe(19 * 60);
    expect(minutesInTimeZone("America/New_York", now)).toBe(8 * 60 + 30);
  });
});

describe("todayYmdInTimeZone", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayYmdInTimeZone("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("can differ across zones at the same instant", () => {
    const instant = new Date("2026-06-01T23:30:00.000Z");
    expect(todayYmdInTimeZone("Pacific/Kiritimati", instant)).toBe("2026-06-02"); // UTC+14
    expect(todayYmdInTimeZone("Pacific/Midway", instant)).toBe("2026-06-01"); // UTC−11
  });
});
