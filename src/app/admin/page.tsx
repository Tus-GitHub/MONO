import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasAdminAccess } from "@/lib/auth/admin";
import { getAdminDashboard } from "@/server/services/moderation-service";
import { ModerationForm, ReportReviewForm } from "@/components/admin/moderation-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { logoutAction } from "@/server/actions/auth";
import { AudioSettingsCard } from "@/components/settings/audio-settings";

export const metadata: Metadata = { title: "MONO admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!user.emailVerified) redirect("/verify-email?next=/admin");
  if (!await hasAdminAccess(user.id)) notFound();
  const data = await getAdminDashboard(await searchParams);
  const pageLink = (page: number) => `/admin?${new URLSearchParams({ query: data.query.query, reportStatus: data.query.reportStatus, page: String(page) })}`;
  return <main className="mx-auto min-h-dvh w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-display text-3xl text-ink">MONO admin</h1><p className="mt-2 text-sm text-muted">Account IDs and submitted reports. Private chats and photos stay private.</p></div>
      <form action={logoutAction}><input type="hidden" name="next" value="/admin/login" /><Button type="submit" variant="secondary">Sign out</Button></form>
    </header>
    <AudioSettingsCard admin />
    <dl className="grid gap-4 sm:grid-cols-3">
      {[['Total accounts signed up', data.totalAccounts], ['Current accessible accounts', data.activeAccounts], ['Reports awaiting review', data.openReports]].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-surface p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 font-display text-3xl text-ink">{value}</dd></div>)}
    </dl>
    <p className="text-xs text-muted">Total includes deleted and blocked accounts. Current accessible accounts excludes both.</p>
    <form className="grid items-end gap-3 sm:grid-cols-3" method="get">
      <div className="space-y-2"><label htmlFor="account-query" className="text-sm text-ink">Find an account ID</label><Input id="account-query" name="query" defaultValue={data.query.query} maxLength={64} /></div>
      <div className="space-y-2"><label htmlFor="report-status" className="text-sm text-ink">Reports</label><Select id="report-status" name="reportStatus" defaultValue={data.query.reportStatus}><option value="OPEN">Awaiting review</option><option value="DISMISSED">Dismissed</option><option value="ACTIONED">Action taken</option></Select></div>
      <Button type="submit" variant="secondary">Apply filters</Button>
    </form>
    <section className="space-y-4" aria-labelledby="accounts-heading">
      <h2 id="accounts-heading" className="font-display text-xl text-ink">Accounts · {data.accountCount}</h2>
      {data.accounts.length === 0 ? <p className="text-sm text-muted">No accounts on this page.</p> : null}
      {data.accounts.map((account) => <article key={account.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all font-mono text-sm text-ink">{account.id}</p><p className="text-xs text-muted">{[account.admin ? "Admin" : "", account.deleted ? "Deleted" : "", account.blocked ? "Email blocked" : ""].filter(Boolean).join(" · ") || "Active"}</p></div>
        {!account.admin ? <ModerationForm targetId={account.id} deleted={account.deleted} blocked={account.blocked} /> : null}
      </article>)}
    </section>
    <section className="space-y-4" aria-labelledby="reports-heading">
      <h2 id="reports-heading" className="font-display text-xl text-ink">Reports · {data.reportCount}</h2>
      <p className="text-sm text-muted">Reports contain only what the sender chose to submit. Review carefully before acting; a report never triggers automatic deletion.</p>
      {data.reports.length === 0 ? <p className="text-sm text-muted">No reports on this page.</p> : null}
      {data.reports.map((report) => <article key={report.id} className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <h3 className="font-medium text-ink">{report.category}</h3>
        <p className="break-all text-sm text-muted">Reported account: <Link className="text-primary underline" href={`/admin?query=${encodeURIComponent(report.targetId)}`}>{report.targetId}</Link></p>
        <p className="break-all text-xs text-muted">From account {report.reporterId} · {report.createdAt.toISOString().slice(0, 10)}</p>
        <p className="whitespace-pre-wrap break-words text-sm text-ink">{report.details}</p>
        {report.status === "OPEN" ? <ReportReviewForm reportId={report.id} /> : <p className="whitespace-pre-wrap break-words text-sm text-muted">{report.status}: {report.reviewNote}</p>}
      </article>)}
    </section>
    <section className="space-y-3" aria-labelledby="audit-heading">
      <h2 id="audit-heading" className="font-display text-xl text-ink">Decision history</h2>
      {data.audit.length === 0 ? <p className="text-sm text-muted">No decisions on this page.</p> : null}
      {data.audit.map((entry) => <div key={entry.id} className="space-y-2 rounded-lg border border-line p-4 text-sm">
        <p className="break-all text-ink">{entry.action.replaceAll("_", " ")} · {entry.targetId}</p>
        <p className="whitespace-pre-wrap break-words text-muted">{entry.reason}</p>
        <p className="break-all text-xs text-muted">Admin {entry.actorId} · {entry.createdAt.toISOString()}</p>
      </div>)}
    </section>
    <nav aria-label="Admin pages" className="flex items-center justify-between text-sm text-primary">
      {data.query.page > 1 ? <Link href={pageLink(data.query.page - 1)}>Previous page</Link> : <span />}
      <span className="text-muted">Page {data.query.page}</span>
      {Math.max(data.accountCount, data.reportCount) > data.query.page * data.pageSize || data.audit.length === data.pageSize ? <Link href={pageLink(data.query.page + 1)}>Next page</Link> : <span />}
    </nav>
  </main>;
}
