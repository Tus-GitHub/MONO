/** Keep voice independent of the reserved (initially silent) video transceiver. */
export function bindRemoteAudio(element: HTMLAudioElement, source: MediaStream, blocked: (value: boolean) => void) {
  const audio = new MediaStream();
  let disposed = false;
  const tracks = new Set<MediaStreamTrack>();
  const play = () => {
    if (disposed || !audio.getAudioTracks().length) return;
    void element.play().then(() => { if (!disposed) blocked(false); }).catch(() => { if (!disposed) blocked(true); });
  };
  const sync = () => {
    for (const track of source.getAudioTracks()) {
      if (tracks.has(track)) continue;
      tracks.add(track); audio.addTrack(track); track.addEventListener("unmute", play);
    }
    play();
  };
  element.srcObject = audio;
  element.muted = false;
  source.addEventListener("addtrack", sync);
  element.addEventListener("loadedmetadata", play);
  const paused = () => { if (!disposed) blocked(true); };
  element.addEventListener("pause", paused);
  sync();
  return () => {
    disposed = true;
    source.removeEventListener("addtrack", sync);
    element.removeEventListener("loadedmetadata", play);
    element.removeEventListener("pause", paused);
    for (const track of tracks) track.removeEventListener("unmute", play);
    element.pause(); element.srcObject = null;
    // These tracks belong to the peer connection; never stop them from a player cleanup.
  };
}
