"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ArchiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return null;
}
