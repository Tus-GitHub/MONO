import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { rememberInvitation } from "@/lib/auth/pending-invitation";
import { isAppError, ValidationError } from "@/lib/errors";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { errorState, successState } from "@/lib/utils/result";
import { completeEmailVerification } from "@/server/services/email-verification-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  z.object({ action: z.literal("check") }).strict(),
  z.object({ action: z.literal("remember"), token: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/) }).strict(),
]);

/** Return the result without rendering an unrelated RSC tree or joining the Server Action queue. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = inputSchema.safeParse(await readBoundedJson(request, 1_024));
    if (!input.success) throw new ValidationError("This verification request is invalid. Open your email link again.");
    const limited = await checkRateLimit(`email-verification-${input.data.action}`, 20, 15 * MINUTE);
    if (limited) return Response.json(errorState(limited), { status: 429, headers });
    if (input.data.action === "confirm") {
      await completeEmailVerification(input.data.token);
      return Response.json(successState(undefined, "Your email address is confirmed."), { headers });
    }
    const user = await requireUser();
    if (input.data.action === "remember") {
      await rememberInvitation(user.id, input.data.token);
    } else if (!user.emailVerified) {
      return Response.json(errorState("Your email is not verified yet. Open the email, confirm your address, then check again here."), { headers });
    }
    return Response.json(successState(undefined, "You can continue."), { headers });
  } catch (error) {
    if (!isAppError(error)) console.error("[email] Verification request could not complete.");
    return Response.json(errorState(isAppError(error) ? error.message : "We couldn't confirm your email right now. Please try again."), {
      status: isAppError(error) ? error.httpStatus : 503, headers,
    });
  }
}
