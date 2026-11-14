import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

function setup() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const show = vi.fn().mockResolvedValue(undefined), open = vi.fn().mockResolvedValue(undefined);
  const focus = vi.fn().mockResolvedValue(undefined), navigate = vi.fn().mockResolvedValue(undefined), postMessage = vi.fn();
  const clients = [{ url: "https://mono.test/chat?call=old", focus, navigate, postMessage }];
  runInNewContext(readFileSync("public/sw.js", "utf8"), { URL, Date,
    self: { location: { origin: "https://mono.test" }, registration: { showNotification: show }, addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; },
      clients: { matchAll: async () => clients, openWindow: open } } });
  const fire = async (type: string, data: object) => { let work: Promise<unknown> | undefined; handlers[type]({ ...data, waitUntil: (value: Promise<unknown>) => { work = value; } }); await work; };
  return { show, open, focus, navigate, postMessage, clients, fire };
}
it("shows an actionable incoming-call popup and labels a delayed call as missed", async () => {
  const worker = setup(), payload = { callId: "call123", expiresAt: Date.now() + 60_000, title: "Incoming voice call", url: "/chat?call=call123" };
  await worker.fire("push", { data: { json: () => payload } });
  expect(worker.show).toHaveBeenLastCalledWith("Incoming voice call", expect.objectContaining({ actions: [{ action: "open-call", title: "Open MONO" }] }));
  await worker.fire("push", { data: { json: () => ({ ...payload, expiresAt: Date.now() - 1 }) } });
  expect(worker.show).toHaveBeenLastCalledWith("Missed MONO call", expect.not.objectContaining({ actions: expect.anything() }));
});
it("opens the exact call instead of just focusing an unrelated chat and blocks external navigation", async () => {
  const worker = setup(), close = vi.fn();
  await worker.fire("notificationclick", { notification: { close, data: { url: "/chat?call=new" } } });
  expect(worker.navigate).toHaveBeenLastCalledWith("https://mono.test/chat?call=new");
  await worker.fire("notificationclick", { notification: { close, data: { url: "https://attacker.invalid" } } });
  expect(worker.navigate).toHaveBeenLastCalledWith("https://mono.test/notifications");
});
it("reopens a minimized call dialog when its tab already has the same URL", async () => {
  const worker = setup();
  await worker.fire("notificationclick", { notification: { close: vi.fn(), data: { url: "/chat?call=old", callId: "old" } } });
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "OPEN_CALL_NOTIFICATION", callId: "old" });
  expect(worker.navigate).not.toHaveBeenCalled(); expect(worker.focus).toHaveBeenCalledOnce();
});
