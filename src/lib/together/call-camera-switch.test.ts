import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { switchCallCamera } from "./call-media";
function track(kind: "audio" | "video", facing = "user") {
  const value = { kind, readyState: "live", enabled: true, getSettings: () => ({ facingMode: facing }), stop: vi.fn(() => { value.readyState = "ended"; }) };
  return value;
}
function media(...initial: ReturnType<typeof track>[]) {
  const tracks = [...initial];
  return { getTracks: () => [...tracks], getVideoTracks: () => tracks.filter(t => t.kind === "video"), getAudioTracks: () => tracks.filter(t => t.kind === "audio"),
    addTrack: (t: ReturnType<typeof track>) => tracks.push(t), removeTrack: (t: ReturnType<typeof track>) => tracks.splice(tracks.indexOf(t), 1) } as unknown as MediaStream;
}
let getMedia: ReturnType<typeof vi.fn>;
beforeEach(() => { getMedia = vi.fn(); vi.stubGlobal("window", { isSecureContext: true }); vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: getMedia } }); });
afterEach(() => vi.unstubAllGlobals());

it("releases the front camera for mobile, switches the live sender and keeps the muted microphone", async () => {
  const mic = track("audio"), front = track("video"), rear = track("video", "environment"), stream = media(mic, front);
  mic.enabled = false;
  const replaceTrack = vi.fn().mockResolvedValue(undefined);
  getMedia.mockImplementation(async () => { expect(front.stop).toHaveBeenCalledOnce(); return media(rear); });
  await switchCallCamera(stream, { replaceTrack } as unknown as RTCRtpSender, "environment", new AbortController().signal);
  expect(getMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { exact: "environment" } }) }));
  expect(replaceTrack.mock.calls).toEqual([[null], [rear]]); expect(stream.getVideoTracks()).toEqual([rear]);
  expect(stream.getAudioTracks()).toEqual([mic]); expect(mic.stop).not.toHaveBeenCalled(); expect(mic.enabled).toBe(false);
});
it("restores the original camera when the device has no rear camera", async () => {
  const mic = track("audio"), front = track("video"), restored = track("video"), stream = media(mic, front);
  const replaceTrack = vi.fn().mockResolvedValue(undefined);
  getMedia.mockRejectedValueOnce(new DOMException("No rear", "OverconstrainedError")).mockResolvedValueOnce(media(restored));
  await expect(switchCallCamera(stream, { replaceTrack } as unknown as RTCRtpSender, "environment", new AbortController().signal)).rejects.toThrow("previous camera is restored");
  expect(stream.getVideoTracks()).toEqual([restored]); expect(replaceTrack).toHaveBeenLastCalledWith(restored); expect(mic.stop).not.toHaveBeenCalled();
});
it("leaves audio connected with an actionable error when both camera requests fail", async () => {
  const mic = track("audio"), stream = media(mic, track("video"));
  getMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  await expect(switchCallCamera(stream, { replaceTrack: vi.fn() } as unknown as RTCRtpSender, "environment", new AbortController().signal)).rejects.toThrow("tap Camera on");
  expect(stream.getVideoTracks()).toEqual([]); expect(mic.stop).not.toHaveBeenCalled();
});
it("makes no camera or sender change after cancellation", async () => {
  const front = track("video"), replaceTrack = vi.fn(), abort = new AbortController(); abort.abort();
  await expect(switchCallCamera(media(front), { replaceTrack } as unknown as RTCRtpSender, "environment", abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(replaceTrack).not.toHaveBeenCalled(); expect(getMedia).not.toHaveBeenCalled(); expect(front.stop).not.toHaveBeenCalled();
});
it("restores a still-live source if cancellation arrives during sender detachment", async () => {
  const front = track("video"), abort = new AbortController();
  const replaceTrack = vi.fn().mockImplementationOnce(async () => { abort.abort(); }).mockResolvedValue(undefined);
  await expect(switchCallCamera(media(front), { replaceTrack } as unknown as RTCRtpSender, "environment", abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(replaceTrack.mock.calls).toEqual([[null], [front]]); expect(front.stop).not.toHaveBeenCalled(); expect(getMedia).not.toHaveBeenCalled();
});
