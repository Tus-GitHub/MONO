import "server-only";

import { NextResponse } from "next/server";

import { AppError, ValidationError, isAppError } from "@/lib/errors";
import { MINUTE, checkRateLimit } from "@/lib/security/rate-limit";
import { IMAGE_UPLOAD, validateImageUpload } from "@/lib/storage";

export interface ReadImage {
  filename: string;
  contentType: string;
  bytes: Buffer;
}

/**
 * Sniff the real image type from the file's leading bytes — the client `Content-Type` is not
 * trusted. Returns a canonical mime, or `null` when the bytes are not a recognised raster
 * image. (SVG is deliberately unrecognised: it is never an allowed upload and would be an XSS
 * vector if served inline.)
 */
function sniffImageType(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // ISO-BMFF: "....ftyp<brand>"; AVIF brands start with avif / avis / mif1 / msf1.
  if (b.toString("ascii", 4, 8) === "ftyp" && /^(avif|avis|mif1|msf1)/.test(b.toString("ascii", 8, 12))) {
    return "image/avif";
  }
  return null;
}

/**
 * CSRF defence-in-depth for the upload route handlers (Server Actions get this from Next
 * automatically; plain route handlers do not). The session cookie is `SameSite=Lax`, which
 * already blocks it from riding a cross-site POST — this just refuses an obviously foreign
 * `Origin` outright.
 */
function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // some legitimate clients omit it; SameSite still protects
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ValidationError("Bad request origin.");
  }
  const host = request.headers.get("host");
  if (host && originHost !== host) {
    throw new ValidationError("Cross-origin upload refused.");
  }
}

/** Pull a validated image out of a multipart request body. */
export async function readImageUpload(request: Request): Promise<ReadImage> {
  assertSameOrigin(request);

  const limited = await checkRateLimit("upload", 40, 5 * MINUTE);
  if (limited) throw new ValidationError(limited);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ValidationError("Expected a multipart form upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError("No image was provided.");
  }
  if (file.size > IMAGE_UPLOAD.maxBytes) {
    throw new ValidationError(`That image is over ${Math.round(IMAGE_UPLOAD.maxBytes / 1024 / 1024)} MB.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Trust the file's own bytes, not the declared type.
  const sniffed = sniffImageType(bytes);
  const check = validateImageUpload({ type: sniffed ?? "", size: bytes.byteLength });
  if (!sniffed || !check.ok) {
    throw new ValidationError("That file isn't a supported image (JPEG, PNG, WebP, AVIF, or GIF).");
  }

  return { filename: file.name || "image", contentType: sniffed, bytes };
}

/** Turn a thrown error into a JSON response the upload client can show. */
export function uploadErrorResponse(error: unknown): NextResponse {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: (error as AppError).httpStatus },
    );
  }
  console.error("[upload] unhandled error:", error);
  return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
}
