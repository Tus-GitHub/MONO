import { NextResponse, type NextRequest } from "next/server";

import { requireCoupleMembership, requireUserMediaAccess } from "@/lib/authz";
import { isAppError } from "@/lib/errors";
import { coupleIdFromKey, storage, userIdFromKey } from "@/lib/storage";
import { isCanonicalStorageKey } from "@/lib/storage/key";
import { isActiveMediaKey } from "@/server/services/storage-cleanup-service";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/**
 * Streams a stored object, but only to someone allowed to see it. The key prefix is the
 * pivot — personal files are owner-only, current avatars also allow an active partner,
 * and `couples/<id>/…` is active members only. Access is re-checked before the file is
 * touched. Any failure returns 404 so the
 * existence of a file is never revealed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  let key: string;
  try { key = segments.map((segment) => decodeURIComponent(segment)).join("/"); }
  catch { return new NextResponse(null, { status: 404 }); }

  if (!isCanonicalStorageKey(key)) return new NextResponse(null, { status: 404 });

  try {
    const userScope = userIdFromKey(key);
    const coupleScope = coupleIdFromKey(key);

    if (userScope) {
      await requireUserMediaAccess(userScope, key);
    } else if (coupleScope) {
      await requireCoupleMembership(coupleScope);
    } else {
      return new NextResponse(null, { status: 404 });
    }

    if (!await isActiveMediaKey(key)) return new NextResponse(null, { status: 404 });
    const etag = `"${createHash("sha256").update(key).digest("hex")}"`;
    if (_request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { etag, "cache-control": "private, no-cache" } });
    }
    const body = await storage.get(key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": contentTypeFor(key),
        // Revalidate authorization and active references before serving cached private media.
        "cache-control": "private, no-cache",
        etag,
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
