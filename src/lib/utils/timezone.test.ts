import { describe, expect, it } from "vitest";

import { todayYmdInTimeZone, zonedTimeToUtc } from "@/lib/utils/timezone";

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
