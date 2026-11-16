import { transientTogetherError } from "./client";

export const retryDelay = (failures: number) => Math.min(15_000, 1000 * 2 ** Math.min(Math.max(failures - 1, 0), 4));
/** Retry the same operation, never replace a working transport. Caller supplies idempotent work. */
export async function retryRead<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try { return await work(); }
    catch (error) {
      if (signal?.aborted || !transientTogetherError(error) || attempt >= 2) throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal?.reason); };
        const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, 400 * 2 ** attempt);
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
  }
}
export function pollHealth(now = Date.now()) {
  let failures = 0, lastSuccess = now;
  return {
    success: (now = Date.now()) => { failures = 0; lastSuccess = now; },
    failure: (error: unknown, now = Date.now()) => {
      failures++;
      return { show: !transientTogetherError(error) || failures >= 3 || now - lastSuccess >= 20_000, delay: retryDelay(failures) };
    },
  };
}
