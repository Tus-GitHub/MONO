import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, isAppError, ValidationError } from "@/lib/errors";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { MINUTE, rateLimit } from "@/lib/security/rate-limit";
import { ARCHIVE_MAX_BYTES } from "@/lib/validation/archive";
import { requireAuthSession } from "@/server/services/session-service";
import { approveArchiveRestore, exportCoupleArchive, restoreCoupleArchive } from "@/server/services/archive-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(error: unknown) {
  if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.httpStatus, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ error: "The archive operation failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

async function authorizeArchiveRequest() {
  const session = await requireAuthSession();
  const limit = rateLimit(`archive:${session.userId}`, 8, 10 * MINUTE);
  if (!limit.ok) throw new AppError("rate_limited", "Too many archive requests. Try again in a few minutes.", 429);
}

/** Portable archive is separate from the existing, compatible human-readable JSON export. */
export async function GET() {
  try {
    await authorizeArchiveRequest();
    const archive = await exportCoupleArchive();
    return new NextResponse(JSON.stringify(archive), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="mono-archive-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) { return failure(error); }
}

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), archive: z.unknown() }).strict(),
  z.object({ action: z.literal("restore"), archive: z.unknown(), approvals: z.array(z.string().min(1).max(4000)).min(1).max(2) }).strict(),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await authorizeArchiveRequest();
    const parsed = requestSchema.safeParse(await readBoundedJson(request, ARCHIVE_MAX_BYTES + 16_384));
    if (!parsed.success) throw new ValidationError("Send an archive approval or restore request.");
    const result = parsed.data.action === "approve" ? await approveArchiveRestore(parsed.data.archive) : await restoreCoupleArchive(parsed.data.archive, parsed.data.approvals);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
