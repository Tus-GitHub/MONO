import { NextResponse, type NextRequest } from "next/server";

import { getCoupleContext } from "@/lib/authz";
import { isAppError } from "@/lib/errors";
import { exportCoupleData } from "@/server/services/account-service";

export const dynamic = "force-dynamic";

/**
 * Download everything the couple has put into MONO as one JSON file. Members only — the couple
 * is resolved from the session, never from a query param.
 */
export async function GET(_request: NextRequest) {
  try {
    const context = await getCoupleContext();
    if (!context) {
      return NextResponse.json({ error: "Not signed in to a couple space." }, { status: 401 });
    }

    const data = await exportCoupleData(context.couple.id);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mono-export-${stamp}.json"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
