import { NextResponse, type NextRequest } from "next/server";
import { requireCoupleContext } from "@/lib/authz";
import { PhotonPlacesProvider } from "@/lib/places/photon-provider";
import { togetherError, togetherJSON } from "@/server/services/together-http";
const provider = new PhotonPlacesProvider();
export async function GET(request: NextRequest) {
  try {
    await requireCoupleContext();
    const params = request.nextUrl.searchParams;
    if (params.has("lat") || params.has("lng")) {
      const latitude = Number(params.get("lat")), longitude = Number(params.get("lng"));
      if (!params.get("lat")?.trim() || !params.get("lng")?.trim() || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        return NextResponse.json({ error: "Choose a valid location." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
      }
      return togetherJSON({ label: await provider.locationLabel({ latitude, longitude }) });
    }
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
    return togetherJSON({ results: query.length >= 2 ? await provider.locations(query) : [] });
  } catch (error) { return togetherError(error); }
}
