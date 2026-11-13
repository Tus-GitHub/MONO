import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { isAppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/request";
import { dispatchDueReminders } from "@/server/services/reminder-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Background polling must not occupy Next's sequential foreground Server Action queue. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const limited = rateLimit(`reminder-poll:${user.id}`, 2, 30_000);
    if (!limited.ok) return Response.json({ error: "Please wait before checking again." }, {
      status: 429, headers: { ...headers, "Retry-After": String(limited.retryAfterSec) },
    });
    const delivered = await dispatchDueReminders(user.id);
    if (delivered > 0) revalidatePath("/", "layout");
    return Response.json({ delivered }, { headers });
  } catch (error) {
    return Response.json({ error: isAppError(error) ? error.message : "Reminders are temporarily unavailable." }, {
      status: isAppError(error) ? error.httpStatus : 503, headers,
    });
  }
}
