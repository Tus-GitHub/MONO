import { afterEach, expect, it, vi } from "vitest";
import { requestNotificationPermission, notificationSetupError, watchNotificationPermission } from "./browser-permission";
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

function settingsFixture() {
  const browser = new EventTarget(), page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const api = { permission: "denied" as NotificationPermission, requestPermission: vi.fn(() => undefined) };
  vi.stubGlobal("window", browser); vi.stubGlobal("document", page); vi.stubGlobal("Notification", api);
  vi.stubGlobal("navigator", { permissions: { query: vi.fn(() => { throw new Error("unsupported permission"); }) } });
  return { browser, page, api };
}

it("rechecks external permission on return from settings without requesting again", () => {
  const { browser, page, api } = settingsFixture();
  const changed = vi.fn(), stop = watchNotificationPermission(changed);
  browser.dispatchEvent(new Event("focus")); expect(changed).not.toHaveBeenCalled();
  api.permission = "granted"; page.dispatchEvent(new Event("visibilitychange"));
  expect(changed).toHaveBeenCalledWith("granted");
  browser.dispatchEvent(new Event("focus")); expect(changed).toHaveBeenCalledOnce();
  expect(api.requestPermission).not.toHaveBeenCalled();
  stop(); api.permission = "denied"; browser.dispatchEvent(new Event("focus"));
  expect(changed).toHaveBeenCalledOnce();
});

it("finishes a silent request when settings grant permission, and removes its listeners", async () => {
  vi.useFakeTimers();
  const { browser, api } = settingsFixture(); api.permission = "default";
  const remove = vi.spyOn(browser, "removeEventListener");
  const result = requestNotificationPermission(new AbortController().signal);
  expect(api.requestPermission).toHaveBeenCalledOnce();
  api.permission = "granted"; browser.dispatchEvent(new Event("focus"));
  await expect(result).resolves.toBe("granted");
  expect(remove).toHaveBeenCalledWith("focus", expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

it("does not open a permission request after cancellation", async () => {
  const { api } = settingsFixture(); api.permission = "default";
  const controller = new AbortController(); controller.abort();
  await expect(requestNotificationPermission(controller.signal)).rejects.toThrow("cancelled");
  expect(api.requestPermission).not.toHaveBeenCalled();
});
