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
};

export default nextConfig;
