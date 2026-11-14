import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { idSchema } from "@/lib/validation/common";
import { sequenceSchema } from "@/lib/validation/together";
import { requireTogether } from "@/server/services/together-context";
import { actOnCall, callIceServers, getCall } from "@/server/services/couple-call-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("config") === "1") { await requireTogether(); return togetherJSON({ iceServers: callIceServers() }); }
    return togetherJSON(await getCall(idSchema.parse(params.get("id")), sequenceSchema.parse(params.get("after") ?? "0")));
  } catch (error) { return togetherError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await actOnCall(await readBoundedJson(request, 100_000))); } catch (error) { return togetherError(error); }
}
