import { z } from "zod";
import type { NextRequest } from "next/server";
import { imageProcessor } from "@/lib/images";
import { assertSameOrigin } from "@/lib/security/request";
import { requireTogether } from "@/server/services/together-context";
import { sendChatImage } from "@/server/services/together-service";
import { readImageUpload } from "@/server/services/upload-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request); const context = await requireTogether();
    const nonce = z.string().uuid().parse(request.nextUrl.searchParams.get("nonce"));
    const image = await readImageUpload(request), processed = await imageProcessor.process(image.bytes, image.contentType);
    return togetherJSON(await sendChatImage(context, nonce, processed));
  } catch (error) { return togetherError(error); }
}
