import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at `/manifest.webmanifest`. Next injects the
 * `<link rel="manifest">` automatically.
 *
 * Colours mirror the light design tokens in `globals.css` (`--paper`). The live status-bar
 * colour is set per colour-scheme by `viewport.themeColor` in `layout.tsx`; this value is the
 * fallback used for the splash screen and the Android task switcher.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AMOR — a private space for two",
    short_name: "AMOR",
    description:
      "A private space for two — plan dates, capture what actually happened, and decide what to do again.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    theme_color: "#f5f1ea",
    background_color: "#f5f1ea",
    categories: ["lifestyle", "social"],
    shortcuts: [
      {
        name: "Plan a date",
        short_name: "Plan",
        url: "/plan/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Private chat",
        short_name: "Chat",
        url: "/chat",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Memories",
        short_name: "Memories",
        url: "/memories",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
