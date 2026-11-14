import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { acquireCallMedia, acquireCameraMedia, acquireScreenMedia, prepareCallMedia } from "./call-media";
let getMedia: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.useFakeTimers(); getMedia = vi.fn(); vi.stubGlobal("window", { isSecureContext: true }); vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: getMedia } }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const stream = () => { const stop = vi.fn(); return { stop, value: { getTracks: () => [{ stop }] } as unknown as MediaStream }; };
it("makes no call-service request while permission is pending or denied", async () => {
  let fail!: (error: Error) => void;
  getMedia.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  const configure = vi.fn(), pending = prepareCallMedia("AUDIO", new AbortController().signal, configure);
  expect(configure).not.toHaveBeenCalled(); fail(new DOMException("Denied", "NotAllowedError"));
  await expect(pending).rejects.toThrow("Allow microphone"); expect(configure).not.toHaveBeenCalled();
});
it("releases approved devices if call-service configuration fails or is cancelled", async () => {
  const media = stream(); getMedia.mockResolvedValue(media.value);
  await expect(prepareCallMedia("AUDIO", new AbortController().signal, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  expect(media.stop).toHaveBeenCalledOnce();
  const abort = new AbortController();
  await expect(prepareCallMedia("VIDEO", abort.signal, async () => { abort.abort(); })).rejects.toMatchObject({ name: "AbortError" });
  expect(media.stop).toHaveBeenCalledTimes(2);
});
it("distinguishes a busy camera from denied permission", async () => {
  getMedia.mockRejectedValue(new DOMException("Device busy", "NotReadableError"));
  await expect(acquireCameraMedia(new AbortController().signal)).rejects.toThrow("already in use");
});
it("does not access devices before a call and keeps voice calls audio-only", async () => {
  expect(getMedia).not.toHaveBeenCalled(); const media = stream(); getMedia.mockResolvedValue(media.value);
  await expect(acquireCallMedia("AUDIO", new AbortController().signal)).resolves.toBe(media.value);
  expect(getMedia).toHaveBeenCalledWith({ audio: true, video: false }); expect(vi.getTimerCount()).toBe(0);
});
it("requests the front camera only for explicit video calls", async () => {
  getMedia.mockResolvedValue(stream().value); await acquireCallMedia("VIDEO", new AbortController().signal);
  expect(getMedia.mock.calls[0][0]).toMatchObject({ audio: true, video: { facingMode: "user" } });
});
it("releases a call when the permission prompt never resolves", async () => {
  getMedia.mockReturnValue(new Promise(() => {}));
  const pending = expect(acquireCallMedia("AUDIO", new AbortController().signal)).rejects.toThrow("hasn't supplied");
  await vi.advanceTimersByTimeAsync(30_000); await pending; expect(vi.getTimerCount()).toBe(0);
});
it("stops every track if media arrives after cancellation", async () => {
  let complete!: (stream: MediaStream) => void; getMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { complete = resolve; }));
  const abort = new AbortController(), media = stream(), pending = acquireCallMedia("VIDEO", abort.signal);
  abort.abort(); await expect(pending).rejects.toMatchObject({ name: "AbortError" }); complete(media.value); await Promise.resolve();
  expect(media.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it("stops late media after the permission deadline too", async () => {
  let complete!: (stream: MediaStream) => void; getMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { complete = resolve; }));
  const pending = expect(acquireCallMedia("VIDEO", new AbortController().signal)).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(30_000); await pending; const media = stream(); complete(media.value); await Promise.resolve(); expect(media.stop).toHaveBeenCalledOnce();
});
it("gives actionable denial and unsupported-browser feedback", async () => {
  getMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  await expect(acquireCallMedia("VIDEO", new AbortController().signal)).rejects.toThrow("Allow microphone");
  vi.stubGlobal("window", { isSecureContext: false }); await expect(acquireCallMedia("AUDIO", new AbortController().signal)).rejects.toThrow("secure connection");
});
it("upgrades with video only and leaves the existing microphone alone", async () => {
  getMedia.mockResolvedValue(stream().value); await acquireCameraMedia(new AbortController().signal);
  expect(getMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: "user" }) }));
});
it("opens screen selection synchronously after the sharing action and never captures screen audio", async () => {
  const display = vi.fn().mockResolvedValue(stream().value); vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: display } });
  const pending = acquireScreenMedia(new AbortController().signal); expect(display).toHaveBeenCalledOnce();
  expect(display).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.any(Object) })); await pending;
});
it("handles cancelled/unsupported sharing and stops a selection returned after hang-up", async () => {
  await expect(acquireScreenMedia(new AbortController().signal)).rejects.toThrow("supported desktop");
  let complete!: (stream: MediaStream) => void; const display = vi.fn().mockImplementation(() => new Promise<MediaStream>((resolve) => { complete = resolve; }));
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: display } });
  const abort = new AbortController(), pending = acquireScreenMedia(abort.signal); abort.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" }); const media = stream(); complete(media.value); await Promise.resolve(); expect(media.stop).toHaveBeenCalledOnce();
});

it.each([
  ["NotReadableError", "couldn’t capture that screen"],
  ["NotSupportedError", "no screen source"],
  ["InvalidStateError", "Return to MONO"],
  ["NotAllowedError", "If no picker appeared"],
])("explains a %s screen failure without blaming microphone permission", async (name, text) => {
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: vi.fn().mockRejectedValue(new DOMException("capture failed", name)) } });
  await expect(acquireScreenMedia(new AbortController().signal)).rejects.toThrow(text);
});
