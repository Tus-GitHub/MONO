import { NextResponse } from "next/server";

import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { buildCoupleCoverKey, storage } from "@/lib/storage";
import { readImageUpload, uploadErrorResponse } from "@/server/services/upload-service";

export const dynamic = "force-dynamic";

/** Upload / replace the couple's cover photo. Any active member may do this. */
export async function POST(request: Request) {
  try {
    const { couple } = await requireCoupleContext();
    const { filename, contentType, bytes } = await readImageUpload(request);

    const key = buildCoupleCoverKey(couple.id, filename);
    const stored = await storage.put({ key, body: bytes, contentType });

    await prisma.couple.update({
      where: { id: couple.id },
      data: { photoUrl: stored.url, photoKey: key },
    });

    if (couple.photoKey && couple.photoKey !== key) {
      await storage.delete(couple.photoKey).catch(() => undefined);
    }

    return NextResponse.json({ url: stored.url, key });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    const { couple } = await requireCoupleContext();

    await prisma.couple.update({
      where: { id: couple.id },
      data: { photoUrl: null, photoKey: null },
    });

    if (couple.photoKey) {
      await storage.delete(couple.photoKey).catch(() => undefined);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
