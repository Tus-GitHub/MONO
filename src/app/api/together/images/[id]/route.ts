import { prisma } from "@/lib/db/prisma";
import { idSchema } from "@/lib/validation/common";
import { NotFoundError } from "@/lib/errors";
import { requireTogether } from "@/server/services/together-context";
import { privateHeaders, togetherError } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, couple } = await requireTogether();
    const id = idSchema.parse((await params).id);
    const image = await prisma.chatImage.findFirst({ where: { messageId: id, coupleId: couple.id }, select: { bytes: true, contentType: true } });
    if (!image) throw new NotFoundError();
    // Recheck membership after a potentially slow blob read, before returning private bytes.
    const current = await prisma.coupleMember.findFirst({ where: { coupleId: couple.id, userId: user.id, status: "ACTIVE", user: { deletedAt: null }, couple: { status: "ACTIVE", deletedAt: null } }, select: { userId: true } });
    if (!current) throw new NotFoundError();
    return new Response(new Uint8Array(image.bytes), { headers: { ...privateHeaders, "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch (error) { return togetherError(error); }
}
