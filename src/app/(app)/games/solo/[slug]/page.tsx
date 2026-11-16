import { notFound } from "next/navigation";
import { SOLO_GAMES, SOLO_KINDS } from "@/lib/solo-games/catalog";
import { SoloGameScreen } from "@/components/solo-games/game-screen";
import { getSoloGameSummary } from "@/server/services/solo-game-service";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kind = SOLO_KINDS.find(key => SOLO_GAMES[key].slug === slug);
  return { title: kind ? SOLO_GAMES[kind].name : "Solo games" };
}
export default async function SoloGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kind = SOLO_KINDS.find(key => SOLO_GAMES[key].slug === slug);
  if (!kind) notFound();
  const summary = await getSoloGameSummary();
  return <SoloGameScreen key={`${summary.coupleId}:${summary.userId}:${kind}`} kind={kind} userId={summary.userId} coupleId={summary.coupleId} scores={summary.scores} />;
}
