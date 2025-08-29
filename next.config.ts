// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // No corta el build por ESLint en Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // (Opcional) Ignora errores de TypeScript en build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
