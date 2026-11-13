import { z } from "zod";

import { isAppError } from "@/lib/errors";
import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { emailSchema } from "@/lib/validation/common";
import { isRegistrationEmailAvailable } from "@/server/services/email-availability-service";

export const dynamic = "force-dynamic";
const schema = z.object({ email: emailSchema }).strict();
const headers = { "Cache-Control": "private, no-store" };

// Keep email addresses out of URL/access logs. This endpoint never sends email.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const limited = await checkRateLimit("email-availability", 60, MINUTE);
    if (limited) return Response.json({ error: limited }, { status: 429, headers });
    const parsed = schema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400, headers });
    return Response.json({ available: await isRegistrationEmailAvailable(parsed.data.email) }, { headers });
  } catch (error) {
    return Response.json({ error: isAppError(error) ? error.message : "Email availability is temporarily unavailable." }, {
      status: isAppError(error) ? error.httpStatus : 503,
      headers,
    });
  }
}
