import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers";
import { ServiceWorkerManager } from "@/components/system/service-worker-manager";
import { THEME_BOOT_SCRIPT } from "@/lib/settings/theme";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "MONO",
    template: "%s · MONO",
  },
  description:
    "A private space for two — plan dates, capture what actually happened, and decide what to do again.",
  applicationName: "MONO",
  robots: { index: false, follow: false },
  // Installed-PWA behaviour on iOS (Android reads the web app manifest instead).
  appleWebApp: {
    capable: true,
    title: "MONO",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#151210" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // When the on-screen keyboard opens, shrink the layout viewport (not just the visual one) so
  // `dvh`, `position: fixed` and sticky bars all react. Chromium honours this; iOS Safari
  // ignores it and is handled by <ViewportManager> via `visualViewport` instead.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerManager />
      </body>
    </html>
  );
}
