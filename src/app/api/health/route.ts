import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Public on purpose; leaks nothing sensitive. */
export async function GET() {
  let database: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  return NextResponse.json(
    { status: "ok", database, time: new Date().toISOString() },
    { status: database === "up" ? 200 : 503 },
  );
}
