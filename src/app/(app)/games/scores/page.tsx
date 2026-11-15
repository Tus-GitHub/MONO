import type { Metadata } from "next";
import { GamesScreen } from "@/components/together/games-screen";
export const metadata: Metadata = { title: "Game scores" };
export default function GameScoresPage() { return <GamesScreen mode="scores" />; }
