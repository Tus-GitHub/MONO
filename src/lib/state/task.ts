/** One owner for an asynchronous operation. Cancellation also invalidates late callbacks. */
export class TaskScope {
  private active: AbortController | null = null;

  begin(replace = false): AbortSignal | null {
    if (this.active && !replace) return null;
    this.cancel();
    this.active = new AbortController();
    return this.active.signal;
  }

  owns(signal: AbortSignal): boolean {
    return this.active?.signal === signal && !signal.aborted;
  }

  finish(signal: AbortSignal): boolean {
    if (!this.owns(signal)) return false;
    this.active = null;
    return true;
  }

  cancel(): void {
    this.active?.abort();
    this.active = null;
  }
}

export type TaskState<T, Phase extends string = string> =
  | { status: "idle" }
  | { status: "pending"; phase: Phase }
  | { status: "success"; data: T }
  | { status: "error"; phase: Phase; message: string };
