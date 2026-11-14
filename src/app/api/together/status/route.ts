import { togetherStatus } from "@/server/services/couple-call-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return togetherJSON(await togetherStatus()); } catch (error) { return togetherError(error); }
}
