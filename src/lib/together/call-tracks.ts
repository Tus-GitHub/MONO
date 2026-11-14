/** Reserve video in the first offer, even for voice, so camera/screen can replace it later. */
export function offerCallTracks(pc: RTCPeerConnection, media: MediaStream): RTCRtpSender {
  for (const track of media.getAudioTracks()) pc.addTrack(track, media);
  return pc.addTransceiver(media.getVideoTracks()[0] ?? "video", { direction: "sendrecv", streams: [media] }).sender;
}

/** Answer against the offered transceivers; creating new ones here would add unmatched m-lines. */
export async function answerCallTracks(pc: RTCPeerConnection, media: MediaStream): Promise<RTCRtpSender> {
  let video: RTCRtpSender | undefined;
  for (const transceiver of pc.getTransceivers()) {
    const kind = transceiver.receiver.track.kind;
    if (kind !== "audio" && kind !== "video") continue;
    const track = media.getTracks().find((item) => item.kind === kind) ?? null;
    await transceiver.sender.replaceTrack(track);
    transceiver.sender.setStreams(media);
    transceiver.direction = "sendrecv";
    if (kind === "video") video = transceiver.sender;
  }
  if (!video) throw new Error("This call doesn't support video. End it and start a new call.");
  return video;
}
