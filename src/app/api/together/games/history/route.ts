import type { NextRequest } from "next/server";
import { idSchema } from "@/lib/validation/common";
import { getGameHistory } from "@/server/services/game-history-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const before = request.nextUrl.searchParams.get("before");
    return togetherJSON(await getGameHistory(before == null ? undefined : idSchema.parse(before)));
  } catch (error) { return togetherError(error); }
}
