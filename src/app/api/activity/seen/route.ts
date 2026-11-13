import { requireCoupleContext } from "@/lib/authz";
import { isAppError } from "@/lib/errors";
import { rateLimit, MINUTE } from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/request";
import { markDateActivitySeen } from "@/server/services/date-event-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, couple } = await requireCoupleContext();
    const limited = rateLimit(`activity-seen:${user.id}`, 30, MINUTE);
    if (!limited.ok) return Response.json({ error: "Please wait before checking again." }, { status: 429, headers });
    await markDateActivitySeen(couple.id, user.id);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return Response.json({ error: isAppError(error) ? error.message : "Activity is temporarily unavailable." }, {
      status: isAppError(error) ? error.httpStatus : 503, headers,
    });
  }
}
