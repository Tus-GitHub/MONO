import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { callRecovery, canApplyCallIce } from "./call-recovery";
beforeEach(()=>vi.useFakeTimers()); afterEach(()=>vi.useRealTimers());
it("waits for a short interruption and cancels recovery when the link returns",async()=>{
  const recover=vi.fn(), stable=vi.fn(()=>false), r=callRecovery({eligible:()=>true,online:()=>true,stable,recover,onError:vi.fn()});
  r.observe("disconnected");await vi.advanceTimersByTimeAsync(2000);stable.mockReturnValue(true);r.observe("connected");await vi.advanceTimersByTimeAsync(20000);expect(recover).not.toHaveBeenCalled();r.stop();
});
it("recovers on network change, serializes attempts and throttles repeated events",async()=>{
  let resolve!:()=>void;const recover=vi.fn(()=>new Promise<void>(done=>{resolve=done;}));
  const r=callRecovery({eligible:()=>true,online:()=>true,stable:()=>false,recover,onError:vi.fn()});
  r.request();r.request();await vi.advanceTimersByTimeAsync(300);r.request();await vi.advanceTimersByTimeAsync(1000);expect(recover).toHaveBeenCalledTimes(1);resolve();await Promise.resolve();await vi.advanceTimersByTimeAsync(10000);expect(recover).toHaveBeenCalledTimes(2);r.stop();resolve();
});
it("does not send while offline and never restarts after hangup",async()=>{
  let online=false;const recover=vi.fn().mockResolvedValue(undefined),r=callRecovery({eligible:()=>true,online:()=>online,stable:()=>true,recover,onError:vi.fn()});
  r.request();await vi.advanceTimersByTimeAsync(5000);expect(recover).not.toHaveBeenCalled();online=true;await vi.advanceTimersByTimeAsync(1000);expect(recover).toHaveBeenCalledTimes(1);r.stop();r.request();r.observe("failed");await vi.advanceTimersByTimeAsync(60000);expect(recover).toHaveBeenCalledTimes(1);
});
it("retries a failed recovery request even if the old media path still looks connected",async()=>{
  const recover=vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined),onError=vi.fn();
  const r=callRecovery({eligible:()=>true,online:()=>true,stable:()=>true,recover,onError});r.request();await vi.advanceTimersByTimeAsync(10300);expect(recover).toHaveBeenCalledTimes(2);expect(onError).toHaveBeenCalledTimes(1);r.stop();
});

it("queues early restart candidates without applying them to the previous network credentials",()=>{
  expect(canApplyCallIce({usernameFragment:"new"},"a=ice-ufrag:old\r\n")).toBe(false);
  expect(canApplyCallIce({usernameFragment:"new"},"a=ice-ufrag:new\n")).toBe(true);
  expect(canApplyCallIce({candidate:"candidate:1 ufrag new"},"a=ice-ufrag:old\r\n")).toBe(false);
  expect(canApplyCallIce({candidate:"candidate:1"})).toBe(false);
});
