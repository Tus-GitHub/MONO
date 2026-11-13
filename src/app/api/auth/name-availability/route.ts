import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { nameSchema } from "@/lib/validation/name";
import { isNameAvailable } from "@/server/services/name-service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const limited = await checkRateLimit("name-availability", 60, MINUTE);
    if (limited) return Response.json({ error: limited }, { status: 429, headers });
    const parsed = nameSchema.safeParse(new URL(request.url).searchParams.get("name"));
    if (!parsed.success) return Response.json({ error: "Enter a name of 1–80 characters." }, { status: 400, headers });
    const user = await getCurrentUser();
    return Response.json({ available: await isNameAvailable(parsed.data, user?.id) }, { headers });
  } catch {
    return Response.json({ error: "Name availability is temporarily unavailable." }, { status: 503, headers });
  }
}
