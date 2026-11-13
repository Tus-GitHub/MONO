import { expect, it } from "vitest";
import { UploadQueue, canUploadTransition } from "./upload-queue";

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

it("retries a cancelled preparation with a fresh identity without letting its old finalizer remove the retry", async () => {
  const attempts: { id: string; signal: AbortSignal; finish: () => void }[] = [];
  const queue = new UploadQueue<string>(1, (id, _file, signal) => new Promise((finish) => attempts.push({ id, signal, finish })));
  queue.enqueue("photo", "file"); await flush();
  queue.cancel("photo"); queue.enqueue("photo", "retry");
  expect(attempts[0].signal.aborted).toBe(true);
  expect(attempts).toHaveLength(1);
  attempts[0].finish(); await flush();
  expect(attempts).toHaveLength(2);
  expect(attempts[1].signal.aborted).toBe(false);
  queue.cancel("photo"); expect(attempts[1].signal.aborted).toBe(true);
  attempts[1].finish(); await flush();
});

it("bounds concurrency, removes queued cancellations, and releases slots after errors", async () => {
  const started: string[] = [];
  const finishers: (() => void)[] = [];
  const queue = new UploadQueue<string>(2, async (id) => {
    started.push(id);
    if (id === "broken") throw new Error("resize failed");
    await new Promise<void>((resolve) => finishers.push(resolve));
  });
  queue.enqueue("one", ""); queue.enqueue("broken", ""); queue.enqueue("cancelled", ""); queue.enqueue("last", "");
  queue.cancel("cancelled"); await flush();
  expect(started).toEqual(["one", "broken", "last"]);
  queue.cancelAll(); finishers.forEach((finish) => finish()); await flush();
});

it("deduplicates the same queued item and rejects terminal-state callbacks", async () => {
  let calls = 0;
  const queue = new UploadQueue<string>(1, async () => { calls++; });
  queue.enqueue("same", ""); queue.enqueue("same", ""); await flush();
  expect(calls).toBe(1);
  expect(canUploadTransition("canceled", "done")).toBe(false);
  expect(canUploadTransition("done", "uploading")).toBe(false);
  expect(canUploadTransition("error", "queued")).toBe(true);
});
