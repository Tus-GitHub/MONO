export const CALL_TONE_URL = "/audio/anywhere-with-you.mp3";

/** Keep the same audio element through sound setup and subsequent calls. */
export function ringtonePlayer(audio: HTMLAudioElement, blocked: (value: boolean) => void) {
  let disposed = false, generation = 0, previewTimer: ReturnType<typeof setTimeout> | undefined;
  audio.loop = true;
  audio.volume = 0.45;
  audio.preload = "auto";
  const stop = () => {
    generation++; clearTimeout(previewTimer); audio.pause(); audio.currentTime = 0;
  };
  return {
    async play(preview = false) {
      if (disposed) return;
      const run = ++generation; clearTimeout(previewTimer);
      if (!audio.getAttribute("src")) audio.src = CALL_TONE_URL;
      try {
        // Called synchronously from the enable-sounds button, preserving user activation.
        await audio.play();
        if (disposed || generation !== run) return;
        blocked(false);
        if (preview) previewTimer = setTimeout(stop, 2500);
      } catch { if (!disposed && generation === run) blocked(true); }
    },
    stop,
    destroy() {
      disposed = true; stop(); audio.removeAttribute("src"); audio.load();
    },
  };
}
