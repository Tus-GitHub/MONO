import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
import { registerChatKey, legacyChatPage, migrateChatMessage } from "@/server/services/chat-security-service";
export async function GET() { try { return togetherJSON(await legacyChatPage()); } catch (error) { return togetherError(error); } }
export async function POST(request: Request) {
  try { assertSameOrigin(request); const body = await readBoundedJson(request, 760000) as { action?: string; keyId?: unknown };
    return togetherJSON(body.action === "register" ? await registerChatKey(body.keyId) : await migrateChatMessage(body));
  } catch (error) { return togetherError(error); }
}
