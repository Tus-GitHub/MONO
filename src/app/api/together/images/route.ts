import type { NextRequest } from "next/server";
import { ValidationError } from "@/lib/errors";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { sendEncryptedImage } from "@/server/services/chat-security-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ValidationError("Refresh MONO to send encrypted photos."); return togetherJSON(await sendEncryptedImage(await readBoundedJson(request, 730000))); }
  catch (error) { return togetherError(error); }
}
