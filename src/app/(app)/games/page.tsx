import type { Metadata } from "next";
import { GamesScreen } from "@/components/together/games-screen";
export const metadata: Metadata = { title: "Games" };
export default function GamesPage() { return <GamesScreen />; }
