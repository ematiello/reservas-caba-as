import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for Hostinger (docs/02-arquitectura-y-despliegue.md).
  output: "standalone",
  poweredByHeader: false,
  // Images are resized before upload and served from Supabase Storage; skip on-server
  // optimization so the shared plan's CPU is not spent on it.
  images: { unoptimized: true },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
