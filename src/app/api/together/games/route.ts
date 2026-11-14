import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { idSchema } from "@/lib/validation/common";
import { actOnGame, getGame } from "@/server/services/together-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { return togetherJSON(await getGame(idSchema.parse(request.nextUrl.searchParams.get("id")))); } catch (error) { return togetherError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await actOnGame(await readBoundedJson(request))); } catch (error) { return togetherError(error); }
}
