import { after } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { actOnChatReset } from "@/server/services/chat-reset-service";
import { cleanResetChatFiles } from "@/server/services/chat-reset-cleanup-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await actOnChatReset(await readBoundedJson(request, 1024));
    if ("reset" in result) {
      after(() => cleanResetChatFiles(result.cleanupCoupleId));
      return togetherJSON({ reset: true, keyId: result.keyId });
    }
    return togetherJSON(result);
  }
  catch (error) { return togetherError(error); }
}
