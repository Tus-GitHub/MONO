"use client";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { originalVideo, prepareVideo, videoSize, type PreparedVideo } from "@/lib/together/video-compression";
import { newVideoUpload, uploadVideo, type VideoUpload } from "@/lib/together/video-transfer";
import { errorMessage, togetherFetch } from "@/lib/together/client";
import type { ChatKey } from "@/lib/together/chat-crypto";
import type { MessageDTO } from "@/lib/together/types";

export function VideoComposer({ file, chatKey, coupleId, userId, onClose, onSent }: { file: File; chatKey: ChatKey; coupleId: string; userId: string; onClose: () => void; onSent: (message: MessageDTO) => void }) {
  const [prepared, setPrepared] = useState<PreparedVideo | null>(null), [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"preparing" | "ready" | "sending">("preparing"), [progress, setProgress] = useState(0), [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const operation = useRef<AbortController | null>(null), upload = useRef<VideoUpload | null>(null), sent = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); operation.current = controller;
    void prepareVideo(file, controller.signal, setProgress).then((result) => {
      if (!controller.signal.aborted) { setPrepared(result); setPhase("ready"); }
    }).catch((e) => { if (!controller.signal.aborted) { setError(errorMessage(e)); setPhase("ready"); } });
    return () => { controller.abort(); operation.current?.abort(); if (upload.current?.id && !sent.current) void togetherFetch("/api/together/videos", { body: { action: "cancel", id: upload.current.id } }).catch(() => {}); };
  }, [file]);
  useEffect(() => {
    if (!prepared) return;
    const next = URL.createObjectURL(prepared.file); queueMicrotask(() => setUrl(next));
    return () => URL.revokeObjectURL(next);
  }, [prepared]);
  const useOriginal = () => {
    operation.current?.abort();
    try { setPrepared(originalVideo(file)); setError(""); } catch (e) { setError(errorMessage(e)); }
    setPhase("ready");
  };
  const send = async () => {
    if (!prepared || phase === "sending") return;
    const controller = new AbortController(); operation.current = controller;
    upload.current ??= newVideoUpload(); setAttempted(true); setPhase("sending"); setError(""); setProgress(0);
    try {
      const row = await uploadVideo(prepared.file, upload.current, chatKey, coupleId, userId, controller.signal, setProgress);
      if (controller.signal.aborted) return;
      sent.current = true; onSent(row); onClose();
    } catch (e) { if (!controller.signal.aborted) { setError(errorMessage(e)); setPhase("ready"); } }
  };
  return <BottomSheet open title="Share a video" onClose={onClose} footer={<div className="flex flex-wrap gap-2">
    <Button disabled={!prepared || phase !== "ready"} loading={phase === "sending"} onClick={() => void send()}><Icon name="video" size="sm" />{attempted ? "Retry video" : "Send video"}</Button>
    <Button variant="ghost" onClick={onClose}>Cancel video</Button>
  </div>}>
    <div className="space-y-3">
      <p className="break-all text-sm font-medium">{file.name}</p>
      {url ? <video src={url} controls playsInline preload="metadata" aria-label="Video preview" className="max-h-64 w-full rounded-xl bg-paper object-contain" /> : null}
      {phase !== "ready" ? <div role="status" className="space-y-2"><p className="text-sm">{phase === "preparing" ? "Preparing video on your device" : progress === 1 ? "Finishing encrypted upload" : "Encrypting and uploading"} · {Math.round(progress * 100)}%</p><progress aria-label={phase === "preparing" ? "Video compression" : "Video upload"} value={progress} max={1} className="w-full accent-primary" /></div> : null}
      {phase === "preparing" ? <Button size="sm" variant="secondary" onClick={useOriginal}>Use original instead</Button> : null}
      {prepared ? <><p className="text-sm text-muted">{prepared.originalBytes !== prepared.file.size ? `${videoSize(prepared.originalBytes)} → ` : ""}{videoSize(prepared.file.size)}</p><p className="text-xs text-muted">{prepared.note}</p></> : null}
      <p className="text-xs text-muted">End-to-end encrypted before upload. Keep AMOR open while sending. If the connection drops, retry continues from the last chunk. Your partner can save this video.</p>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    </div>
  </BottomSheet>;
}
