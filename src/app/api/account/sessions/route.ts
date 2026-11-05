import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { isAppError, ValidationError } from "@/lib/errors";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { listAuthSessions, revokeAuthSessions } from "@/server/services/session-service";

export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke"), sessionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/) }).strict(),
  z.object({ action: z.literal("revoke-others") }).strict(),
  z.object({ action: z.literal("revoke-all") }).strict(),
]);
const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  return NextResponse.json({ error: isAppError(error) ? error.message : "Session request failed." }, { status: isAppError(error) ? error.httpStatus : 500, headers });
}
export async function GET() {
  try { return NextResponse.json({ sessions: await listAuthSessions() }, { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.safeParse(await readBoundedJson(request));
    if (!input.success) throw new ValidationError("Choose a valid session action.");
    const result = await revokeAuthSessions(input.data);
    if (result.clearCookie) {
      (await cookies()).delete("mono_push_device");
      await clearSessionCookie();
    }
    return NextResponse.json({ ok: true, signedOut: result.clearCookie }, { headers });
  } catch (error) { return failure(error); }
}
