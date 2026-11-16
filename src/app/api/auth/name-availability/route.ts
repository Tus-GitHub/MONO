import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { nameSchema } from "@/lib/validation/name";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const limited = await checkRateLimit("name-availability", 60, MINUTE);
    if (limited) return Response.json({ error: limited }, { status: 429, headers });
    const parsed = nameSchema.safeParse(new URL(request.url).searchParams.get("name"));
    if (!parsed.success) return Response.json({ error: "Enter a name of 1–80 characters." }, { status: 400, headers });
    // Older open tabs still call this endpoint. Valid display names are always allowed.
    return Response.json({ available: true }, { headers });
  } catch {
    return Response.json({ error: "Name availability is temporarily unavailable." }, { status: 503, headers });
  }
}
