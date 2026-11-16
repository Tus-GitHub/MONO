import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { actOnChatReset } from "@/server/services/chat-reset-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { assertSameOrigin(request); return togetherJSON(await actOnChatReset(await readBoundedJson(request, 1024))); }
  catch (error) { return togetherError(error); }
}
