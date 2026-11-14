import { afterEach, expect, it, vi } from "vitest";
import { bindRemoteAudio } from "./remote-audio";

class Track extends EventTarget {
  stop = vi.fn();
  constructor(public kind: string) { super(); }
}
class Stream extends EventTarget {
  tracks: Track[] = [];
  getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
  addTrack(track: Track) { this.tracks.push(track); this.dispatchEvent(new Event("addtrack")); }
}
function setup() {
  vi.stubGlobal("MediaStream", Stream);
  const source = new Stream(), audio = new Track("audio"), video = new Track("video");
  source.addTrack(audio); source.addTrack(video);
  const element = Object.assign(new EventTarget(), { srcObject: null as Stream | null, muted: true, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() });
  return { source, audio, video, element };
}
afterEach(() => vi.unstubAllGlobals());
it("plays audio without waiting for the reserved video track and never duplicates it", async () => {
  const { source, audio, video, element } = setup(), blocked = vi.fn();
  const dispose = bindRemoteAudio(element as unknown as HTMLAudioElement, source as unknown as MediaStream, blocked);
  expect(element.srcObject?.tracks).toEqual([audio]); expect(element.muted).toBe(false);
  expect(element.play).toHaveBeenCalledOnce();
  video.dispatchEvent(new Event("unmute")); expect(element.play).toHaveBeenCalledOnce();
  audio.dispatchEvent(new Event("unmute")); expect(element.play).toHaveBeenCalledTimes(2);
  await Promise.resolve(); expect(blocked).toHaveBeenLastCalledWith(false);
  dispose(); expect(element.srcObject).toBeNull(); expect(audio.stop).not.toHaveBeenCalled();
  audio.dispatchEvent(new Event("unmute")); expect(element.play).toHaveBeenCalledTimes(2);
});
it("attaches late audio and exposes interrupted or rejected playback", async () => {
  const { source, element } = setup(); source.tracks = [];
  element.play.mockRejectedValue(new DOMException("gesture required", "NotAllowedError"));
  const blocked = vi.fn(), dispose = bindRemoteAudio(element as unknown as HTMLAudioElement, source as unknown as MediaStream, blocked);
  expect(element.play).not.toHaveBeenCalled();
  source.addTrack(new Track("audio")); await Promise.resolve(); await Promise.resolve();
  expect(blocked).toHaveBeenLastCalledWith(true);
  element.dispatchEvent(new Event("pause")); expect(blocked).toHaveBeenLastCalledWith(true);
  dispose();
});
it("ignores a late play failure after the call ends", async () => {
  const { source, element } = setup(); let fail!: (error: Error) => void;
  element.play.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  const blocked = vi.fn(), dispose = bindRemoteAudio(element as unknown as HTMLAudioElement, source as unknown as MediaStream, blocked);
  dispose(); fail(new Error("ended")); await Promise.resolve(); await Promise.resolve();
  expect(blocked).not.toHaveBeenCalled();
});
