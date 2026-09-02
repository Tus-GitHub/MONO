"use client";

import type { ReactNode } from "react";

import { ViewportManager } from "@/components/system/viewport-manager";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Client-side providers mounted once at the root. Server components passed as `children`
 * still render on the server — they just flow through this tree.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
      <ViewportManager />
    </ToastProvider>
  );
}
