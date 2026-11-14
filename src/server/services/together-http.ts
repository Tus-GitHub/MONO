import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAppError } from "@/lib/errors";
export const privateHeaders = { "Cache-Control": "private, no-store" };
export const togetherJSON = (value: unknown) => NextResponse.json(value, { headers: privateHeaders });
export function togetherError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check your request." }, { status: 422, headers: privateHeaders });
  if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.httpStatus, headers: privateHeaders });
  console.error("[together] request failed", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "Couldn't complete that request. Please try again." }, { status: 500, headers: privateHeaders });
}
