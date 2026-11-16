import Link from "@/components/ui/app-link";
import { SOLO_GAMES, SOLO_KINDS, type SoloScore } from "@/lib/solo-games/catalog";

export function SoloHighScores({ scores, userId, userName, partnerName }: { scores: SoloScore[]; userId: string; userName: string; partnerName: string }) {
  return <section aria-label="Solo high scores" className="space-y-3">
    <div><h2 className="font-display text-2xl text-ink">Solo personal bests</h2><p className="mt-1 text-sm text-muted">Your highest scores, saved across devices. Take turns beating your best.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{SOLO_KINDS.map(kind => <article key={kind} className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <Link href={`/games/solo/${SOLO_GAMES[kind].slug}`} className="font-medium text-ink hover:text-primary"><span aria-hidden="true">{SOLO_GAMES[kind].emoji} </span>{SOLO_GAMES[kind].name}</Link>
      <dl className="mt-3 space-y-2 text-sm">{[true, false].map(mine => <div key={String(mine)} className="flex items-center justify-between gap-3">
        <dt className="truncate text-muted">{mine ? userName : partnerName}</dt><dd className="shrink-0 font-semibold tabular-nums text-primary">{scores.find(s => s.kind === kind && (mine ? s.userId === userId : s.userId !== userId))?.bestScore.toLocaleString() ?? "—"}</dd>
      </div>)}</dl>
    </article>)}</div>
  </section>;
}
