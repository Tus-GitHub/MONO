"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useScrollLock } from "@/components/ui/_dialog-primitives";

/** Chat owns the viewport; other pages retain the journal navigation and gutters. */
export function AppFrame({ children, header, sidebar, bottomNav }: { children: ReactNode; header: ReactNode; sidebar: ReactNode; bottomNav: ReactNode }) {
  const chat = usePathname() === "/chat";
  useScrollLock(chat);
  if (chat) return <main className="mono-chat-page bg-paper">{children}</main>;
  return <>
    {sidebar}
    <div className="lg:pl-(--sidebar-w)">
      {header}
      <main className="mx-auto w-full max-w-(--content-wide) px-4 pt-6 pb-[calc(var(--bottomnav-h)+var(--safe-bottom-visible)+2.5rem)] sm:px-6 lg:px-8 lg:pt-8 lg:pb-16">{children}</main>
    </div>
    {bottomNav}
  </>;
}
