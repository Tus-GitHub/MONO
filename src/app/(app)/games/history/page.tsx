import type { Metadata } from "next";
import { GamesScreen } from "@/components/together/games-screen";
export const metadata: Metadata = { title: "Game history" };
export default function GameHistoryPage() { return <GamesScreen mode="history" />; }
