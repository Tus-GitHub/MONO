import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type WorkerEvent = { waitUntil: (work: Promise<unknown>) => void; data?: string };
function worker() {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const skipWaiting = vi.fn();
  const claim = vi.fn();
  const remove = vi.fn().mockResolvedValue(true);
  runInNewContext(readFileSync(resolve("public/sw.js"), "utf8"), {
    self: { addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler), skipWaiting, clients: { claim } },
    caches: {
      open: async () => ({ addAll: async () => {} }),
      keys: async () => ["mono-v1-static", "mono-v2-static", "mono-v3-static", "mono-v3-precache"], delete: remove,
    },
  });
  return { handlers, skipWaiting, claim, remove };
}

it("does not force an installed replacement to take over until Refresh is requested", async () => {
  const state = worker();
  let completion: Promise<unknown> | undefined;
  state.handlers.get("install")!({ waitUntil: (work) => { completion = work; } });
  await completion;
  expect(state.skipWaiting).not.toHaveBeenCalled();
  state.handlers.get("message")!({ data: "SKIP_WAITING", waitUntil: () => {} });
  expect(state.skipWaiting).toHaveBeenCalledOnce();
});

it("claims clients on activation and removes only obsolete cache versions", async () => {
  const state = worker();
  let completion: Promise<unknown> | undefined;
  state.handlers.get("activate")!({ waitUntil: (work) => { completion = work; } });
  await completion;
  expect(state.remove).toHaveBeenCalledTimes(2);
  expect(state.remove).toHaveBeenCalledWith("mono-v1-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v2-static");
  expect(state.remove).not.toHaveBeenCalledWith("mono-v3-static");
  expect(state.remove).not.toHaveBeenCalledWith("mono-v3-precache");
  expect(state.claim).toHaveBeenCalledOnce();
});
