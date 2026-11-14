import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { updateChatPresence } from "@/server/services/together-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export async function POST(request: Request) {
  try { assertSameOrigin(request); await updateChatPresence(await readBoundedJson(request)); return togetherJSON({ ok: true }); } catch (error) { return togetherError(error); }
}
