import type { NextRequest } from "next/server";
import { requireCoupleContext } from "@/lib/authz";
import { PhotonPlacesProvider } from "@/lib/places/photon-provider";
import { togetherError, togetherJSON } from "@/server/services/together-http";
const provider = new PhotonPlacesProvider();
export async function GET(request: NextRequest) {
  try {
    await requireCoupleContext();
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
    return togetherJSON({ results: query.length >= 2 ? await provider.locations(query) : [] });
  } catch (error) { return togetherError(error); }
}
