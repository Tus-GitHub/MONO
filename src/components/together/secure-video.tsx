"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { downloadVideo, videoMetadata } from "@/lib/together/video-transfer";
import { videoSize } from "@/lib/together/video-compression";
import { saveAttachment } from "@/lib/together/attachments";
import { errorMessage } from "@/lib/together/client";
import type { ChatKey } from "@/lib/together/chat-crypto";
import type { MessageDTO } from "@/lib/together/types";

export function SecureVideo({ message, body, chatKey, coupleId }: { message: MessageDTO; body: string; chatKey: ChatKey; coupleId: string }) {
  const meta = videoMetadata(body), [url, setUrl] = useState(""), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null), resource = useRef(""), blob = useRef<Blob | null>(null);
  useEffect(() => () => { operation.current?.abort(); URL.revokeObjectURL(resource.current); blob.current = null; }, []);
  const open = async () => {
    if (!meta || busy) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError(""); setProgress(0);
    try {
      const result = await downloadVideo(message, meta, chatKey, coupleId, controller.signal, setProgress);
      if (controller.signal.aborted) return;
      URL.revokeObjectURL(resource.current); blob.current = result; resource.current = URL.createObjectURL(result); setUrl(resource.current);
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className="w-full max-w-sm space-y-2">
    {url ? <video src={url} controls playsInline preload="metadata" aria-label="Encrypted chat video" className="max-h-80 w-full rounded-lg bg-paper object-contain" onError={() => setError("This browser cannot play this video format. Save it to open in your phone’s video player.")} /> : <Button variant="secondary" disabled={!meta || busy} onClick={() => void open()}><Icon name="play" />{busy ? `Opening video · ${Math.round(progress * 100)}%` : "Open video"}</Button>}
    <p className="text-2xs text-muted">{meta ? `${videoSize(meta.size)} · ` : ""}End-to-end encrypted</p>
    {busy ? <Button size="sm" variant="ghost" onClick={() => { operation.current?.abort(); setBusy(false); }}>Cancel download</Button> : null}
    {url && meta ? <Button size="sm" variant="ghost" onClick={() => { if (blob.current) void saveAttachment(blob.current, meta.name).catch((e) => { if (e?.name !== "AbortError") setError(errorMessage(e)); }); }}><Icon name="download" size="sm" />Save / share video</Button> : null}
    {body && !meta ? <p role="alert" className="text-xs text-error">This video’s encrypted metadata is invalid.</p> : null}
    {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
  </div>;
}
