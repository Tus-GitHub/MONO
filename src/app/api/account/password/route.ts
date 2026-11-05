import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { isAppError, ValidationError } from "@/lib/errors";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { changeAccountPassword, requireAuthSession } from "@/server/services/session-service";

export const dynamic = "force-dynamic";
const schema = z.object({ currentPassword: z.string().min(1).max(200), password: z.string().min(1).max(200), confirmPassword: z.string().min(1).max(200) }).strict();
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAuthSession();
    const limit = rateLimit(`change-password:${session.userId}`, 5, 15 * 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Too many password attempts. Try again later." }, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSec) } });
    const input = schema.safeParse(await readBoundedJson(request));
    if (!input.success) throw new ValidationError("Check your password fields.");
    await changeAccountPassword(input.data);
    (await cookies()).delete("mono_push_device");
    await clearSessionCookie();
    return NextResponse.json({ ok: true, signedOut: true }, { headers });
  } catch (error) {
    return NextResponse.json({ error: isAppError(error) ? error.message : "Password request failed." }, { status: isAppError(error) ? error.httpStatus : 500, headers });
  }
}
