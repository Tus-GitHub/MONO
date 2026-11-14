"use client";
export async function togetherFetch<T>(path: string, options: { body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 15_000);
  try {
    const multipart = options.body instanceof FormData;
    const response = await fetch(path, { method: options.body === undefined ? "GET" : "POST", cache: "no-store", signal: controller.signal,
      ...(options.body === undefined ? {} : multipart ? { body: options.body as FormData } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Couldn't connect. Try again.");
    return value as T;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new Error(path.startsWith("/api/together/calls") ? "The call service took too long to respond. Please try again." : "The request took too long. Try again; your message is kept.");
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Couldn't complete that request. Try again.";
