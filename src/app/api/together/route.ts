import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { sequenceSchema } from "@/lib/validation/together";
import { sendChatMessage, togetherSnapshot } from "@/server/services/together-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { const params = request.nextUrl.searchParams; return togetherJSON(await togetherSnapshot({
    after: params.has("after") ? sequenceSchema.parse(params.get("after")) : undefined,
    before: params.has("before") ? sequenceSchema.parse(params.get("before")) : undefined,
    revision: params.has("revision") ? String(sequenceSchema.parse(params.get("revision"))) : undefined,
  })); } catch (error) { return togetherError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await sendChatMessage(await readBoundedJson(request, 18_000))); }
  catch (error) { return togetherError(error); }
}
