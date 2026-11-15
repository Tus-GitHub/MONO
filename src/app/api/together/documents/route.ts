import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { sendEncryptedDocument } from "@/server/services/chat-document-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await sendEncryptedDocument(await readBoundedJson(request, 2850000))); }
  catch (error) { return togetherError(error); }
}
