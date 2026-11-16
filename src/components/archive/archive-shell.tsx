import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";

export function ArchiveShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-dvh w-full max-w-4xl space-y-6 px-4 py-6 pb-safe sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/home" className="font-display text-2xl text-primary">MONO</Link><form action={logoutAction}><Button variant="secondary" size="sm" type="submit">Sign out</Button></form></header>
    {children}
  </main>;
}
export function ArchivePagination({ page, more, href }: { page: number; more: boolean; href: (page: number) => string }) {
  return <nav aria-label="Archive pages" className="flex items-center justify-between gap-2 py-4 text-sm"><span>{page > 1 ? <Link className="text-primary underline" href={href(page - 1)}>Previous page</Link> : null}</span><span className="text-muted">Page {page}</span><span>{more ? <Link className="text-primary underline" href={href(page + 1)}>Next page</Link> : null}</span></nav>;
}
