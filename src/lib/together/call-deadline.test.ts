import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { callDeadline } from "./call-deadline";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("does not misreport a slow pickup as a network error and gives answer its own budget", () => {
  const expired = vi.fn(), deadline = callDeadline(expired), createdAt = new Date().toISOString();
  deadline.observe({ status: "RINGING", createdAt });
  vi.advanceTimersByTime(50_000); expect(expired).not.toHaveBeenCalled();
  deadline.observe({ status: "ACCEPTED", createdAt });
  vi.advanceTimersByTime(30_000);
  deadline.observe({ status: "ACCEPTED", createdAt });
  vi.advanceTimersByTime(10_000); expect(expired.mock.calls).toEqual([["connection"]]);
});
it("reports an unanswered call even when repeated ringing polls arrive", () => {
  const expired = vi.fn(), deadline = callDeadline(expired), createdAt = new Date().toISOString();
  deadline.observe({ status: "RINGING", createdAt });
  vi.advanceTimersByTime(50_000); deadline.observe({ status: "RINGING", createdAt });
  vi.advanceTimersByTime(11_000); expect(expired.mock.calls).toEqual([["unanswered"]]);
});
it("allows a connected call and recovered connection to outlive all deadlines", () => {
  const expired = vi.fn(), deadline = callDeadline(expired);
  deadline.observe({ status: "ACCEPTED", createdAt: new Date().toISOString() });
  deadline.connection("connected"); vi.advanceTimersByTime(90_000);
  deadline.connection("disconnected"); vi.advanceTimersByTime(14_000); deadline.connection("connected");
  vi.advanceTimersByTime(90_000); expect(expired).not.toHaveBeenCalled();
  deadline.connection("disconnected"); vi.advanceTimersByTime(15_000);
  expect(expired.mock.calls).toEqual([["connection"]]);
});
it("cancels the deadline on hang-up and ignores late peer events", () => {
  const expired = vi.fn(), deadline = callDeadline(expired);
  deadline.observe({ status: "RINGING", createdAt: new Date().toISOString() });
  deadline.stop(); deadline.connection("failed"); vi.advanceTimersByTime(120_000);
  expect(expired).not.toHaveBeenCalled();
});
