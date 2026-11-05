import "server-only";

import { env } from "@/config/env";
import { AppError, AuthorizationError, ValidationError } from "@/lib/errors";

/** Cookie-authenticated JSON mutations must originate from the configured app origin. */
export function assertSameOrigin(request: Request): void {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin
    || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthorizationError("This request must come from this app.");
  }
}

/** Bound bytes while streaming: Content-Length is optional and cannot be trusted. */
export async function readBoundedJson(request: Request, maxBytes = 8_192): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppError("unsupported_media_type", "Send a JSON request.", 415);
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new AppError("payload_too_large", "This request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError("Send a JSON request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError("payload_too_large", "This request is too large.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new ValidationError("Send valid JSON."); }
  } finally { reader.releaseLock(); }
}
