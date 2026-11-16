import { requireArchivedRead } from "@/lib/authz/archived-space";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ coupleId: string }> }) {
  try { await requireArchivedRead((await params).coupleId); return togetherJSON({ approved: true }); }
  catch (error) { return togetherError(error); }
}
