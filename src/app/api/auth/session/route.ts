import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getCoupleContext } from "@/lib/authz";

export const dynamic = "force-dynamic";

/** Protected example endpoint: returns the caller's session, or 401. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const context = await getCoupleContext();

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    couple: context ? { id: context.couple.id, status: context.couple.status } : null,
  });
}
