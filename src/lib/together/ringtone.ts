export const CALL_TONE_URL = "/audio/anywhere-with-you.mp3";

/** Own one ringing interval. Late autoplay failures cannot restart a stopped tone. */
export function ringtonePlayer(audio: HTMLAudioElement, blocked: (value: boolean) => void) {
  let stopped = false;
  audio.loop = true;
  audio.volume = 0.45;
  audio.preload = "none";
  return {
    async play() {
      if (stopped) return;
      try { await audio.play(); if (!stopped) blocked(false); }
      catch { if (!stopped) blocked(true); }
    },
    stop() {
      stopped = true;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}
