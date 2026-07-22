import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Only needed to expose getCloudflareContext() during `next dev`. Starting the
// miniflare/workerd proxy during a production `next build` is unnecessary (our
// code only reads the CF context at request time) and has proven flaky on
// Windows workerd, so scope it to development.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const appDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // OpenNext (with --skipNextBuild) consumes Next's standalone server output.
  output: "standalone",
  turbopack: {
    root: appDir,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudflarestream.com",
      },
    ],
  },
  // Security headers on every response (defense-in-depth for an account /
  // giving app). CSP here is intentionally conservative — it hardens framing,
  // base-uri and plugins without an inline script-src that would break Next.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        // API responses must never be cached by shared caches (auth-sensitive).
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  // Phase-1 archived surfaces: routes are private-foldered (non-routable).
  // Redirect any stale bookmark to the live giving surfaces instead of 404.
  async redirects() {
    const toGiving = ["/giving/goals", "/giving/impact", "/giving/recurring"];
    const toDashboard = [
      "/courses",
      "/content",
      "/assistant",
      "/ambassador",
      "/church",
      "/daf",
      "/foundation",
      "/major-donor",
      "/volunteer",
      "/support",
    ];
    return [
      ...toGiving.map((source) => ({ source, destination: "/giving", permanent: false })),
      ...toGiving.map((source) => ({ source: `${source}/:path*`, destination: "/giving", permanent: false })),
      ...toDashboard.map((source) => ({ source, destination: "/dashboard", permanent: false })),
      ...toDashboard.map((source) => ({ source: `${source}/:path*`, destination: "/dashboard", permanent: false })),
    ];
  },
};

export default nextConfig;
