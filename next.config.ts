// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jetonafswjmfegbtxbpl.supabase.co",
      },
    ],
  },
};

export default nextConfig;