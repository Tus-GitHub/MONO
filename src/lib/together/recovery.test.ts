import { afterEach, expect, it, vi } from "vitest";
import { TogetherRequestError, togetherFetch } from "./client";
import { pollHealth, retryDelay, retryRead } from "./recovery";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("retries transient reads without restarting the consumer", async () => {
  vi.useFakeTimers(); const read = vi.fn().mockRejectedValueOnce(new TogetherRequestError("busy", 503)).mockRejectedValueOnce(new TypeError("network")).mockResolvedValue("delivered");
  const done = retryRead(read); await vi.runAllTimersAsync(); expect(await done).toBe("delivered"); expect(read).toHaveBeenCalledTimes(3);
});
it("does not retry access failures or write requests", async () => {
  const error = new TogetherRequestError("sign in", 401), read = vi.fn().mockRejectedValue(error);
  await expect(retryRead(read)).rejects.toBe(error); expect(read).toHaveBeenCalledTimes(1);
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({error:"busy"}), {status:503})); vi.stubGlobal("fetch", fetch);
  await expect(togetherFetch("/api/together", {body:{message:"ciphertext"}})).rejects.toMatchObject({status:503}); expect(fetch).toHaveBeenCalledTimes(1);
});
it("keeps HTTP status for HTML gateway errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", {status:502})));
  await expect(togetherFetch("/api/together")).rejects.toMatchObject({status:502});
});
it("aborts a scheduled retry without sending another request", async () => {
  vi.useFakeTimers(); const controller = new AbortController(), read = vi.fn().mockRejectedValue(new TypeError("offline"));
  const done = retryRead(read, controller.signal); const rejected = expect(done).rejects.toMatchObject({name:"AbortError"});
  await Promise.resolve(); controller.abort(); await rejected; await vi.runAllTimersAsync(); expect(read).toHaveBeenCalledTimes(1);
});
it("shows persistent outages and authorization errors, not a single short delay", () => {
  const health = pollHealth(0), error = new TypeError("network");
  expect(health.failure(error, 1000).show).toBe(false); expect(health.failure(error, 3000).show).toBe(false); expect(health.failure(error, 5000).show).toBe(true);
  health.success(6000); expect(health.failure(error, 7000).show).toBe(false); expect(health.failure(error, 28000).show).toBe(true);
  health.success(29000); expect(health.failure(new TogetherRequestError("sign in", 401), 29001).show).toBe(true);
});
it("caps retry pressure", () => { expect([1,2,3,4,5,100].map(retryDelay)).toEqual([1000,2000,4000,8000,15000,15000]); });
