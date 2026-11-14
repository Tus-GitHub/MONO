import { idSchema } from "@/lib/validation/common";
import { assertSameOrigin } from "@/lib/security/request";
import { readChatImage } from "@/server/services/chat-security-service";
import { privateHeaders, togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
async function read(request: Request, params: Promise<{ id: string }>, consume: boolean) {
  try {
    if (consume) assertSameOrigin(request);
    const image = await readChatImage(idSchema.parse((await params).id), consume, !consume && new URL(request.url).searchParams.get("migration") === "1");
    if (image.encrypted) return togetherJSON({ data: Buffer.from(image.bytes).toString("base64"), iv: image.iv, viewsUsed: image.viewsUsed });
    return new Response(new Uint8Array(image.bytes), { headers: { ...privateHeaders, "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return togetherError(error); }
}
export const GET = (request: Request, { params }: { params: Promise<{ id: string }> }) => read(request, params, false);
export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) => read(request, params, true);
