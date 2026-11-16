"use client";
import { useEffect, useRef, useState } from "react";
import { useGameChat } from "@/lib/hooks/use-game-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useTogetherCall } from "./together-provider";

export function GameChat({ gameId, initiator, partnerName }: { gameId: string; initiator: boolean; partnerName: string }) {
  const { gameChatChannel } = useTogetherCall();
  const chat = useGameChat(gameId, initiator, gameChatChannel), [text, setText] = useState("");
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => { const node = feed.current; if (node) node.scrollTop = node.scrollHeight; }, [chat.messages]);
  return <section className="rounded-2xl border border-line bg-surface" data-game-chat data-chat-phase={chat.phase} data-chat-transport={chat.transport} aria-label="Match chat">
    <h3 className="flex items-center gap-2 px-4 py-3 text-sm font-medium"><Icon name="message" size="sm" />Chat</h3>
    <div className="space-y-3 px-4 pb-4">
      <div ref={feed} role="log" aria-label="Temporary match messages" aria-live="polite" className="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
        {chat.messages.map(message => <div key={message.id} className={cn("w-fit max-w-[85%] rounded-xl px-3 py-2 text-sm", message.mine ? "ml-auto bg-primary-tint" : "bg-paper")}><span className="sr-only">{message.mine ? "You" : partnerName}: </span><p className="whitespace-pre-wrap break-words">{message.text}</p>{message.mine ? <span className="block text-right text-2xs text-muted">{message.delivered ? "Delivered" : "Sending…"}</span> : null}</div>)}
      </div>
      {chat.phase !== "connected" ? <div className="flex items-center gap-2"><p role="status" className="text-xs text-muted">{chat.phase === "connecting" ? "Connecting…" : chat.phase === "ended" ? "Game finished" : chat.phase === "away" ? "Waiting for your partner…" : chat.phase === "blocked" ? "Chat is unavailable. Check your sign-in." : "Reconnecting…"}</p>{!["ended", "away"].includes(chat.phase) ? <Button size="sm" variant="ghost" onClick={chat.reconnect}>Retry</Button> : null}</div> : null}
      <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); if (chat.send(text)) setText(""); }}>
        <Textarea aria-label="Temporary game message" rows={1} value={text} maxLength={1000} disabled={chat.phase === "ended"} placeholder="Chat here…" className="max-h-28 min-h-11 resize-none" onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (chat.send(text)) setText(""); } }} />
        <Button type="submit" size="icon" aria-label="Send game message" disabled={!text.trim() || chat.phase !== "connected"}><Icon name="arrowRight" /></Button>
      </form>
    </div>
  </section>;
}
