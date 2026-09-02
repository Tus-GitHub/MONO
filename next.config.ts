import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Response security headers, applied to every route.
 *
 * The CSP still allows `'unsafe-inline'` for scripts and styles: Next's App Router injects
 * inline bootstrap scripts and the UI uses inline `style` attributes, and nonce-based CSP needs
 * middleware plumbing that is easy to break on hydration. What it *does* lock down — external
 * script/style/frame sources, `object-src`, `base-uri`, `form-action`, and framing — is where
 * most of the XSS/clickjacking value is, and costs nothing here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "media-src 'self' blob:",
  // The service worker and the web app manifest are same-origin only.
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Keep native/server-only packages out of the bundler; they run as-is on the server.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp", "@aws-sdk/client-s3"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The worker must never be served stale, or updates never reach installed clients.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
