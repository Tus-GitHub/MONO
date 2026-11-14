import { afterEach, expect, it, vi } from "vitest";
import { requestNotificationPermission, notificationSetupError } from "./browser-permission";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("requests permission synchronously and supports callback-only browsers", async () => {
  let complete!: (value: NotificationPermission) => void;
  const request = vi.fn((callback) => { complete = callback; });
  vi.stubGlobal("Notification", { permission: "default", requestPermission: request });
  const result = requestNotificationPermission(new AbortController().signal);
  expect(request).toHaveBeenCalledOnce(); complete("granted"); await expect(result).resolves.toBe("granted");
});
it("supports promise permission APIs and does not re-prompt a denied user", async () => {
  const request = vi.fn().mockResolvedValue("default");
  vi.stubGlobal("Notification", { permission: "default", requestPermission: request });
  await expect(requestNotificationPermission(new AbortController().signal)).resolves.toBe("default");
  vi.stubGlobal("Notification", { permission: "denied", requestPermission: request });
  await expect(requestNotificationPermission(new AbortController().signal)).resolves.toBe("denied");
  expect(request).toHaveBeenCalledOnce();
});
it("bounds a silent permission prompt and gives stage-specific recovery", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Notification", { permission: "default", requestPermission: () => undefined });
  const result = expect(requestNotificationPermission(new AbortController().signal)).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(60_000); await result;
  expect(notificationSetupError("permission", null)).toContain("Samsung Internet");
  expect(notificationSetupError("device", new DOMException("denied", "NotAllowedError"))).toContain("blocked");
  expect(notificationSetupError("save", null)).toContain("account");
});
