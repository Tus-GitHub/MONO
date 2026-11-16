import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { actOnSoloGame, getSoloGameSummary } from "@/server/services/solo-game-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return togetherJSON(await getSoloGameSummary()); } catch (error) { return togetherError(error); }
}
export async function POST(request: Request) {
  try { assertSameOrigin(request); return togetherJSON(await actOnSoloGame(await readBoundedJson(request, 600_000))); }
  catch (error) { return togetherError(error); }
}
