type ConfirmationState<T> = { stage: "idle" } | { stage: "awaiting"; options: T } | { stage: "closing" };

/** One outstanding confirmation; acceptance is released only after browser history settles. */
export class ConfirmationController<T> {
  private state: ConfirmationState<T> = { stage: "idle" };
  private resolve: ((value: boolean) => void) | null = null;
  private accepted = false;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(state: ConfirmationState<T>) { this.state = state; this.listeners.forEach((listener) => listener()); }

  request(options: T): Promise<boolean> {
    if (this.state.stage !== "idle") return Promise.resolve(false);
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.update({ stage: "awaiting", options });
    });
  }
  settle(value: boolean): void {
    if (this.state.stage !== "awaiting") return;
    this.accepted = value;
    this.update({ stage: "closing" });
  }
  historyClosed(stayedOnPage: boolean): void {
    if (this.state.stage !== "closing") return;
    const resolve = this.resolve;
    this.resolve = null;
    const accepted = this.accepted && stayedOnPage;
    this.accepted = false;
    this.update({ stage: "idle" });
    resolve?.(accepted);
  }
  dispose(): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.accepted = false;
    this.update({ stage: "idle" });
    resolve?.(false);
  }
}
