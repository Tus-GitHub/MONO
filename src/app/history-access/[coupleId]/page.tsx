import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAppError } from "@/lib/errors";
import { ArchiveShell } from "@/components/archive/archive-shell";
import { ArchiveGuard } from "@/components/archive/archive-guard";
import { ArchivedContent } from "@/components/archive/archived-content";
import { archivePage, archiveTab, getArchivedSpace } from "@/server/services/archived-content-service";
const tabs = [["dates", "Dates"], ["memories", "Memories"], ["photos", "Photos"], ["chat", "Chat"], ["expenses", "Expenses"], ["places", "Places"], ["games", "Games"], ["calls", "Calls"]] as const;

export default async function ArchivedSpacePage({ params, searchParams }: { params: Promise<{ coupleId: string }>; searchParams: Promise<{ tab?: string; page?: string; date?: string }> }) {
  const { coupleId } = await params, query = await searchParams, tab = archiveTab.parse(query.tab), page = archivePage.parse(query.page);
  const space = await getArchivedSpace(coupleId).catch(error => { if (isAppError(error)) notFound(); throw error; });
  return <ArchiveShell><Link href="/history-access" className="text-sm text-primary underline">← Archived spaces</Link>
    <ArchiveGuard coupleId={coupleId}><div className="space-y-5">
      <header className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-primary">Archived · read-only</p><h1 className="break-words font-display text-3xl">{space.name}</h1><p className="whitespace-pre-wrap text-sm text-muted [overflow-wrap:anywhere]">{space.description}</p>
        <p className="text-sm text-muted">Admin approved access for your original account. You can view saved history; this does not reconnect the couple.</p>
        <div className="flex gap-3">{space.members.map(member => <div key={member.id} className="text-center text-xs text-muted">{member.avatarUrl ? <Image unoptimized src={member.avatarUrl} alt={member.id === space.userId ? "Your saved profile photo" : "Partner’s saved profile photo"} width={56} height={56} className="mx-auto mb-1 size-14 rounded-full object-cover" /> : null}{member.id === space.userId ? "You" : "Deleted partner"}</div>)}</div>
      </header>
      {space.photoUrl ? <Image unoptimized src={space.photoUrl} alt="Saved couple cover" width={1200} height={800} className="h-auto max-h-80 w-full rounded-xl object-contain" /> : null}
      <nav aria-label="Archived content" className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface p-1 sm:grid-cols-8">{tabs.map(([id, label]) => <Link key={id} href={`/history-access/${coupleId}?tab=${id}`} aria-current={tab === id ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-lg px-1 text-xs sm:text-sm ${tab === id ? "bg-primary-tint text-primary" : "text-muted hover:bg-paper"}`}>{label}</Link>)}</nav>
      {query.date && (tab === "photos" || tab === "expenses") ? <Link href={`/history-access/${coupleId}?tab=${tab}`} className="text-sm text-primary underline">Show all {tab}</Link> : null}
      <section aria-label={tab} className="space-y-4"><ArchivedContent coupleId={coupleId} userId={space.userId} timezone={space.timezone} keyId={space.chatKeyId} tab={tab} page={page} dateId={query.date} /></section>
    </div></ArchiveGuard>
  </ArchiveShell>;
}
