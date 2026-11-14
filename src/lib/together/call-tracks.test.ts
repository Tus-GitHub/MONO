import { expect, it, vi } from "vitest";
import { answerCallTracks, offerCallTracks } from "./call-tracks";
const audio = { kind: "audio" }, camera = { kind: "video" };
const stream = (video = false) => ({ getAudioTracks: () => [audio], getVideoTracks: () => video ? [camera] : [], getTracks: () => video ? [audio, camera] : [audio] }) as unknown as MediaStream;
it("negotiates an empty send/receive video channel during voice calls without accessing a camera", () => {
  const sender = {}, pc = { addTrack: vi.fn(), addTransceiver: vi.fn().mockReturnValue({ sender }) }, media = stream();
  expect(offerCallTracks(pc as unknown as RTCPeerConnection, media)).toBe(sender);
  expect(pc.addTrack).toHaveBeenCalledWith(audio, media); expect(pc.addTransceiver).toHaveBeenCalledWith("video", { direction: "sendrecv", streams: [media] });
});
it("uses the selected camera in the same video channel for video calls", () => {
  const pc = { addTrack: vi.fn(), addTransceiver: vi.fn().mockReturnValue({ sender: {} }) }, media = stream(true);
  offerCallTracks(pc as unknown as RTCPeerConnection, media); expect(pc.addTransceiver).toHaveBeenCalledWith(camera, { direction: "sendrecv", streams: [media] });
});
it("answers with the offered channels and preserves an empty video sender for later screen/camera sharing", async () => {
  const make = (kind: string) => ({ receiver: { track: { kind } }, sender: { replaceTrack: vi.fn().mockResolvedValue(undefined), setStreams: vi.fn() }, direction: "recvonly" });
  const a = make("audio"), v = make("video"), pc = { getTransceivers: () => [a, v] }, media = stream();
  expect(await answerCallTracks(pc as unknown as RTCPeerConnection, media)).toBe(v.sender);
  expect(a.sender.replaceTrack).toHaveBeenCalledWith(audio); expect(v.sender.replaceTrack).toHaveBeenCalledWith(null);
  expect(v.direction).toBe("sendrecv"); expect(v.sender.setStreams).toHaveBeenCalledWith(media);
});
