import { NextResponse } from "next/server";
import { requireCoupleContext } from "@/lib/authz";
import { saveCoupleCover } from "@/server/services/profile-media-service";
import { readImageUpload, uploadErrorResponse } from "@/server/services/upload-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireCoupleContext();
    const input = await readImageUpload(request);
    return NextResponse.json(await saveCoupleCover(input));
  } catch (error) { return uploadErrorResponse(error); }
}

export async function DELETE() {
  try {
    await saveCoupleCover(null);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return uploadErrorResponse(error); }
}
