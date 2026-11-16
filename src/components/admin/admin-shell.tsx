import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";

const views = [["couples", "Couples"], ["accounts", "Accounts"], ["ratings", "Restaurant ratings"], ["archives", "Archive access"]] as const;

export function AdminShell({ activeView, children }: { activeView: "couples" | "accounts" | "ratings" | "archives"; children: ReactNode }) {
  return <main className="mx-auto min-h-dvh w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0"><h1 className="font-display text-3xl text-ink">AMOR admin</h1><p className="mt-2 text-sm text-muted">Accounts, reports, restaurant ratings and archive requests.</p></div>
      <form action={logoutAction}><input type="hidden" name="next" value="/admin/login" /><Button type="submit" variant="secondary">Sign out</Button></form>
    </header>
    <nav aria-label="Admin views" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-2 sm:grid-cols-4">
      {views.map(([view, label]) => <Link key={view} aria-current={activeView === view ? "page" : undefined} href={`/admin?view=${view}`}
        className={`flex min-w-0 items-center justify-center rounded-lg px-2 py-3 text-center text-xs font-medium sm:px-4 sm:text-sm ${activeView === view ? "bg-primary-tint text-primary" : "text-muted hover:bg-paper"}`}>{label}</Link>)}
    </nav>
    {children}
  </main>;
}
