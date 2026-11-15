"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

export const STOP_CHOICES: { title: string; icon: IconName; minutes: number }[] = [
  { title: "Café", icon: "coffee", minutes: 45 },
  { title: "Restaurant", icon: "utensils", minutes: 90 },
  { title: "Movie", icon: "film", minutes: 130 },
  { title: "Arcade", icon: "gamepad", minutes: 60 },
  { title: "Shopping", icon: "shoppingBag", minutes: 60 },
  { title: "Walk", icon: "compass", minutes: 60 },
  { title: "Dessert", icon: "sparkles", minutes: 45 },
  { title: "Museum", icon: "images", minutes: 90 },
  { title: "Adventure", icon: "compass", minutes: 120 },
  { title: "Hotel", icon: "bed", minutes: 120 },
  { title: "Photography", icon: "camera", minutes: 60 },
];

/** Finish the category sheet's Back traversal before opening the venue sheet. */
export function AddStopSheet({ onChoose, onClose }: {
  onChoose: (title: string, minutes: number) => void; onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [custom, setCustom] = useState<string | null>(null);
  const selection = useRef<{ title: string; minutes: number } | null>(null);
  const choose = (title: string, minutes: number) => {
    if (!open || !title.trim()) return;
    selection.current = { title: title.trim(), minutes };
    setOpen(false);
  };
  return <BottomSheet open={open} onClose={() => setOpen(false)} title="What would you like to add?"
    description="Pick a moment. Then find your place."
    onAfterClose={() => { const next = selection.current; onClose(); if (next) onChoose(next.title, next.minutes); }}
    footer={<Button variant="ghost" fullWidth onClick={() => setOpen(false)}>Cancel</Button>}>
    <div className="grid grid-cols-3 gap-3">
      {STOP_CHOICES.map((choice) => <button key={choice.title} type="button" onClick={() => choose(choice.title, choice.minutes)}
        className="flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-2 py-5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-primary active:scale-95">
        <span className="grid size-10 place-items-center rounded-full bg-primary-tint text-primary"><Icon name={choice.icon} /></span>{choice.title}
      </button>)}
      <button type="button" onClick={() => setCustom("")} className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-2 py-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">
        <span className="grid size-10 place-items-center rounded-full bg-primary-tint text-primary"><Icon name="plus" /></span>Other
      </button>
    </div>
    {custom !== null ? <div className="mt-4 flex gap-2"><Input aria-label="Custom stop" maxLength={120} value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Your own idea"
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); choose(custom, 60); } }} /><Button disabled={!custom.trim()} onClick={() => choose(custom, 60)}>Add stop</Button></div> : null}
  </BottomSheet>;
}
