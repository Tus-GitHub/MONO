import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { requireCoupleMembership } from "@/lib/authz";
import { isAppError } from "@/lib/errors";
import { coupleIdFromKey, storage, userIdFromKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/**
 * A storage key must be a plain, forward-only path. Rejecting `..` / `.` / empty segments,
 * backslashes, a leading slash and control characters here is essential: the ownership check
 * below trusts the key's *prefix*, so a `..` that later cancels out
 * (`couples/<mine>/../users/<victim>/…`) must never reach the storage layer.
 */
function isCanonicalKey(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (key.startsWith("/") || key.includes("\\")) return false;
  for (let i = 0; i < key.length; i += 1) {
    if (key.charCodeAt(i) < 0x20) return false; // ASCII control character
  }
  return key.split("/").every((s) => s.length > 0 && s !== "." && s !== "..");
}

/**
 * Streams a stored object, but only to someone allowed to see it. The key prefix is the
 * pivot — `users/<id>/…` is that user only, `couples/<id>/…` is active members only — and
 * access is re-checked here before the file is touched. Any failure returns 404 so the
 * existence of a file is never revealed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  if (!isCanonicalKey(key)) return new NextResponse(null, { status: 404 });

  try {
    const userScope = userIdFromKey(key);
    const coupleScope = coupleIdFromKey(key);

    if (userScope) {
      const user = await requireUser();
      if (user.id !== userScope) return new NextResponse(null, { status: 404 });
    } else if (coupleScope) {
      await requireCoupleMembership(coupleScope);
    } else {
      return new NextResponse(null, { status: 404 });
    }

    const body = await storage.get(key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": contentTypeFor(key),
        // Object keys carry a random token and are never rewritten in place (replace/delete
        // allocate fresh keys), so a hit is safe to cache hard — but only in the member's own
        // browser: `private` keeps it out of any shared cache or CDN.
        "cache-control": "private, max-age=31536000, immutable",
        "content-disposition": "inline",
        // Private media — never index, never follow.
        "x-robots-tag": "noindex, nofollow, noimageindex",
        "referrer-policy": "no-referrer",
        // A stored object is only ever an image/PDF; stop the browser guessing anything else.
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (isAppError(error)) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 500 });
  }
}
