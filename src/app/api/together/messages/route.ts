import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
import { changeChatMessage } from "@/server/services/chat-security-service";
export async function POST(request: Request) {
  try { assertSameOrigin(request); return togetherJSON(await changeChatMessage(await readBoundedJson(request, 26000))); } catch (error) { return togetherError(error); }
}
