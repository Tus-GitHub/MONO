import type { NextRequest } from "next/server";
import { assertSameOrigin, readBoundedJson } from "@/lib/security/request";
import { getAudioSettings, changeAudio, readAudio } from "@/server/services/audio-service";
import { togetherError, togetherJSON } from "@/server/services/together-http";
import { audioRange } from "@/lib/audio/file";
export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind");
    if (kind !== "music" && kind !== "ringtone") return togetherJSON(await getAudioSettings());
    const audio = await readAudio(kind);
    if (!audio) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    const range = audioRange(request.headers.get("range"), audio.bytes.length);
    const headers = new Headers({ "Content-Type": audio.contentType, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" });
    if (range === false) { headers.set("Content-Range", `bytes */${audio.bytes.length}`); return new Response(null, { status: 416, headers }); }
    const bytes = range ? audio.bytes.slice(range.start, range.end + 1) : audio.bytes;
    headers.set("Content-Length", String(bytes.length));
    if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${audio.bytes.length}`);
    return new Response(new Uint8Array(bytes), { status: range ? 206 : 200, headers });
  } catch (error) { return togetherError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); return togetherJSON(await changeAudio(await readBoundedJson(request, 2850000))); }
  catch (error) { return togetherError(error); }
}
