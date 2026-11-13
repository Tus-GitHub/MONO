/** Keep API failures readable, including offline requests and non-JSON host error pages. */
export async function settingsRequestError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.error === "string"
    ? body.error
    : "That request couldn't finish. Please try again.");
}

export async function settingsRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store", credentials: "same-origin", signal,
      ...(body === undefined ? {} : {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }),
    });
  } catch {
    throw new Error("Couldn't connect. Check your connection and try again.");
  }
  if (!response.ok) throw await settingsRequestError(response);
  try { return await response.json() as T; }
  catch { throw new Error("That request couldn't finish. Please refresh and try again."); }
}

export function settingsErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
