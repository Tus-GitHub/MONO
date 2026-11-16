import { listArchiveAccessRequests } from "@/server/services/archive-access-service";
import { ArchiveReviewForm } from "@/components/archive/access-forms";
import { ArchiveRefresh } from "@/components/archive/archive-refresh";
import { ArchivePagination } from "@/components/archive/archive-shell";

export async function ArchiveRequests({ page }: { page: unknown }) {
  const data = await listArchiveAccessRequests(page);
  return <section className="space-y-4"><ArchiveRefresh />
    <div><h2 className="font-display text-2xl">Archived space requests</h2><p className="mt-2 text-sm text-muted">{data.pending} awaiting review. Only the surviving original partner can request read-only access. Approving does not give admin access to the couple’s private content.</p></div>
    {!data.rows.length ? <p className="text-sm text-muted">No requests yet.</p> : null}
    {data.rows.map(row => <article key={row.id} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{row.status.toLowerCase()}</h3><p className="text-xs text-muted">{row.requestedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p></div>
      <dl className="space-y-2 text-sm"><div><dt className="text-muted">Requesting account</dt><dd className="break-all font-mono">{row.requesterId}</dd></div><div><dt className="text-muted">Archived couple</dt><dd className="break-all font-mono">{row.coupleId}</dd></div></dl>
      <ArchiveReviewForm requestId={row.id} status={row.status} eligible={row.eligible} />
      {row.reviewedAt ? <p className="break-all text-xs text-muted">Reviewed {row.reviewedAt.toISOString().slice(0, 16).replace("T", " ")} UTC by {row.reviewedById}</p> : null}
    </article>)}
    <ArchivePagination page={data.page} more={data.page < data.pages} href={page => `/admin?view=archives&page=${page}`} />
  </section>;
}
