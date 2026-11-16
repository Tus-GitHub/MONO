/** Device capture is invoked only from an explicit call, camera or screen-share action. */
function capture(request: () => Promise<MediaStream>, signal: AbortSignal, denied: string, waiting: string, captureError?: (error: unknown) => string): Promise<MediaStream> {
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
        .catch((error) => settle(() => reject(new Error(captureError ? captureError(error) : error?.name === "NotReadableError" ? "Your camera or microphone is unavailable or already in use. Close other calls or camera apps, then try again." : error?.name === "NotFoundError" ? "No suitable camera or microphone was found. Connect a device and try again." : denied))));
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

/** No service request is made until the browser supplies media. Release it on any failure. */
export async function prepareCallMedia<T>(kind: "AUDIO" | "VIDEO", signal: AbortSignal, configure: () => Promise<T>) {
  const media = await acquireCallMedia(kind, signal);
  try {
    signal.throwIfAborted();
    const config = await configure();
    signal.throwIfAborted();
    return { media, config };
  } catch (error) { media.getTracks().forEach((track) => track.stop()); throw error; }
}
export type CameraFacing = "user" | "environment";
export function acquireCameraMedia(signal: AbortSignal, facing: CameraFacing = "user", exact = false) {
  return capture(() => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access isn't supported in this browser.");
    return navigator.mediaDevices.getUserMedia({ audio: false, video: { ...camera, facingMode: exact ? { exact: facing } : facing } });
  }, signal, "Camera access wasn't allowed. Your voice call is still connected.", waiting);
}

/** Mobile browsers may only capture one camera at a time. Never release the microphone. */
export async function switchCallCamera(media: MediaStream, sender: RTCRtpSender, facing: CameraFacing, signal: AbortSignal) {
  const previous = media.getVideoTracks()[0];
  const previousFacing: CameraFacing = previous?.getSettings().facingMode === "environment" ? "environment" : "user";
  let captured: MediaStream | null = null;
  const install = async (source: MediaStream) => {
    signal.throwIfAborted();
    const track = source.getVideoTracks()[0];
    if (!track || track.readyState !== "live") throw new Error("The selected camera is not available.");
    await sender.replaceTrack(track);
    signal.throwIfAborted();
    media.addTrack(track);
  };
  signal.throwIfAborted();
  await sender.replaceTrack(null);
  if (signal.aborted) {
    if (previous?.readyState === "live") await sender.replaceTrack(previous);
    signal.throwIfAborted();
  }
  for (const track of media.getVideoTracks()) { track.stop(); media.removeTrack(track); }
  try {
    captured = await acquireCameraMedia(signal, facing, true);
    await install(captured);
    captured = null;
  } catch (error) {
    captured?.getTracks().forEach(track => track.stop()); captured = null;
    // A missing rear camera must not end the call or strand the previous camera.
    if (!signal.aborted && previous) {
      try { captured = await acquireCameraMedia(signal, previousFacing); await install(captured); captured = null; }
      catch { /* Leave video off if the browser also refuses the previous camera. */ }
    }
    if (signal.aborted) throw error;
    throw new Error(`Couldn't switch to the ${facing === "environment" ? "rear" : "front"} camera. ${media.getVideoTracks().some(track => track.readyState === "live") ? "Your previous camera is restored." : "Your call continues; tap Camera on to try again."}`);
  } finally { captured?.getTracks().forEach(track => track.stop()); }
}
export function acquireScreenMedia(signal: AbortSignal) {
  return capture(() => {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen sharing isn't available in this browser. Try a supported desktop browser.");
    // Invoke before any await: browsers require this call directly after the Share screen click.
    return navigator.mediaDevices.getDisplayMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 24 } } });
  }, signal, "Screen sharing was cancelled or wasn't allowed. Your call is still connected.", "Screen selection took too long. Your call is still connected; try Share screen again.", screenCaptureError);
}

export function screenCaptureError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotReadableError") return "Your device couldn’t capture that screen. Keep the selected app open, stop other screen recordings, then try again. Your call continues.";
  if (name === "NotFoundError" || name === "NotSupportedError") return "This browser has no screen source to share. Use a supported desktop browser; your call continues.";
  if (name === "InvalidStateError") return "Return to AMOR and tap Share again to open the screen picker. Your call continues.";
  return "Screen sharing was cancelled or blocked by your browser. If no picker appeared, this browser may not support capture. Your call continues.";
}
