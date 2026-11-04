import { NextResponse, type NextRequest } from "next/server";

import { exploreCategoryByKey } from "@/lib/date/explore-categories";
import { isAppError } from "@/lib/errors";
import { searchPlaces } from "@/server/services/place-search-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = exploreCategoryByKey(params.get("category") ?? undefined);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const near =
    params.has("lat") && params.has("lng") && params.get("lat") !== "" && params.get("lng") !== "" &&
    Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
      ? { latitude: lat, longitude: lng } : null;

  try {
    const results = await searchPlaces({
      text: params.get("q") ?? undefined,
      categories: category?.kind === "category" ? category.match : undefined,
      curated: params.get("view") === "hidden" || category?.kind === "curated",
      near,
      limit: 24,
    });
    return NextResponse.json({ results });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
