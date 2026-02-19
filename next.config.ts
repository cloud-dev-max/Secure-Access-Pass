import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack due to parsing bugs in Next.js 16.1.6
  experimental: {
    turbo: undefined,
  },
};

export default nextConfig;
