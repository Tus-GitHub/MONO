import { waitFor } from "@/lib/state/wait-for";
import { routeCallAudio } from "./audio-output";

type RoutingContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };
type Bridge = {
  context: RoutingContext;
  source: MediaStreamAudioSourceNode;
  destination?: MediaStreamAudioDestinationNode;
  original: MediaStream;
  muted: boolean;
  stateChanged: () => void;
};

export const elementRoutingSupported = () => typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.prototype.setSinkId === "function";
export const contextRoutingSupported = () => typeof AudioContext !== "undefined" && typeof (AudioContext.prototype as RoutingContext).setSinkId === "function";
export const compatibilityRoutingSupported = () => typeof AudioContext !== "undefined" && (elementRoutingSupported() || contextRoutingSupported());

/** Optional local playback bridge. No new capture, peer tracks or remote services. */
export function createCallAudioRouter(element: HTMLAudioElement, blocked: (value: boolean) => void) {
  const lifetime = new AbortController();
  const cleaned = new WeakSet<Bridge>();
  let bridge: Bridge | null = null, disposed = false;
  let selected = element.sinkId ?? "";
  const alive = () => { if (disposed) throw new Error("The call has ended."); };
  const bounded = <T>(work: Promise<T>) => waitFor(work, lifetime.signal);
  const cleanup = (value: Bridge) => {
    if (cleaned.has(value)) return;
    cleaned.add(value);
    value.context.removeEventListener("statechange", value.stateChanged);
    value.source.disconnect();
    value.destination?.stream.getTracks().forEach((track) => track.stop());
    void value.context.close().catch(() => {});
  };
  const restore = (value: Bridge) => {
    if (value.destination && element.srcObject === value.destination.stream) element.srcObject = value.original;
    element.muted = value.muted;
  };
  const resume = async () => {
    alive();
    try {
      // Invoke both immediately from the user's tap, before awaiting either promise.
      await bounded(Promise.all([bridge?.context.resume(), element.play()]));
      alive(); blocked(false);
    } catch (error) { if (!disposed) blocked(true); throw error; }
  };
  const enableCompatibility = async () => {
    alive();
    if (bridge) return;
    if (!compatibilityRoutingSupported()) throw new Error("This browser has no alternate audio-output control.");
    const original = element.srcObject as MediaStream | null;
    if (!original?.getAudioTracks().some((track) => track.readyState === "live")) throw new Error("Wait until your partner's audio connects, then try again.");
    const context = new AudioContext() as RoutingContext;
    let value: Bridge | undefined;
    try {
      const source = context.createMediaStreamSource(original);
      const stateChanged = () => { if (!disposed && bridge?.context === context && context.state !== "running") blocked(true); };
      value = { context, source, original, muted: element.muted, stateChanged };
      bridge = value;
      context.addEventListener("statechange", stateChanged);
      const running = bounded(context.resume()); // Preserve user activation.
      void running.catch(() => {}); // Also observed if a following browser call throws synchronously.
      if (context.setSinkId) {
        await Promise.all([running, bounded(context.setSinkId(selected))]);
        alive();
        // Only one audible renderer. Keep the original player bound for instant recovery.
        element.muted = true;
        source.connect(context.destination);
      } else {
        // Some WebKit versions fail to route a direct remote WebRTC track. A local
        // Web Audio stream uses a different renderer; physical-device testing is required.
        value.destination = context.createMediaStreamDestination();
        source.connect(value.destination);
        await running; alive();
        element.srcObject = value.destination.stream;
        await bounded(routeCallAudio(element, selected)); alive();
        await bounded(element.play()); alive();
      }
      blocked(false);
    } catch (error) {
      if (value) { cleanup(value); if (!disposed) restore(value); } else void context.close().catch(() => {});
      if (bridge === value) bridge = null;
      if (!disposed) void resume().catch(() => {});
      throw error;
    }
  };
  return {
    get compatibility() { return bridge !== null; },
    get deviceId() { return selected; },
    async route(deviceId: string) {
      alive();
      // The Web Audio route can exist even when media-element routing is absent.
      if (!elementRoutingSupported() && !bridge) await enableCompatibility();
      if (bridge?.context.setSinkId) await bounded(bridge.context.setSinkId(deviceId));
      else await bounded(routeCallAudio(element, deviceId));
      alive(); selected = deviceId;
    },
    enableCompatibility,
    async useStandard() {
      alive();
      if (bridge) {
        const value = bridge; bridge = null; cleanup(value); restore(value);
        selected = element.sinkId ?? "";
      }
      await resume();
    },
    resume,
    dispose() {
      disposed = true; lifetime.abort();
      if (bridge) { const value = bridge; bridge = null; cleanup(value); restore(value); }
    },
  };
}

export type CallAudioRouter = ReturnType<typeof createCallAudioRouter>;
