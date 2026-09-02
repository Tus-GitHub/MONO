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
    name: "MONO — a private space for two",
    short_name: "MONO",
    description:
      "A private space for two — plan dates, capture what actually happened, and decide what to do again.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    theme_color: "#f5f1ea",
    background_color: "#f5f1ea",
    categories: ["lifestyle", "social"],
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
