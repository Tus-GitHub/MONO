export const CALL_CONTROLS_IDLE_MS = 5_000;

/** A call's UI clock is independent of signaling polls and media playback. */
export function createCallControls() {
  let visible = true, enabled = false, keyboard = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: boolean) => {
    if (visible === next) return;
    visible = next;
    listeners.forEach((listener) => listener());
  };
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  const arm = () => {
    cancel();
    if (enabled && visible && !keyboard) timer = setTimeout(() => { timer = undefined; publish(false); }, CALL_CONTROLS_IDLE_MS);
  };
  return {
    getSnapshot: () => visible,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    configure(next: boolean) {
      if (enabled === next) return;
      enabled = next; publish(true); arm();
    },
    interact() { keyboard = false; arm(); },
    useKeyboard() { keyboard = true; cancel(); publish(true); },
    toggle(fromKeyboard = false) { if (enabled) { keyboard = fromKeyboard; publish(!visible); arm(); } },
    stop() { enabled = false; keyboard = false; cancel(); publish(true); },
  };
}
