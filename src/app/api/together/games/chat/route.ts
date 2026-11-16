import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { idSchema } from "@/lib/validation/common";
import { sequenceSchema } from "@/lib/validation/together";
import { gameChatSignals, sendGameChatSignal } from "@/server/services/game-chat-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { return togetherJSON(await gameChatSignals(idSchema.parse(request.nextUrl.searchParams.get("id")), sequenceSchema.parse(request.nextUrl.searchParams.get("after") ?? "0"))); }
  catch (error) { return togetherError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await sendGameChatSignal(await readBoundedJson(request, 100_000))); }
  catch (error) { return togetherError(error); }
}
