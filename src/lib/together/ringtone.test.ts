import { expect, it, vi } from "vitest";
import { ringtonePlayer } from "./ringtone";
const audio = () => ({ play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(), loop: false, volume: 1, preload: "auto" });
it("loops the song quietly and releases its download/decoder when ringing stops", async () => {
  const media = audio(), blocked = vi.fn(), player = ringtonePlayer(media as unknown as HTMLAudioElement, blocked);
  await player.play(); expect(media.loop).toBe(true); expect(media.volume).toBeLessThan(0.5); expect(blocked).toHaveBeenLastCalledWith(false);
  player.stop(); expect(media.pause).toHaveBeenCalledOnce(); expect(media.removeAttribute).toHaveBeenCalledWith("src"); expect(media.load).toHaveBeenCalledOnce();
  await player.play(); expect(media.play).toHaveBeenCalledOnce();
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
