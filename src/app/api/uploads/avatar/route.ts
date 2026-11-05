import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { saveUserAvatar } from "@/server/services/profile-media-service";
import { readImageUpload, uploadErrorResponse } from "@/server/services/upload-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireUser();
    const input = await readImageUpload(request);
    return NextResponse.json(await saveUserAvatar(input));
  } catch (error) { return uploadErrorResponse(error); }
}

export async function DELETE() {
  try {
    await saveUserAvatar(null);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return uploadErrorResponse(error); }
}
