import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { actOnChatVideo } from "@/server/services/chat-video-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await actOnChatVideo(await readBoundedJson(request, 1450000))); }
  catch (error) { return togetherError(error); }
}
