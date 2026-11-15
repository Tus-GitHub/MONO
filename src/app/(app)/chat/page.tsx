import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { togetherSnapshot } from "@/server/services/together-service";
import { TogetherRoom } from "@/components/together/together-room";
export const metadata: Metadata = { title: "Chat" };
export default async function ChatPage() {
  const [user, initial] = await Promise.all([requireUser(), togetherSnapshot()]);
  return <TogetherRoom initial={initial} userId={user.id} />;
}
