import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Mantem assets da versao anterior apos deploy (evita "Server Action not found")
    // Vercel Skew Protection
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "embgxkrfwtbqfkwmquvo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
