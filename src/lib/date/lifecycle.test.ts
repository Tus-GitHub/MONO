import { DateStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { assertTransition, canTransition, lifecycleTimestampsFor } from "@/lib/date/lifecycle";
import { InvalidTransitionError } from "@/lib/errors";

describe("date state transitions", () => {
  it("allows the happy-path lifecycle", () => {
    expect(canTransition(DateStatus.DRAFT, DateStatus.PLANNED)).toBe(true);
    expect(canTransition(DateStatus.PLANNED, DateStatus.TODAY)).toBe(true);
    expect(canTransition(DateStatus.TODAY, DateStatus.IN_PROGRESS)).toBe(true);
    expect(canTransition(DateStatus.IN_PROGRESS, DateStatus.COMPLETED)).toBe(true);
  });

  it("lets a completed date reopen to correct actuals, but not jump back to a plan", () => {
    expect(canTransition(DateStatus.COMPLETED, DateStatus.IN_PROGRESS)).toBe(true);
    expect(canTransition(DateStatus.COMPLETED, DateStatus.DRAFT)).toBe(false);
    expect(canTransition(DateStatus.COMPLETED, DateStatus.PLANNED)).toBe(false);
  });

  it("can cancel from any live status but not from a finished one", () => {
    for (const from of [DateStatus.DRAFT, DateStatus.PLANNED, DateStatus.TODAY, DateStatus.IN_PROGRESS]) {
      expect(canTransition(from, DateStatus.CANCELLED)).toBe(true);
    }
    expect(canTransition(DateStatus.COMPLETED, DateStatus.CANCELLED)).toBe(false);
  });

  it("rejects skipping straight from DRAFT to COMPLETED", () => {
    expect(canTransition(DateStatus.DRAFT, DateStatus.COMPLETED)).toBe(false);
    expect(() => assertTransition(DateStatus.DRAFT, DateStatus.COMPLETED)).toThrow(
      InvalidTransitionError,
    );
  });

  it("treats a no-op transition as allowed", () => {
    expect(canTransition(DateStatus.PLANNED, DateStatus.PLANNED)).toBe(true);
  });

  it("stamps the right timestamp column per status", () => {
    expect(lifecycleTimestampsFor(DateStatus.IN_PROGRESS)).toHaveProperty("startedAt");
    expect(lifecycleTimestampsFor(DateStatus.COMPLETED)).toHaveProperty("completedAt");
    expect(lifecycleTimestampsFor(DateStatus.CANCELLED)).toHaveProperty("cancelledAt");
    expect(lifecycleTimestampsFor(DateStatus.TODAY)).toEqual({});
  });
});
