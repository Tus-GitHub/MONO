import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Archived spaces", robots: { index: false, follow: false } };
export default async function HistoryAccessLayout({ children }: { children: ReactNode }) { if (!await getCurrentUser()) redirect("/login?next=/history-access"); return children; }
