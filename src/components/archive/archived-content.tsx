import Image from "next/image";
import Link from "next/link";
import { archivedCalls, archivedChat, archivedDates, archivedExpenses, archivedGames, archivedMemories, archivedPhotos, archivedPlaces, type archiveTab } from "@/server/services/archived-content-service";
import { ArchivePagination } from "./archive-shell";
import { ArchiveChat } from "./archive-chat";
import type { z } from "zod";

export function archiveTime(value: Date | null, timezone: string) { return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(value) : "Not set"; }
export function archiveMoney(cents: number | null, currency: string) { return cents == null ? "Not set" : new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(cents / 100); }
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
const card = "space-y-2 rounded-xl border border-line bg-surface p-4";

export async function ArchivedContent({ coupleId, userId, timezone, keyId, tab, page, dateId }: { coupleId: string; userId: string; timezone: string; keyId: string | null; tab: z.infer<typeof archiveTab>; page: number; dateId?: string }) {
  const root = `/history-access/${coupleId}`;
  const pagination = (more: boolean) => <ArchivePagination page={page} more={more} href={page => `${root}?${new URLSearchParams({ tab, page: String(page), ...(dateId ? { date: dateId } : {}) })}`} />;
  if (tab === "chat") return <ArchiveChat coupleId={coupleId} userId={userId} keyId={keyId} initial={await archivedChat(coupleId)} />;
  if (tab === "dates") {
    const data = await archivedDates(coupleId, page);
    return <><Empty rows={data.rows} />{data.rows.map(date => <Link href={`${root}/dates/${date.id}`} key={date.id} className={`${card} block hover:border-primary`}>
      <p className="text-xs capitalize text-muted">{label(date.status)}</p><h2 className="break-words font-display text-xl">{date.title}</h2>
      <p className="text-sm text-muted">{archiveTime(date.plannedStartAt ?? date.scheduledFor, timezone)}{date.plannedEndAt ? ` → ${archiveTime(date.plannedEndAt, timezone)}` : ""}</p>
      <p className="text-sm">Budget {archiveMoney(date.expectedBudgetCents, date.currency)} · {date._count.activities} saved events</p><span className="inline-block pt-1 text-sm text-primary">View date →</span>
    </Link>)}{pagination(data.more)}</>;
  }
  if (tab === "memories") {
    const data = await archivedMemories(coupleId, page);
    return <><Empty rows={data.rows} />{data.rows.map(memory => <article key={memory.id} className={card}><h2 className="break-words font-display text-xl">{memory.title}{memory.isFavorite ? " ♡" : ""}</h2><p className="text-xs text-muted">{archiveTime(memory.occurredOn, timezone)}</p><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{memory.body}</p>{memory.dateId ? <div className="flex flex-wrap gap-4 text-sm text-primary"><Link className="underline" href={`${root}/dates/${memory.dateId}`}>View date</Link><Link className="underline" href={`${root}?tab=photos&date=${memory.dateId}`}>View date photos</Link></div> : null}</article>)}{pagination(data.more)}</>;
  }
  if (tab === "photos") {
    const data = await archivedPhotos(coupleId, page, dateId);
    return <><Empty rows={data.rows} /><div className="grid gap-4 sm:grid-cols-2">{data.rows.map(photo => <figure key={photo.id} className="overflow-hidden rounded-xl border border-line bg-surface"><a href={photo.url} target="_blank" rel="noreferrer"><Image unoptimized src={photo.url} alt={photo.caption ?? "Saved date photo"} width={photo.width ?? 800} height={photo.height ?? 600} className="h-auto w-full object-contain" /></a><figcaption className="space-y-2 p-3 text-sm"><p className="break-words">{photo.caption}</p><Link className="text-primary underline" href={`${root}/dates/${photo.dateId}`}>View date</Link></figcaption></figure>)}</div>{pagination(data.more)}</>;
  }
  if (tab === "expenses") {
    const data = await archivedExpenses(coupleId, page, dateId);
    return <><Empty rows={data.rows} />{data.rows.map(expense => <article key={expense.id} className={card}><div className="flex flex-wrap justify-between gap-2"><h2 className="break-words font-medium">{expense.description}</h2><strong>{archiveMoney(expense.amountCents, expense.currency)}</strong></div><p className="text-sm text-muted">{archiveTime(expense.spentAt, timezone)} · {expense.date?.title || "Shared expense"}</p><p className="text-sm capitalize">{label(expense.category)} · {label(expense.paidBy)}{expense.ownerShareCents != null ? ` · Owner’s share ${archiveMoney(expense.ownerShareCents, expense.currency)}` : ""}</p><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{expense.note}</p></article>)}{pagination(data.more)}</>;
  }
  if (tab === "places") {
    const data = await archivedPlaces(coupleId, page);
    return <><Empty rows={data.rows} />{data.rows.map(place => <article key={place.id} className={card}><h2 className="break-words font-display text-xl">{place.name}{place.isFavorite ? " ♡" : ""}</h2><p className="text-xs capitalize text-muted">{label(place.category)}</p><p className="break-words text-sm">{[place.address, place.city].filter(Boolean).join(", ")}</p><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{place.description}</p><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{place.notes}</p></article>)}{pagination(data.more)}</>;
  }
  if (tab === "games") {
    const data = await archivedGames(coupleId, page);
    return <><Empty rows={data.rows} />{data.rows.map(game => <article key={game.id} className={card}><h2 className="font-medium capitalize">{label(game.kind)}</h2><p className="text-sm capitalize">{label(game.status)}{game.winnerId ? ` · ${game.winnerId === userId ? "You won" : "Partner won"}` : game.status === "FINISHED" ? " · Draw" : ""}</p><p className="text-xs text-muted">{archiveTime(game.createdAt, timezone)}</p></article>)}{pagination(data.more)}</>;
  }
  const data = await archivedCalls(coupleId, page);
  return <><Empty rows={data.rows} />{data.rows.map(call => <article key={call.id} className={card}><h2 className="font-medium capitalize">{label(call.kind)} call · {call.callerId === userId ? "Outgoing" : "Incoming"}</h2><p className="text-sm capitalize">{label(call.status)}{call.endedAt && call.acceptedAt ? ` · ${Math.max(0, Math.round((call.endedAt.getTime() - call.acceptedAt.getTime()) / 60000))} min` : ""}</p><p className="text-xs text-muted">{archiveTime(call.createdAt, timezone)}</p></article>)}{pagination(data.more)}</>;
}
function Empty({ rows }: { rows: unknown[] }) { return rows.length ? null : <p className="py-6 text-center text-sm text-muted">Nothing saved here.</p>; }
