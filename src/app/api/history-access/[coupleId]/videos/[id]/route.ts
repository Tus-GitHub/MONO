import { readArchivedVideo } from "@/server/services/archived-content-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: Promise<{ coupleId: string; id: string }> }) {
  try { const { coupleId, id } = await params, part = new URL(request.url).searchParams.get("part"); return togetherJSON(await readArchivedVideo(coupleId, id, part == null ? undefined : /^\d+$/.test(part) ? Number(part) : -1)); }
  catch (error) { return togetherError(error); }
}
