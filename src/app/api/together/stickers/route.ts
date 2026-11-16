import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { listChatStickers, sendEncryptedSticker } from "@/server/services/chat-sticker-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return togetherJSON({ stickers: await listChatStickers() }); }
  catch (error) { return togetherError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await sendEncryptedSticker(await readBoundedJson(request, 400000))); }
  catch (error) { return togetherError(error); }
}
