import { afterEach, expect, it, vi } from "vitest";
import { createCallAudioRouter, compatibilityRoutingSupported } from "./audio-router";

function fixture(elementRouting = true, contextRouting = true) {
  const peerTrack = { readyState: "live", stop: vi.fn() };
  const remote = { getAudioTracks: () => [peerTrack] };
  const generated = { stop: vi.fn() };
  const contexts: Context[] = [];
  class Context extends EventTarget {
    state = "running";
    destination = {};
    node = { connect: vi.fn(), disconnect: vi.fn() };
    output = { stream: { getTracks: () => [generated] } };
    createMediaStreamSource = vi.fn(() => this.node);
    createMediaStreamDestination = vi.fn(() => this.output);
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    constructor() { super(); contexts.push(this); }
  }
  const routeContext = vi.fn().mockResolvedValue(undefined);
  if (contextRouting) Object.assign(Context.prototype, { setSinkId: routeContext });
  vi.stubGlobal("AudioContext", Context);
  const routeElement = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("HTMLMediaElement", { prototype: elementRouting ? { setSinkId: routeElement } : {} });
  const element = { srcObject: remote, muted: false, sinkId: "", play: vi.fn().mockResolvedValue(undefined), ...(elementRouting ? { setSinkId: routeElement } : {}) };
  const blocked = vi.fn();
  const router = createCallAudioRouter(element as unknown as HTMLAudioElement, blocked);
  return { element, router, remote, peerTrack, generated, contexts, routeContext, routeElement, blocked };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("leaves normal playback alone until compatibility is explicitly requested", async () => {
  const f = fixture();
  await f.router.route("headphones");
  expect(f.routeElement).toHaveBeenCalledWith("headphones");
  expect(f.contexts).toHaveLength(0);
  expect(f.element.srcObject).toBe(f.remote);
  f.router.dispose(); expect(f.peerTrack.stop).not.toHaveBeenCalled();
});

it("uses Web Audio routing when media-element routing is missing without doubling sound", async () => {
  const f = fixture(false, true);
  await f.router.route("headphones");
  expect(f.routeContext).toHaveBeenLastCalledWith("headphones");
  expect(f.router.deviceId).toBe("headphones");
  expect(f.element.muted).toBe(true);
  expect(f.contexts[0].node.connect).toHaveBeenCalledOnce();
  expect(f.contexts[0].node.connect).toHaveBeenCalledWith(f.contexts[0].destination);
  await f.router.useStandard();
  expect(f.contexts[0].close).toHaveBeenCalledOnce();
  expect(f.element.muted).toBe(false);
  expect(f.router.deviceId).toBe("");
  expect(f.peerTrack.stop).not.toHaveBeenCalled(); f.router.dispose();
});

it("re-renders through a local stream when only element routing exists, then restores the peer stream", async () => {
  const f = fixture(true, false);
  await f.router.enableCompatibility();
  expect(f.element.srcObject).toBe(f.contexts[0].output.stream);
  expect(f.contexts[0].node.connect).not.toHaveBeenCalledWith(f.contexts[0].destination);
  await f.router.route("permitted-speaker-id");
  expect(f.routeElement).toHaveBeenLastCalledWith("permitted-speaker-id");
  await f.router.useStandard();
  expect(f.element.srcObject).toBe(f.remote);
  expect(f.generated.stop).toHaveBeenCalledOnce();
  expect(f.peerTrack.stop).not.toHaveBeenCalled(); f.router.dispose();
});

it("rolls back a failed compatibility setup without stopping the call track", async () => {
  const f = fixture(true, false);
  f.routeElement.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
  await expect(f.router.enableCompatibility()).rejects.toThrow("denied");
  expect(f.router.compatibility).toBe(false);
  expect(f.element.srcObject).toBe(f.remote);
  expect(f.element.muted).toBe(false);
  expect(f.generated.stop).toHaveBeenCalledOnce();
  expect(f.contexts[0].close).toHaveBeenCalledOnce();
  expect(f.peerTrack.stop).not.toHaveBeenCalled(); f.router.dispose();
});

it("preserves the selected route when an output change is denied", async () => {
  const f = fixture(); await f.router.enableCompatibility();
  f.routeContext.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
  await expect(f.router.route("not-permitted")).rejects.toThrow("denied");
  expect(f.router.deviceId).toBe("");
  expect(f.router.compatibility).toBe(true); f.router.dispose();
});

it("does not invent an output control when both APIs are absent", async () => {
  const f = fixture(false, false);
  expect(compatibilityRoutingSupported()).toBe(false);
  await expect(f.router.enableCompatibility()).rejects.toThrow("no alternate");
  expect(f.contexts).toHaveLength(0); f.router.dispose();
});

it("cancels a pending setup on hangup and never restarts playback afterward", async () => {
  const f = fixture();
  let finish!: () => void;
  f.routeContext.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const pending = expect(f.router.enableCompatibility()).rejects.toThrow("cancelled");
  f.router.dispose(); finish(); await pending;
  expect(f.contexts[0].node.connect).not.toHaveBeenCalled();
  expect(f.element.play).not.toHaveBeenCalled();
  expect(f.peerTrack.stop).not.toHaveBeenCalled();
});

it("exposes an interrupted compatibility player and resumes from a user action", async () => {
  const f = fixture(); await f.router.enableCompatibility();
  const context = f.contexts[0]; context.state = "suspended";
  context.dispatchEvent(new Event("statechange"));
  expect(f.blocked).toHaveBeenLastCalledWith(true);
  context.state = "running"; await f.router.resume();
  expect(f.blocked).toHaveBeenLastCalledWith(false);
  f.router.dispose(); f.blocked.mockClear();
  context.state = "suspended"; context.dispatchEvent(new Event("statechange"));
  expect(f.blocked).not.toHaveBeenCalled();
});

it("bounds a browser output request that never resolves and restores playback", async () => {
  vi.useFakeTimers(); const f = fixture();
  f.routeContext.mockImplementationOnce(() => new Promise(() => {}));
  const pending = expect(f.router.enableCompatibility()).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(10_000); await pending;
  expect(f.router.compatibility).toBe(false);
  expect(f.element.muted).toBe(false);
  expect(f.contexts[0].close).toHaveBeenCalledOnce(); f.router.dispose();
});

it("ignores a late fallback-play result after the call has ended", async () => {
  const f = fixture(true, false);
  let finish!: () => void;
  f.routeElement.mockRejectedValueOnce(new Error("route failed"));
  f.element.play.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await expect(f.router.enableCompatibility()).rejects.toThrow("route failed");
  f.router.dispose(); f.blocked.mockClear(); finish();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(f.blocked).not.toHaveBeenCalled();
});
