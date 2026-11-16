"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { ChatKey } from "@/lib/together/chat-crypto";
import { readStickerPixels, type StickerSource } from "@/lib/together/stickers";
import type { MessageDTO } from "@/lib/together/types";
import { cn } from "@/lib/utils/cn";

export function StickerImage({ message, chatKey, coupleId, label, className }: {
  message: MessageDTO; chatKey: ChatKey; coupleId: string; label: string; className?: string;
}) {
  const [url, setUrl] = useState(""), [failed, setFailed] = useState(false);
  const imageUrl = message.image?.url;
  const sender = message.senderId, nonce = message.clientNonce, id = message.id;
  useEffect(() => {
    const controller = new AbortController();
    let preview = "";
    const row: StickerSource = { senderId: sender, clientNonce: nonce, kind: "STICKER", image: { url: imageUrl ?? "", encrypted: true, contentType: "image/png", viewLimit: 0 } };
    readStickerPixels(row, chatKey, coupleId, controller.signal).then((bytes) => {
      try {
        if (controller.signal.aborted) return;
        preview = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
        setUrl(preview); setFailed(false);
      } finally { bytes.fill(0); }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (preview) URL.revokeObjectURL(preview); };
  }, [id, sender, nonce, imageUrl, chatKey, coupleId]);
  return <span className={cn("grid aspect-square place-items-center", className)}>
    {url && !failed ? <Image unoptimized src={url} alt={label} width={512} height={512} className="size-full object-contain" onError={() => setFailed(true)} />
      : <span className="flex flex-col items-center gap-1 text-faint"><Icon name="images" /><span className="text-2xs">{failed ? "Unavailable" : "Loading…"}</span></span>}
  </span>;
}
