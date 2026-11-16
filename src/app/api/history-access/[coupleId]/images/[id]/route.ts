import { assertSameOrigin } from "@/lib/security/request";
import { readArchivedImage } from "@/server/services/archived-content-service";
import { privateHeaders, togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
async function read(request: Request, params: Promise<{ coupleId: string; id: string }>, consume: boolean) {
  try {
    if (consume) assertSameOrigin(request);
    const { coupleId, id } = await params, image = await readArchivedImage(coupleId, id, consume);
    if (image.encrypted) return togetherJSON({ data: Buffer.from(image.bytes).toString("base64"), iv: image.iv, viewsUsed: image.viewsUsed });
    return new Response(new Uint8Array(image.bytes), { headers: { ...privateHeaders, "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return togetherError(error); }
}
export const GET = (request: Request, { params }: { params: Promise<{ coupleId: string; id: string }> }) => read(request, params, false);
export const POST = (request: Request, { params }: { params: Promise<{ coupleId: string; id: string }> }) => read(request, params, true);
