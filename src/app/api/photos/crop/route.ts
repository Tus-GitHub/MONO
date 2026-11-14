import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { ValidationError } from "@/lib/errors";
import { getSavedPhotoCrop, savePhotoCrop } from "@/server/services/photo-crop-service";
import { uploadErrorResponse } from "@/server/services/upload-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    return NextResponse.json(await getSavedPhotoCrop({ kind: searchParams.get("kind"), ...(searchParams.has("id") ? { id: searchParams.get("id") } : {}) }), { headers });
  } catch (error) { return uploadErrorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request); await requireUser();
    const limited = await checkRateLimit("saved-photo-crop", 60, 5 * MINUTE);
    if (limited) throw new ValidationError(limited);
    return NextResponse.json(await savePhotoCrop(await readBoundedJson(request, 2_048)), { headers });
  } catch (error) { return uploadErrorResponse(error); }
}
