/** iOS may ignore HTMLMediaElement.volume. A gain node keeps MONO's music slider useful. */
export function musicOutput(element: HTMLAudioElement) {
  let context: AudioContext | null = null, gain: GainNode | null = null;
  let volume = 0.2;
  const setVolume = (next: number) => {
    volume = Math.max(0, Math.min(1, next));
    if (gain) { element.volume = 1; gain.gain.value = volume; }
    else element.volume = volume;
    element.muted = volume === 0;
  };
  const play = async () => {
    if (!context) {
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Constructor) {
        context = new Constructor(); gain = context.createGain();
        context.createMediaElementSource(element).connect(gain); gain.connect(context.destination); setVolume(volume);
      }
    }
    // Both calls begin synchronously in the user's tap; neither waits for network permission.
    const resume = context?.resume(); const playing = element.play();
    await Promise.all([resume, playing]);
  };
  return { setVolume, play, pause: () => { element.pause(); if (context?.state === "running") void context.suspend().catch(() => {}); },
    destroy: () => { element.pause(); if (context) void context.close().catch(() => {}); context = null; gain = null; } };
}
