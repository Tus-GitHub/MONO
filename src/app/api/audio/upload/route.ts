import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { uploadAdminMusic } from "@/server/services/audio-upload-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await uploadAdminMusic(await readBoundedJson(request, 1_410_000))); }
  catch (error) { return togetherError(error); }
}
