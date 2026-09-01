import { NextResponse, type NextRequest } from "next/server";

import { imageProcessor } from "@/lib/images";
import { idSchema } from "@/lib/validation/common";
import { addDatePhoto, replaceDatePhoto } from "@/server/services/photo-service";
import { readImageUpload, uploadErrorResponse } from "@/server/services/upload-service";

export const dynamic = "force-dynamic";
// Generous cap for the multipart body — real phone photos before we downscale them.
export const maxDuration = 60;

/** Upload a new photo to a date: validate → process into variants → store → record. */
export async function POST(request: NextRequest) {
  try {
    const dateId = idSchema.parse(request.nextUrl.searchParams.get("dateId"));
    const { filename, contentType, bytes } = await readImageUpload(request);
    const processed = await imageProcessor.process(bytes, contentType);
    const photo = await addDatePhoto(dateId, processed, filename);
    return NextResponse.json(photo);
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

/** Replace the image behind an existing photo, keeping its id, caption, order and cover roles. */
export async function PUT(request: NextRequest) {
  try {
    const photoId = idSchema.parse(request.nextUrl.searchParams.get("photoId"));
    const { filename, contentType, bytes } = await readImageUpload(request);
    const processed = await imageProcessor.process(bytes, contentType);
    const photo = await replaceDatePhoto(photoId, processed, filename);
    return NextResponse.json(photo);
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
