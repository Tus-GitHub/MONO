import "server-only";

import { NextResponse } from "next/server";

import { AppError, ValidationError, isAppError } from "@/lib/errors";
import { validateImageUpload } from "@/lib/storage";

export interface ReadImage {
  filename: string;
  contentType: string;
  bytes: Buffer;
}

/** Pull a validated image out of a multipart request body. */
export async function readImageUpload(request: Request): Promise<ReadImage> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ValidationError("Expected a multipart form upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError("No image was provided.");
  }

  const check = validateImageUpload({ type: file.type, size: file.size });
  if (!check.ok) throw new ValidationError(check.message);

  const bytes = Buffer.from(await file.arrayBuffer());
  return { filename: file.name || "image", contentType: file.type, bytes };
}

/** Turn a thrown error into a JSON response the upload client can show. */
export function uploadErrorResponse(error: unknown): NextResponse {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: (error as AppError).httpStatus },
    );
  }
  console.error("[upload] unhandled error:", error);
  return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
}
