/** Bound browser/provider promises that may otherwise never settle, with cancellable ownership. */
export function waitFor<T>(promise: PromiseLike<T>, signal: AbortSignal, milliseconds = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Request cancelled.")); return; }
    const abort = () => finish(new Error("Request cancelled."));
    const timer = setTimeout(() => finish(new Error("The request timed out. Try again.")), milliseconds);
    const finish = (error: Error | null, value?: T) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(value as T);
    };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then((value) => finish(null, value), (error) => finish(error instanceof Error ? error : new Error("Request failed.")));
  });
}
