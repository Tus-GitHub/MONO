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
  const addAll = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync(resolve("public/sw.js"), "utf8"), {
    Request, URL,
    self: { location: { origin: "https://amor-together.vercel.app" }, addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler), skipWaiting, clients: { claim } },
    caches: {
      open: async () => ({ addAll }),
      keys: async () => ["mono-v1-static", "mono-v2-static", "mono-v3-static", "mono-v3-precache", "mono-v4-static", "mono-v4-precache", "mono-v5-static", "mono-v5-precache", "mono-v6-static", "mono-v6-precache", "mono-v7-amor-static", "mono-v7-amor-precache", "mono-v8-amor-static", "mono-v8-amor-precache", "mono-v9-amor-static", "mono-v9-amor-precache"], delete: remove,
    },
  });
  return { handlers, skipWaiting, claim, remove, addAll };
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
  expect(state.remove).toHaveBeenCalledTimes(14);
  expect(state.remove).toHaveBeenCalledWith("mono-v1-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v2-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v3-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v3-precache");
  expect(state.remove).toHaveBeenCalledWith("mono-v4-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v4-precache");
  expect(state.remove).toHaveBeenCalledWith("mono-v5-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v5-precache");
  expect(state.remove).toHaveBeenCalledWith("mono-v6-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v6-precache");
  expect(state.remove).toHaveBeenCalledWith("mono-v7-amor-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v7-amor-precache");
  expect(state.remove).toHaveBeenCalledWith("mono-v8-amor-static");
  expect(state.remove).toHaveBeenCalledWith("mono-v8-amor-precache");
  expect(state.remove).not.toHaveBeenCalledWith("mono-v9-amor-static");
  expect(state.remove).not.toHaveBeenCalledWith("mono-v9-amor-precache");
  expect(state.claim).toHaveBeenCalledOnce();
});

it("bypasses old HTTP-cached branding when installing the next worker", async () => {
  const state = worker();
  let completion: Promise<unknown> | undefined;
  state.handlers.get("install")!({ waitUntil: (work) => { completion = work; } });
  await completion;
  expect(state.addAll).toHaveBeenCalledOnce();
  const requests = state.addAll.mock.calls[0][0] as Request[];
  expect(requests.map((request) => new URL(request.url).pathname)).toContain("/manifest.webmanifest");
  expect(requests.every((request) => request.cache === "reload" && new URL(request.url).origin === "https://amor-together.vercel.app")).toBe(true);
});
