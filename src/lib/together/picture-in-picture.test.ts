import { afterEach, expect, it, vi } from "vitest";
import { enterCallPip, leaveCallPip, supportsCallPip, type PipVideo } from "./picture-in-picture";
afterEach(() => vi.unstubAllGlobals());
it("requests supported standard PiP without touching capture tracks", async () => {
  vi.stubGlobal("document", { pictureInPictureEnabled: true });
  const requestPictureInPicture = vi.fn().mockResolvedValue({});
  const video = { readyState: 2, videoWidth: 640, requestPictureInPicture } as unknown as PipVideo;
  expect(supportsCallPip(video)).toBe(true); await enterCallPip(video); expect(requestPictureInPicture).toHaveBeenCalledOnce();
});
it("uses WebKit only when it reports picture-in-picture support", async () => {
  vi.stubGlobal("document", {});
  const webkitSetPresentationMode = vi.fn();
  const video = { readyState: 2, videoWidth: 640, webkitSupportsPresentationMode: () => true, webkitSetPresentationMode } as unknown as PipVideo;
  expect(supportsCallPip(video)).toBe(true); await enterCallPip(video); expect(webkitSetPresentationMode).toHaveBeenCalledWith("picture-in-picture");
});
it("does not advertise PiP for unsupported or unloaded video", async () => {
  vi.stubGlobal("document", {});
  const video = { readyState: 0, videoWidth: 0 } as PipVideo;
  expect(supportsCallPip(video)).toBe(false); await expect(enterCallPip(video)).rejects.toThrow("does not offer");
});
it("propagates browser denial and exits only the call's own PiP", async () => {
  const video = { requestPictureInPicture: vi.fn().mockRejectedValue(new Error("denied")) } as unknown as PipVideo;
  const exitPictureInPicture = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("document", { pictureInPictureEnabled: true, pictureInPictureElement: {}, exitPictureInPicture });
  await expect(enterCallPip(video)).rejects.toThrow("denied"); await leaveCallPip(video); expect(exitPictureInPicture).not.toHaveBeenCalled();
  vi.stubGlobal("document", { pictureInPictureElement: video, exitPictureInPicture });
  await leaveCallPip(video); expect(exitPictureInPicture).toHaveBeenCalledOnce();
});
