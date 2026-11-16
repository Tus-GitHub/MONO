import { timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";
import { processStorageCleanup } from "@/server/services/storage-cleanup-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily fallback for queued chat-file removals, independent of open browsers. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (!env.CRON_SECRET || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const total = { processed: 0, removed: 0, kept: 0, failed: 0 };
  try {
    const deadline = Date.now() + 40_000;
    for (let batch = 0; batch < 20 && Date.now() < deadline; batch++) {
      const result = await processStorageCleanup({ chatVideosOnly: true, limit: 50 });
      for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += result[key];
      if (result.processed < 50) break;
    }
    return Response.json(total, { status: total.failed ? 503 : 200, headers });
  } catch {
    console.error("[chat-cleanup] worker failed; durable jobs remain queued");
    return Response.json({ error: "Chat file cleanup interrupted" }, { status: 503, headers });
  }
}
