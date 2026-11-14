import { NextResponse } from "next/server";
import { requireCoupleContext } from "@/lib/authz";
import { isAppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { coupleRevision } from "@/server/services/couple-sync-service";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "cache-control": "private, no-store" };
  try {
    const { user, couple } = await requireCoupleContext();
    const limit = rateLimit(`couple-sync:${user.id}`, 60, 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Please wait before checking again." }, { status: 429, headers: { ...headers, "retry-after": String(limit.retryAfterSec) } });
    return NextResponse.json({ revision: await coupleRevision(couple.id, couple.updatedAt) }, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Couldn't check for updates." }, { status: isAppError(error) ? error.httpStatus : 500, headers });
  }
}
