import type { NextRequest } from "next/server";
import { readChatVideo } from "@/server/services/chat-video-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const maxDuration = 60;
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const part = request.nextUrl.searchParams.get("part"); return togetherJSON(await readChatVideo((await params).id, part == null ? undefined : /^\d+$/.test(part) ? Number(part) : -1)); }
  catch (error) { return togetherError(error); }
}
