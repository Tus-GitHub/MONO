/** Device capture is invoked only from an explicit call, camera or screen-share action. */
function capture(request: () => Promise<MediaStream>, signal: AbortSignal, denied: string, waiting: string): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.isSecureContext) { reject(new Error("Calling needs a supported browser and a secure connection.")); return; }
    if (signal.aborted) { reject(new DOMException("Call cancelled", "AbortError")); return; }
    let finished = false;
    const settle = (work: () => void) => { if (finished) return; finished = true; clearTimeout(timer); signal.removeEventListener("abort", cancel); work(); };
    const cancel = () => settle(() => reject(new DOMException("Call cancelled", "AbortError")));
    const timer = setTimeout(() => settle(() => reject(new Error(waiting))), 30_000);
    signal.addEventListener("abort", cancel, { once: true });
    try {
      void request().then((stream) => { if (finished) stream.getTracks().forEach((track) => track.stop()); else settle(() => resolve(stream)); })
        .catch(() => settle(() => reject(new Error(denied))));
    } catch (error) { settle(() => reject(error instanceof Error ? error : new Error(denied))); }
  });
}
const camera = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, facingMode: "user" };
const waiting = "Your browser hasn't supplied microphone/camera access. Check permissions and try again.";
export function acquireCallMedia(kind: "AUDIO" | "VIDEO", signal: AbortSignal) {
  return capture(() => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Calling needs a supported browser and a secure connection.");
    return navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "VIDEO" ? camera : false });
  }, signal, "Allow microphone access, and camera access for video, to start the call.", waiting);
}
export function acquireCameraMedia(signal: AbortSignal) {
  return capture(() => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access isn't supported in this browser.");
    return navigator.mediaDevices.getUserMedia({ audio: false, video: camera });
  }, signal, "Camera access wasn't allowed. Your voice call is still connected.", waiting);
}
export function acquireScreenMedia(signal: AbortSignal) {
  return capture(() => {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen sharing isn't available in this browser. Try a supported desktop browser.");
    // Invoke before any await: browsers require this call directly after the Share screen click.
    return navigator.mediaDevices.getDisplayMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 24 } } });
  }, signal, "Screen sharing was cancelled or wasn't allowed. Your call is still connected.", "Screen selection took too long. Your call is still connected; try Share screen again.");
}
