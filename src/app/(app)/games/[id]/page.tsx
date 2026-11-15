import type { Metadata } from "next";
import { GamesScreen } from "@/components/together/games-screen";
export const metadata: Metadata = { title: "Your game" };
export default async function GamePage({ params }: { params: Promise<{ id: string }> }) { return <GamesScreen gameId={(await params).id} />; }
