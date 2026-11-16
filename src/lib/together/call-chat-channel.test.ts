import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bindCallChatChannel } from "./call-chat-channel";

class Channel extends EventTarget {
  readyState = "open";
  partner?: Channel;
  send = vi.fn((data: string) => { queueMicrotask(() => this.partner?.dispatchEvent(new MessageEvent("message", { data }))); });
  close = vi.fn(() => { this.readyState = "closed"; this.dispatchEvent(new Event("close")); });
  rtc() { return this as unknown as RTCDataChannel; }
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("both call participants confirm support without another peer connection", async () => {
  const a = new Channel(), b = new Channel(); a.partner = b; b.partner = a;
  const owner = vi.fn(), partner = vi.fn();
  const stopA = bindCallChatChannel(a.rtc(), owner), stopB = bindCallChatChannel(b.rtc(), partner);
  await Promise.resolve(); await Promise.resolve();
  expect(owner).toHaveBeenCalledWith(a); expect(partner).toHaveBeenCalledWith(b);
  expect(vi.getTimerCount()).toBe(0);
  stopA(); stopB(); expect(a.close).not.toHaveBeenCalled(); expect(b.close).not.toHaveBeenCalled();
});
it("does not hand game chat to an older call client that cannot receive it", async () => {
  const a = new Channel(), ready = vi.fn(); const stop = bindCallChatChannel(a.rtc(), ready);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(ready).not.toHaveBeenCalled(); expect(a.send).toHaveBeenCalledTimes(30); expect(vi.getTimerCount()).toBe(0); stop();
});
it("notifies consumers when the shared call transport closes", async () => {
  const a = new Channel(), ready = vi.fn(), stop = bindCallChatChannel(a.rtc(), ready);
  a.dispatchEvent(new MessageEvent("message", { data: "mono-call-game-chat:ack:1" }));
  a.close(); expect(ready.mock.calls).toEqual([[a], [null]]); stop();
});
it("ignores message text and detaches capability handlers without closing the call", () => {
  const a = new Channel(), ready = vi.fn(), stop = bindCallChatChannel(a.rtc(), ready);
  a.dispatchEvent(new MessageEvent("message", { data: '{"type":"message","text":"private"}' }));
  expect(ready).not.toHaveBeenCalled(); stop();
  a.dispatchEvent(new MessageEvent("message", { data: "mono-call-game-chat:ack:1" }));
  expect(ready).not.toHaveBeenCalled(); expect(a.close).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
