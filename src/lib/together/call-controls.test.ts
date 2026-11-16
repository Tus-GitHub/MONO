import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createCallControls } from "./call-controls";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("keeps controls visible before a connected video call is eligible for hiding", () => {
  const controls = createCallControls();
  controls.configure(false); controls.toggle();
  vi.advanceTimersByTime(60_000);
  expect(controls.getSnapshot()).toBe(true);
});

it("hides at five seconds even when signaling repeatedly reports the same connected state", () => {
  const controls = createCallControls();
  controls.configure(true);
  for (let second = 0; second < 4; second++) { vi.advanceTimersByTime(1_000); controls.configure(true); }
  vi.advanceTimersByTime(999); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(1); expect(controls.getSnapshot()).toBe(false);
});

it("lets a tap hide immediately and the next tap show a fresh five-second window", () => {
  const controls = createCallControls();
  controls.configure(true); vi.advanceTimersByTime(2_000);
  controls.interact(); controls.toggle(); expect(controls.getSnapshot()).toBe(false);
  vi.advanceTimersByTime(8_000);
  controls.interact(); expect(controls.getSnapshot()).toBe(false);
  controls.toggle(); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(4_999); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(1); expect(controls.getSnapshot()).toBe(false);
});

it("resets inactivity after interacting with a call control", () => {
  const controls = createCallControls(); controls.configure(true);
  vi.advanceTimersByTime(4_000); controls.interact();
  vi.advanceTimersByTime(4_999); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(1); expect(controls.getSnapshot()).toBe(false);
});

it("reveals and pins controls for audio settings, connection problems or media permissions", () => {
  const controls = createCallControls(); controls.configure(true);
  vi.advanceTimersByTime(5_000); expect(controls.getSnapshot()).toBe(false);
  controls.configure(false); expect(controls.getSnapshot()).toBe(true);
  controls.toggle(); vi.advanceTimersByTime(60_000); expect(controls.getSnapshot()).toBe(true);
  controls.configure(true); vi.advanceTimersByTime(4_999); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(1); expect(controls.getSnapshot()).toBe(false);
});

it("keeps keyboard controls available until the next pointer interaction", () => {
  const controls = createCallControls(); controls.configure(true);
  vi.advanceTimersByTime(5_000); controls.useKeyboard(); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(60_000); expect(controls.getSnapshot()).toBe(true);
  controls.interact(); vi.advanceTimersByTime(5_000); expect(controls.getSnapshot()).toBe(false);
});

it("clears pending work on close and starts fresh when returning to the call", () => {
  const controls = createCallControls(), change = vi.fn();
  const unsubscribe = controls.subscribe(change);
  controls.configure(true); vi.advanceTimersByTime(4_000); controls.stop();
  vi.advanceTimersByTime(60_000); expect(change).not.toHaveBeenCalled();
  expect(controls.getSnapshot()).toBe(true);
  controls.configure(true); vi.advanceTimersByTime(5_000);
  expect(change).toHaveBeenCalledOnce(); expect(controls.getSnapshot()).toBe(false);
  unsubscribe(); controls.stop(); expect(change).toHaveBeenCalledOnce();
});

it("pins controls when their toggle is activated by keyboard or assistive technology", () => {
  const controls = createCallControls(); controls.configure(true);
  controls.toggle(true); expect(controls.getSnapshot()).toBe(false);
  controls.toggle(true); expect(controls.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(60_000); expect(controls.getSnapshot()).toBe(true);
  controls.interact(); vi.advanceTimersByTime(5_000); expect(controls.getSnapshot()).toBe(false);
});

it("keeps the two partners' view controls independent", () => {
  const first = createCallControls(), second = createCallControls();
  first.configure(true); second.configure(true); first.toggle();
  expect(first.getSnapshot()).toBe(false); expect(second.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(3_000); second.interact();
  vi.advanceTimersByTime(3_000); expect(second.getSnapshot()).toBe(true);
  vi.advanceTimersByTime(2_000); expect(second.getSnapshot()).toBe(false);
});
