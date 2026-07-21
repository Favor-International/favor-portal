import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

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
