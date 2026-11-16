export const CALL_CHAT_LABEL = "mono-call-game-chat";
const READY = "mono-call-game-chat:ready:1", ACK = "mono-call-game-chat:ack:1";

/** Confirm both app versions support game chat before handing over the existing call link. */
export function bindCallChatChannel(channel: RTCDataChannel, onReady: (channel: RTCDataChannel | null) => void) {
  let ready = false, stopped = false, greetings = 0;
  const sendReady = () => {
    if (!stopped && channel.readyState === "open") {
      try { channel.send(READY); } catch { /* A closing call cannot accept more packets. */ }
      if (++greetings >= 30) clearInterval(retry);
    }
  };
  const receive = (event: MessageEvent) => {
    if (stopped || channel.readyState !== "open" || (event.data !== READY && event.data !== ACK)) return;
    if (event.data === READY) try { channel.send(ACK); } catch { return; }
    if (!ready) { ready = true; clearInterval(retry); onReady(channel); }
  };
  const close = () => { if (!stopped) { ready = false; onReady(null); } };
  channel.addEventListener("open", sendReady);
  channel.addEventListener("message", receive);
  channel.addEventListener("close", close);
  channel.addEventListener("error", close);
  // Retry the capability greeting when the other peer's open handler was later to attach.
  const retry = setInterval(() => { if (!ready) sendReady(); }, 1000);
  sendReady();
  return () => {
    stopped = true; clearInterval(retry);
    channel.removeEventListener("open", sendReady); channel.removeEventListener("message", receive);
    channel.removeEventListener("close", close); channel.removeEventListener("error", close);
  };
}
