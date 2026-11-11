import { env } from "@/config/env";
import { requireCoupleContext } from "@/lib/authz";
import { isAppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Resolve a fresh public photo URI server-side; the Google API key never leaves the server. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { user } = await requireCoupleContext();
    if (env.PLACE_PROVIDER !== "google" || !env.GOOGLE_PLACES_API_KEY) return new Response(null, { status: 503, headers });
    const id = new URL(request.url).searchParams.get("placeId");
    if (!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) {
      return new Response(null, { status: 400, headers });
    }
    if (!rateLimit(`place-photo:${user.id}`, 120, 60_000).ok) {
      return new Response(null, { status: 429, headers });
    }
    const detail = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
      headers: { "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": "photos" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!detail.ok) return new Response(null, { status: 502, headers });
    const data = await detail.json();
    const name = data.photos?.[0]?.name;
    if (typeof name !== "string" || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
      return new Response(null, { status: 404, headers });
    }
    const photo = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true`, {
      headers: { "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!photo.ok) return new Response(null, { status: 502, headers });
    const { photoUri } = await photo.json();
    const url = new URL(photoUri);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".googleusercontent.com")) {
      return new Response(null, { status: 502, headers });
    }
    return new Response(null, { status: 302, headers: { ...headers, Location: url.href } });
  } catch (error) {
    return new Response(null, { status: isAppError(error) ? error.httpStatus : 502, headers });
  }
}
