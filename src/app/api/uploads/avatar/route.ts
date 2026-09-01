import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { buildUserAvatarKey, storage } from "@/lib/storage";
import { readImageUpload, uploadErrorResponse } from "@/server/services/upload-service";

export const dynamic = "force-dynamic";

/** Upload / replace the signed-in user's profile photo via the storage abstraction. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { filename, contentType, bytes } = await readImageUpload(request);

    const key = buildUserAvatarKey(user.id, filename);
    const stored = await storage.put({ key, body: bytes, contentType });

    const previous = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarKey: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: stored.url, avatarKey: key },
    });

    if (previous?.avatarKey && previous.avatarKey !== key) {
      await storage.delete(previous.avatarKey).catch(() => undefined);
    }

    return NextResponse.json({ url: stored.url, key });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

/** Remove the profile photo. */
export async function DELETE() {
  try {
    const user = await requireUser();
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarKey: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null, avatarKey: null },
    });

    if (record?.avatarKey) {
      await storage.delete(record.avatarKey).catch(() => undefined);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
