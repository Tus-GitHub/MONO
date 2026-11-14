import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { togetherFetch } from "./client";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function serverAfter(delay: number) {
  vi.stubGlobal("fetch", vi.fn((_path, options: RequestInit) => new Promise<Response>((resolve, reject) => {
    const finish = setTimeout(() => resolve(Response.json({ id: "saved-photo" })), delay);
    options.signal?.addEventListener("abort", () => {
      clearTimeout(finish);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  })));
}

it("accepts a photo that saves after the ordinary chat deadline", async () => {
  serverAfter(20_000);
  const result = togetherFetch("/api/together/images?nonce=test", { body: new FormData() });
  const completed = expect(result).resolves.toEqual({ id: "saved-photo" });
  await vi.advanceTimersByTimeAsync(20_000);
  await completed;
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps ordinary chat requests bounded by their shorter deadline", async () => {
  serverAfter(20_000);
  const completed = expect(togetherFetch("/api/together", { body: { kind: "TEXT", body: "Hello" } })).rejects.toThrow("your message is kept");
  await vi.advanceTimersByTimeAsync(15_000);
  await completed;
  expect(vi.getTimerCount()).toBe(0);
});

it("still times out a stalled upload and keeps the photo available to retry", async () => {
  serverAfter(180_000);
  const completed = expect(togetherFetch("/api/together/images?nonce=test", { body: new FormData() })).rejects.toThrow("your photo is kept");
  await vi.advanceTimersByTimeAsync(120_000);
  await completed;
  expect(vi.getTimerCount()).toBe(0);
});

it("honors caller cancellation during a photo upload", async () => {
  serverAfter(20_000);
  const controller = new AbortController();
  const completed = expect(togetherFetch("/api/together/images?nonce=test", { body: new FormData(), signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await completed;
  expect(vi.getTimerCount()).toBe(0);
});
