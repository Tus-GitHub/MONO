import { archivedChat } from "@/server/services/archived-content-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ coupleId: string }> }) {
  try { return togetherJSON(await archivedChat((await params).coupleId, new URL(request.url).searchParams.get("before"))); }
  catch (error) { return togetherError(error); }
}
