import { timingSafeEqual } from "node:crypto";

import { env } from "@/config/env";
import { dispatchScheduledReminders } from "@/server/services/reminder-scheduler-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!env.CRON_SECRET) {
    return Response.json({ error: "Scheduler is disabled" }, { status: 503, headers });
  }
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    const result = await dispatchScheduledReminders();
    return Response.json(result, { status: result.failedUsers ? 503 : 200, headers });
  } catch (error) {
    console.error("[reminder-scheduler] run failed:", error);
    return Response.json({ error: "Reminder dispatch failed" }, { status: 503, headers });
  }
}
