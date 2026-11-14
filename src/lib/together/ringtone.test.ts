import { afterEach, expect, it, vi } from "vitest";
import { ringtonePlayer } from "./ringtone";
const audio = () => ({ play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), getAttribute: vi.fn().mockReturnValue(null), removeAttribute: vi.fn(), load: vi.fn(), loop: false, volume: 1, currentTime: 0, preload: "auto" });
afterEach(() => vi.useRealTimers());
it("loops the song quietly, stops on answer, reuses it next call and releases it on unmount", async () => {
  const media = audio(), blocked = vi.fn(), player = ringtonePlayer(media as unknown as HTMLAudioElement, blocked);
  await player.play(); expect(media.loop).toBe(true); expect(media.volume).toBeLessThan(0.5); expect(blocked).toHaveBeenLastCalledWith(false);
  player.stop(); expect(media.pause).toHaveBeenCalledOnce(); expect(media.currentTime).toBe(0);
  await player.play(); expect(media.play).toHaveBeenCalledTimes(2);
  player.destroy(); expect(media.removeAttribute).toHaveBeenCalledWith("src"); expect(media.load).toHaveBeenCalledOnce();
  await player.play(); expect(media.play).toHaveBeenCalledTimes(2);
});
it("previews from a user gesture, but a new incoming call cancels the preview stop timer", async () => {
  vi.useFakeTimers(); const media = audio(), player = ringtonePlayer(media as unknown as HTMLAudioElement, vi.fn());
  await player.play(true); vi.advanceTimersByTime(1000); await player.play(); vi.advanceTimersByTime(3000);
  expect(media.pause).not.toHaveBeenCalled(); player.stop();
  await player.play(true); vi.advanceTimersByTime(2500); expect(media.pause).toHaveBeenCalledTimes(2);
});
it("does not let an old rejected attempt override a successful manual retry", async () => {
  let reject!: (error: Error) => void; const media = audio(), blocked = vi.fn();
  media.play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const player = ringtonePlayer(media as unknown as HTMLAudioElement, blocked), pending = player.play();
  await player.play(); reject(new Error("old blocked attempt")); await pending;
  expect(blocked.mock.calls).toEqual([[false]]);
});
it("offers explicit play after an autoplay rejection, then clears the fallback", async () => {
  const media = audio(), blocked = vi.fn(); media.play.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
  const player = ringtonePlayer(media as unknown as HTMLAudioElement, blocked);
  await player.play(); expect(blocked).toHaveBeenLastCalledWith(true); await player.play(); expect(blocked).toHaveBeenLastCalledWith(false);
});
it("ignores a late autoplay rejection after answer, decline, hang-up or unmount cleanup", async () => {
  let reject!: (error: Error) => void; const media = audio(), blocked = vi.fn();
  media.play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const player = ringtonePlayer(media as unknown as HTMLAudioElement, blocked), pending = player.play(); player.stop(); reject(new Error("late")); await pending;
  expect(blocked).not.toHaveBeenCalled();
});
