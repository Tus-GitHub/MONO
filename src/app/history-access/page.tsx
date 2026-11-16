import Link from "next/link";
import { ArchiveShell, ArchivePagination } from "@/components/archive/archive-shell";
import { ArchiveRequestForm } from "@/components/archive/access-forms";
import { ArchiveRefresh } from "@/components/archive/archive-refresh";
import { listMyArchivedSpaces } from "@/server/services/archive-access-service";

export default async function ArchivedSpacesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const data = await listMyArchivedSpaces((await searchParams).page);
  return <ArchiveShell><ArchiveRefresh />
    <div className="space-y-2"><Link href="/home" className="text-sm text-primary underline">Back to MONO</Link><h1 className="font-display text-3xl">Your archived spaces</h1>
      <p className="text-sm text-muted">When your partner deletes their account, your shared history is kept and locked. Request admin permission to view it again. Only your original account can make this request.</p></div>
    {!data.verified ? <Link href="/verify-email?next=/history-access" className="text-primary underline">Verify your email to request access</Link> : null}
    {!data.rows.length ? <div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">No eligible archived spaces for this account. A new signup does not inherit an older account’s history.</div> : null}
    {data.rows.map(row => <article key={row.id} className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <h2 className="break-words font-display text-xl">{row.name || "Your shared space"}</h2>
      <p className="text-sm text-muted">{row._count.dates} dates · {row._count.memories} memories · {row._count.chatMessages} messages</p>
      <p className="text-sm">{row.request?.status === "APPROVED" ? "Access approved · read-only" : row.request?.status === "PENDING" ? "Waiting for admin approval" : row.request?.status === "DENIED" ? "Request declined" : row.request?.status === "REVOKED" ? "Access revoked" : "History locked"}</p>
      {row.request?.status === "APPROVED" ? <Link href={`/history-access/${row.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white">View archived space</Link> : row.request?.status !== "PENDING" && data.verified ? <ArchiveRequestForm coupleId={row.id} /> : null}
    </article>)}
    <ArchivePagination page={data.page} more={data.page < data.pages} href={page => `/history-access?page=${page}`} />
  </ArchiveShell>;
}
